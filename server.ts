import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Trust reverse proxy (Hostinger Nginx/Passenger/Cloud Run)
app.set('trust proxy', 1);

// Security Headers (P17)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '30mb' }));

// Rate Limiters (P17)
const dossierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições de registro. Tente novamente em alguns minutos.' }
});

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas consultas à conta. Tente novamente em alguns minutos.' }
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições de IA. Aguarde um instante.' }
});

// Lazy Gemini Client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Lazy Supabase Client
// Exclusivamente chaves de serviço/backend: SUPABASE_SECRET_KEY prioritariamente, SUPABASE_SERVICE_ROLE_KEY como fallback de compatibilidade
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

interface AuthUser {
  id: string;
  email: string;
}

// Validação estrita de usuário via Supabase Auth (P0, P2)
// Aceita EXCLUSIVAMENTE Authorization: Bearer <SUPABASE_ACCESS_TOKEN> validado por supabase.auth.getUser(token)
// NENHUM fallback sintético, NENHUM base64, NENHUM token em memória
async function getAuthenticatedUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || !user.id) {
      return null;
    }
    return {
      id: user.id,
      email: user.email || ''
    };
  } catch {
    return null;
  }
}

// Middleware de Autenticação Obrigatória
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Autenticação necessária. Faça login com seu e-mail para continuar.'
    });
  }
  (req as any).user = user;
  next();
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ProvaPack API', timestamp: new Date().toISOString() });
});

// P11 — GET /api/account/me
// Consulta autoritativa no banco de dados Supabase/PostgreSQL
app.get('/api/account/me', accountLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const user: AuthUser = (req as any).user;
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Serviço de banco de dados temporariamente indisponível.'
      });
    }

    // 1. Tentar executar a função RPC de resumo consolidado
    try {
      const { data: summary, error: rpcError } = await supabase.rpc('get_account_summary', {
        p_user_id: user.id
      });

      if (!rpcError && summary) {
        return res.json({
          user: {
            id: user.id,
            email: user.email
          },
          account: summary
        });
      }
    } catch {
      // Prossegue para consulta direta às tabelas se a migration da função ainda estiver sendo aplicada
    }

    // 2. Consulta direta às tabelas no Supabase (sem fallback de memória)
    const { data: profile, error: profileErr } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.error('[Supabase Error] Falha ao consultar seller_profiles:', profileErr.message);
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Serviço temporariamente indisponível.'
      });
    }

    // Se o perfil ainda não existir (ex: antes do primeiro trigger de auth rodar), cria o registro oficial
    let currentProfile = profile;
    if (!currentProfile) {
      const { data: newProfile, error: insertErr } = await supabase
        .from('seller_profiles')
        .insert({
          id: user.id,
          email: user.email,
          plan_code: 'free',
          subscription_status: 'active',
          free_credit_limit: 10,
          extra_credits: 0
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[Supabase Error] Falha ao provisionar perfil:', insertErr.message);
        return res.status(503).json({
          success: false,
          code: 'SERVICE_UNAVAILABLE',
          error: 'Serviço temporariamente indisponível.'
        });
      }
      currentProfile = newProfile;
    }

    // Contar usage_events
    const { count: freeUsedCount, error: countErr } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('usage_source', 'free');

    const freeUsed = countErr ? 0 : Number(freeUsedCount || 0);
    const freeLimit = Number(currentProfile.free_credit_limit ?? 10);
    const extraCredits = Number(currentProfile.extra_credits ?? 0);
    const remaining = Math.max(0, freeLimit - freeUsed) + extraCredits;

    const account = {
      planCode: currentProfile.plan_code || 'free',
      subscriptionStatus: currentProfile.subscription_status || 'active',
      freeLimit,
      freeUsed,
      monthlyLimit: currentProfile.monthly_limit ? Number(currentProfile.monthly_limit) : null,
      monthlyUsed: 0,
      extraCredits,
      remaining,
      unlimited: currentProfile.plan_code === 'volume',
      currentPeriodStart: currentProfile.current_period_start || null,
      currentPeriodEnd: currentProfile.current_period_end || null
    };

    return res.json({
      user: {
        id: user.id,
        email: user.email
      },
      account
    });
  } catch (err: any) {
    console.error('Erro em /api/account/me:', err);
    return res.status(500).json({ success: false, error: 'Erro ao consultar conta.' });
  }
});

// Endpoint legado /api/user/profile com compatibilidade transparente direcionando para a autoridade
app.get('/api/user/profile', requireAuth, async (req: Request, res: Response) => {
  const user: AuthUser = (req as any).user;
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ success: false, error: 'Serviço indisponível.' });
  }

  const { data: profile, error } = await supabase
    .from('seller_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    return res.status(503).json({ success: false, error: 'Perfil não encontrado ou indisponível.' });
  }

  const { count: freeCount } = await supabase
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('usage_source', 'free');

  const freeUsed = Number(freeCount || 0);
  const remaining = Math.max(0, Number(profile.free_credit_limit || 10) - freeUsed) + Number(profile.extra_credits || 0);

  let visualPlan = 'Gratuito (10 envios)';
  if (profile.plan_code === 'pro') visualPlan = 'Pro (50 envios)';
  if (profile.plan_code === 'volume') visualPlan = 'Alto Volume (Ilimitado)';

  return res.json({
    success: true,
    profile: {
      userId: profile.id,
      email: profile.email || user.email,
      plan: visualPlan,
      freeDossiersRemaining: remaining,
      monthlyLimit: profile.monthly_limit || 10,
      usedThisMonth: freeUsed,
      extraCredits: profile.extra_credits || 0
    }
  });
});

// Atomic Server Time Endpoint for forensic timestamp validation
app.get('/api/time', (req: Request, res: Response) => {
  const now = new Date();
  const utc = now.toISOString();
  const timestamp = now.getTime();

  let serverLocalTime = '';
  try {
    serverLocalTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
  } catch {
    serverLocalTime = now.toLocaleTimeString('pt-BR');
  }

  res.json({
    utc,
    timestamp,
    timezone: 'America/Sao_Paulo',
    serverLocalTime,
    timezoneOffsetFormatted: 'GMT-03:00'
  });
});

// P9 & P10 — POST /api/dossiers
// Registro de dossiê estritamente transacional e atômico via Supabase RPC register_provapack_with_usage
app.post('/api/dossiers', dossierLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const user: AuthUser = (req as any).user;
    const dossier = req.body;

    if (!dossier || (!dossier.id && !dossier.public_id && !dossier.recordingId)) {
      return res.status(400).json({ success: false, error: 'Identificador do dossiê é obrigatório' });
    }

    const publicId = String(dossier.public_id || dossier.id || '').trim();
    const recordingId = String(dossier.recording_id || dossier.recordingId || publicId).trim();
    const originalSha256 = String(dossier.original_sha256 || dossier.originalSha256 || dossier.fileHashSha256 || '').trim();
    const processedSha256 = String(dossier.processed_sha256 || dossier.processedSha256 || '').trim();

    if (!originalSha256 || originalSha256.length !== 64 || /[^0-9a-fA-F]/.test(originalSha256)) {
      return res.status(400).json({ success: false, error: 'Hash SHA-256 original inválido.' });
    }

    if (!processedSha256 || processedSha256.length !== 64 || /[^0-9a-fA-F]/.test(processedSha256)) {
      return res.status(400).json({ success: false, error: 'Hash SHA-256 processado inválido.' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Registro online temporariamente indisponível'
      });
    }

    // Execução da função atômica PostgreSQL
    const { data: rpcResult, error: rpcError } = await supabase.rpc('register_provapack_with_usage', {
      p_user_id: user.id,
      p_dossier_id: publicId,
      p_recording_id: recordingId,
      p_marketplace: dossier.marketplace || 'Outros',
      p_order_number: String(dossier.order_number || dossier.orderNumber || '').trim(),
      p_tracking_code: dossier.tracking_code || dossier.trackingCode || null,
      p_product_name: String(dossier.product_name || dossier.productName || '').trim(),
      p_serial_number: dossier.serial_number || dossier.serialNumber || null,
      p_recorded_at: dossier.recorded_at || dossier.recordedAt || new Date().toISOString(),
      p_started_at_utc: dossier.started_at_utc || dossier.startedAtUtc || null,
      p_ended_at_utc: dossier.ended_at_utc || dossier.endedAtUtc || null,
      p_timezone: dossier.timezone || 'America/Sao_Paulo',
      p_time_source: dossier.time_source || dossier.timeSource || 'DEVICE_WITH_SERVER_REFERENCE',
      p_duration_seconds: Number(dossier.duration_seconds || dossier.durationSeconds || 0),
      p_original_sha256: originalSha256,
      p_processed_sha256: processedSha256,
      p_file_size_bytes: Number(dossier.file_size_bytes || dossier.fileSizeBytes || 0),
      p_status: dossier.status || 'validado'
    });

    if (rpcError) {
      const errMsg = rpcError.message || '';

      // Regra P10: Sem crédito retorna HTTP 402 NO_CREDITS
      if (errMsg.includes('NO_CREDITS')) {
        return res.status(402).json({
          success: false,
          code: 'NO_CREDITS',
          error: 'Você não possui envios disponíveis.'
        });
      }

      if (errMsg.includes('DOSSIER_CONFLICT') || rpcError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Registro já existe e não pode ser alterado.'
        });
      }

      if (errMsg.includes('SUBSCRIPTION_INACTIVE')) {
        return res.status(402).json({
          success: false,
          code: 'SUBSCRIPTION_INACTIVE',
          error: 'Sua assinatura não está ativa. Renove seu plano para continuar.'
        });
      }

      // Se a função RPC não foi criada ainda no Supabase remoto (ex: antes da migration),
      // faz a verificação direta nas tabelas sem memória
      if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
        // 1. Checar se já existe
        const { data: existingPack } = await supabase
          .from('provapacks')
          .select('public_id, recording_id, original_sha256, processed_sha256')
          .eq('public_id', publicId)
          .maybeSingle();

        if (existingPack) {
          if (
            existingPack.recording_id === recordingId &&
            existingPack.original_sha256 === originalSha256 &&
            existingPack.processed_sha256 === processedSha256
          ) {
            return res.json({
              success: true,
              dossierId: publicId,
              persistedToSupabase: true,
              idempotent: true
            });
          }
          return res.status(409).json({
            success: false,
            error: 'Registro já existe e não pode ser alterado.'
          });
        }

        // 2. Checar cota diretamente em seller_profiles
        const { data: profile } = await supabase
          .from('seller_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const { count: freeEvents } = await supabase
          .from('usage_events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('usage_source', 'free');

        const freeUsed = Number(freeEvents || 0);
        const freeLimit = Number(profile?.free_credit_limit ?? 10);
        const extraCredits = Number(profile?.extra_credits ?? 0);
        const hasCredits = (freeUsed < freeLimit) || (extraCredits > 0) || (profile?.plan_code === 'volume');

        if (!hasCredits) {
          return res.status(402).json({
            success: false,
            code: 'NO_CREDITS',
            error: 'Você não possui envios disponíveis.'
          });
        }

        // Inserir registro
        const payload = {
          user_id: user.id,
          owner_user_id: user.id,
          public_id: publicId,
          recording_id: recordingId,
          marketplace: dossier.marketplace || 'Outros',
          order_number: String(dossier.order_number || dossier.orderNumber || '').trim(),
          tracking_code: dossier.tracking_code || dossier.trackingCode || null,
          product_name: String(dossier.product_name || dossier.productName || '').trim(),
          serial_number: dossier.serial_number || dossier.serialNumber || null,
          recorded_at: dossier.recorded_at || dossier.recordedAt || new Date().toISOString(),
          started_at_utc: dossier.started_at_utc || dossier.startedAtUtc || null,
          ended_at_utc: dossier.ended_at_utc || dossier.endedAtUtc || null,
          timezone: dossier.timezone || 'America/Sao_Paulo',
          time_source: dossier.time_source || dossier.timeSource || 'DEVICE_WITH_SERVER_REFERENCE',
          duration_seconds: Number(dossier.duration_seconds || dossier.durationSeconds || 0),
          original_sha256: originalSha256,
          processed_sha256: processedSha256,
          file_size_bytes: Number(dossier.file_size_bytes || dossier.fileSizeBytes || 0),
          status: dossier.status || 'validado'
        };

        const { error: insertErr } = await supabase.from('provapacks').insert(payload);
        if (insertErr) {
          console.error('[Supabase Error] Falha ao inserir provapack:', insertErr);
          return res.status(503).json({
            success: false,
            code: 'SERVICE_UNAVAILABLE',
            error: 'Registro online temporariamente indisponível'
          });
        }

        // Inserir usage_event
        const usageSource = (freeUsed < freeLimit) ? 'free' : 'extra';
        await supabase.from('usage_events').insert({
          user_id: user.id,
          dossier_id: publicId,
          usage_source: usageSource
        });

        if (usageSource === 'extra') {
          await supabase.from('seller_profiles').update({
            extra_credits: Math.max(0, extraCredits - 1)
          }).eq('id', user.id);
        }

        return res.json({
          success: true,
          dossierId: publicId,
          persistedToSupabase: true,
          idempotent: false,
          remainingCredits: Math.max(0, freeLimit - freeUsed - 1) + extraCredits
        });
      }

      console.error('[Supabase Error] Falha na execução da RPC:', rpcError);
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Registro online temporariamente indisponível'
      });
    }

    return res.json({
      success: true,
      dossierId: publicId,
      persistedToSupabase: true,
      idempotent: Boolean(rpcResult?.idempotent),
      remainingCredits: rpcResult?.remaining,
      account: rpcResult?.account
    });
  } catch (err: any) {
    console.error('Erro ao salvar dossiê:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao salvar dossiê.' });
  }
});

// Consulta pública de dossiê (verificação técnica independente)
app.get('/api/dossiers/:id', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id ? req.params.id.trim() : '';
    if (!rawId) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Serviço de verificação temporariamente indisponível' });
    }

    const { data, error } = await supabase
      .from('provapacks')
      .select('*')
      .or(`public_id.eq.${rawId},recording_id.eq.${rawId}`)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Error] Erro na consulta ao Supabase:', error.message);
      return res.status(503).json({ success: false, error: 'Erro ao consultar registro no banco de dados.' });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    return res.json({
      success: true,
      dossier: {
        id: data.public_id,
        public_id: data.public_id,
        recordingId: data.recording_id,
        recording_id: data.recording_id,
        marketplace: data.marketplace,
        orderNumber: data.order_number,
        order_number: data.order_number,
        trackingCode: data.tracking_code,
        tracking_code: data.tracking_code,
        productName: data.product_name,
        product_name: data.product_name,
        serialNumber: data.serial_number,
        serial_number: data.serial_number,
        recordedAt: data.recorded_at,
        recorded_at: data.recorded_at,
        durationSeconds: data.duration_seconds,
        duration_seconds: data.duration_seconds,
        originalSha256: data.original_sha256,
        original_sha256: data.original_sha256,
        processedSha256: data.processed_sha256,
        processed_sha256: data.processed_sha256,
        fileHashSha256: data.processed_sha256,
        fileSizeBytes: data.file_size_bytes,
        file_size_bytes: data.file_size_bytes,
        timezone: data.timezone,
        timeSource: data.time_source,
        status: data.status,
        verificationStatus: 'Registro online confirmado',
        created_at: data.created_at
      }
    });
  } catch (err: any) {
    console.error('Erro na consulta do dossiê:', err);
    return res.status(500).json({ success: false, error: 'Erro ao consultar registro.' });
  }
});

// AI candidate models with fallback sequence
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: any,
  systemInstruction?: string
): Promise<{ text: string; modelUsed: string } | null> {
  for (const model of CANDIDATE_MODELS) {
    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents,
        ...(systemInstruction ? { systemInstruction } : {})
      });

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout no modelo ${model}`)), 6000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isTemporaryDemand = errMsg.includes('503') || errMsg.includes('demand') || err?.status === 'UNAVAILABLE';
      if (isTemporaryDemand) {
        console.warn(`[ProvaPack AI] Modelo ${model} com pico de demanda temporário (503). Alternando...`);
      } else {
        console.warn(`[ProvaPack AI] Tentativa com ${model} retornou aviso: ${errMsg.slice(0, 100)}`);
      }
    }
  }
  return null;
}

// Structured formal defense generator fallback
function generateStructuredDefenseTemplate(dossier: any, claimType: string): string {
  const dateFormatted = dossier.recordedAt 
    ? new Date(dossier.recordedAt).toLocaleString('pt-BR') 
    : 'Data registrada no sistema';
  
  let specificArgument = '';
  switch (claimType) {
    case 'caixa_vazia_ou_item_faltando':
      specificArgument = `A alegação de que a encomenda foi recebida vazia ou com itens faltantes é materialmente contestada pela gravação ininterrupta ProvaPack. O vídeo sem cortes registra o produto ${dossier.productName} sendo devidamente posicionado no interior da embalagem protegida (${dossier.packageType || 'proteção reforçada'}), o fechamento completo da caixa com fita lacre e a imediata afixação da etiqueta de envio (${dossier.trackingCode || dossier.orderNumber}). O peso de postagem registrado na transportadora corrobora que a mercadoria física estava presente no despacho.`;
      break;
    case 'produto_trocado_ou_divergente':
      specificArgument = `A alegação de produto divergente ou trocado é categoricamente refutada pelo registro visual. O número de série e/ou IMEI (${dossier.serialNumber || 'conferido em vídeo no marco 3'}) foi registrado em close de alta definição tanto na embalagem original quanto no próprio chassi do aparelho, coincidindo estritamente com os dados do anúncio e da nota fiscal. Qualquer item recebido com número de série divergente configurará equívoco de conferência ou tentativa de devolução indevida.`;
      break;
    case 'produto_danificado_ou_nao_funciona':
      specificArgument = `O produto foi plenamente inspecionado e testado em bancada no marco 2 do dossiê (display ligado, LEDs e acionamento operacional documentados) antes de ser embalado. O acondicionamento utilizou proteção contra impactos (${dossier.packageType || 'plástico bolha e caixa resistente'}). Caso tenha ocorrido dano ou avaria física durante a rota de transporte, a responsabilidade deve ser coberta pelo seguro logístico da plataforma/transportadora, uma vez que o despacho foi efetuado em perfeito estado operacional e físico.`;
      break;
    case 'falta_acessorios':
      specificArgument = `Todos os acessórios correspondentes (${dossier.accessories || 'cabos, conectores e manuais originais'}) foram exibidos individualmente na bancada de empacotamento no marco 4, antes do lacre definitivo da embalagem.`;
      break;
    default:
      specificArgument = `O despacho do pedido ${dossier.orderNumber} foi registrado em gravação contínua auditada, documentando a integridade física do produto, a conferência do número de série, a presença dos acessórios e a rotulagem para a transportadora.`;
      break;
  }

  return `À Equipe de Moderação e Mediação do ${dossier.marketplace || 'Marketplace'},

Referência: Pedido nº ${dossier.orderNumber || 'N/A'} | Rastreamento: ${dossier.trackingCode || 'N/A'}
Produto: ${dossier.productName || 'N/A'}
Número de Série / IMEI: ${dossier.serialNumber || 'Registrado e conferido no dossiê'}

Apresentamos como contraprova material e documental o Dossiê Técnico Verificável ProvaPack nº ${dossier.id}, gravado de forma contínua e sem interrupções em ${dateFormatted}.

FUNDAMENTAÇÃO DA CONTRAPROVA:
${specificArgument}

ELEMENTOS TÉCNICOS AUDITADOS NO DOSSIÊ:
1. Gravação contínua sem cortes: ${dossier.durationSeconds || '60+'} segundos monitorados em bancada.
2. Marco de funcionamento: Produto testado operacionalmente antes do fechamento.
3. Identificação inequívoca: Número de série/IMEI exibido e conferido física e visualmente.
4. Lacração inviolável: Pacote fechado com fita de segurança, impedindo acesso sem violação perceptível.
5. Etiqueta oficial: Código de envio ${dossier.trackingCode || dossier.orderNumber} verificado diretamente no pacote lacrado.
6. Hash Criptográfico SHA-256 do arquivo original:
   ${dossier.fileHashSha256 || 'Assinatura computacional gravada'}

O Hash SHA-256 atesta matematicamente que o arquivo original não sofreu edição, corte ou substituição posterior. Diante da comprovação material inequívoca do envio em estrita conformidade, solicitamos:
a) A improcedência da reclamação e consequente liberação dos valores retidos em favor do vendedor;
b) Em caso de alegação de avaria no transporte ou extravio de conteúdo em rota, a cobertura pelo seguro de envio contratado junto ao marketplace.

Dossiê com fotos dos marcos, vídeo original e metadados disponível para conferência em:
${dossier.verificationUrl || 'https://provapack.app/verificar/' + dossier.id}`;
}

// AI OCR Analysis of label or serial snapshot
app.post('/api/ai/ocr-label', aiLimiter, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Imagem em base64 não fornecida.' });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        success: false,
        requiresManualInput: true,
        message: 'Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analise esta foto de etiqueta de envio ou identificação de produto de e-commerce brasileiro (Mercado Livre, Shopee, Amazon, Correios, Jadlog, Magalu).
Identifique com precisão:
1. Número do pedido (orderNumber)
2. Código de rastreamento (trackingCode)
3. Marketplace ou transportadora (carrier/marketplace: Mercado Livre, Shopee, Amazon, Correios, etc)
4. Número de série ou IMEI se visível (serialNumber)
5. Nome do produto ou descrição breve se identificável (productName)
6. Destinatário/Cidade se visível

Se um campo NÃO estiver visível ou não puder ser lido com certeza, retorne null para esse campo. NUNCA invente dados.
Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown de código e sem texto adicional), no seguinte formato:
{
  "orderNumber": "string ou null",
  "trackingCode": "string ou null",
  "marketplace": "string ou null",
  "serialNumber": "string ou null",
  "productName": "string ou null",
  "recipientSummary": "string ou null",
  "confidenceScore": 0.95
}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType
            }
          },
          {
            text: prompt
          }
        ]
      }
    ];

    const aiResult = await generateWithFallback(ai, contents);

    if (aiResult && aiResult.text) {
      const responseText = aiResult.text;
      let parsedData: any = null;
      try {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleaned);
      } catch {
        parsedData = null;
      }

      if (parsedData && typeof parsedData === 'object') {
        return res.json({ 
          success: true, 
          data: parsedData,
          modelUsed: aiResult.modelUsed
        });
      }
    }

    return res.json({
      success: false,
      requiresManualInput: true,
      message: 'Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.'
    });
  } catch (error: any) {
    console.warn('[ProvaPack OCR] Não foi possível ler etiqueta:', error?.message);
    return res.json({
      success: false,
      requiresManualInput: true,
      message: 'Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.'
    });
  }
});

// AI Dispute Defense Generator
app.post('/api/ai/dispute-defense', aiLimiter, async (req: Request, res: Response) => {
  try {
    const { dossier, claimType = 'caixa_vazia_ou_item_faltando' } = req.body;
    if (!dossier) {
      return res.status(400).json({ error: 'Dados do dossiê ausentes.' });
    }

    const ai = getAI();
    if (!ai) {
      const template = generateStructuredDefenseTemplate(dossier, claimType);
      return res.json({
        success: true,
        text: template,
        model: 'template_estruturado'
      });
    }

    const prompt = `Você é um especialista em mediação de disputas para vendedores de marketplaces (Mercado Livre, Shopee, Amazon, Magalu).
O vendedor está sofrendo uma alegação/disputa do tipo: "${claimType}".

Gere um texto formal, extremamente objetivo, educado e contundente para ser colado no campo de resposta da mediação ou recurso no marketplace.

DADOS DO DOSSIÊ PROVAPACK:
- ID do Dossiê: ${dossier.id}
- Marketplace: ${dossier.marketplace}
- Pedido: ${dossier.orderNumber}
- Rastreio: ${dossier.trackingCode}
- Produto: ${dossier.productName}
- Número de Série / IMEI: ${dossier.serialNumber || 'Conforme gravado'}
- Acessórios incluídos: ${dossier.accessories || 'Todos os itens originais'}
- Embalagem: ${dossier.packageType || 'Proteção reforçada'}
- Data/Hora do Empacotamento: ${dossier.recordedAt}
- Duração da gravação contínua sem cortes: ${dossier.durationSeconds} segundos
- Hash Criptográfico SHA-256 do arquivo original: ${dossier.fileHashSha256}
- Link de verificação: ${dossier.verificationUrl || 'https://provapack.app/verificar/' + dossier.id}

DIRETRIZES:
1. Cite explicitamente a existência da gravação contínua sem cortes e o Hash SHA-256 como garantia de não adulteração do vídeo.
2. Destaque o número de série e o passo a passo verificado (produto funcional, acessórios, acondicionamento, selo e etiqueta).
3. Seja respeitoso com a equipe de moderação e com o comprador, mas firme e fundamentado em provas materiais.
4. Inclua um parágrafo solicitando ao marketplace a recusa da queixa infundada ou a cobertura pelo seguro de envio.
5. Retorne apenas o texto formatado para envio direto na mediação.`;

    const aiResult = await generateWithFallback(ai, prompt);

    if (aiResult && aiResult.text) {
      return res.json({
        success: true,
        text: aiResult.text,
        model: aiResult.modelUsed
      });
    }

    const fallbackDefense = generateStructuredDefenseTemplate(dossier, claimType);
    return res.json({
      success: true,
      text: fallbackDefense,
      model: 'template_estruturado_contingencia'
    });
  } catch (error: any) {
    console.warn('[ProvaPack Defesa] Ativando modelo estruturado de contingência:', error?.message);
    const { dossier, claimType = 'caixa_vazia_ou_item_faltando' } = req.body;
    const fallbackDefense = generateStructuredDefenseTemplate(dossier || {}, claimType);
    return res.json({
      success: true,
      text: fallbackDefense,
      model: 'template_estruturado_contingencia'
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.resolve(process.cwd(), 'dist'))
      ? path.resolve(process.cwd(), 'dist')
      : path.resolve(process.cwd());
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Build de produção não encontrado. Execute npm run build antes de iniciar em produção.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProvaPack Server rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
