import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '30mb' }));

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
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// In-memory runtime cache for registered dossiers
const registeredDossiers = new Map<string, any>();

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ProvaPack API', timestamp: new Date().toISOString() });
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

// Register or update dossier (Persists to Supabase with in-memory cache)
app.post('/api/dossiers', async (req: Request, res: Response) => {
  try {
    const dossier = req.body;
    if (!dossier || (!dossier.id && !dossier.public_id && !dossier.recordingId)) {
      return res.status(400).json({ success: false, error: 'Identificador do dossiê é obrigatório' });
    }

    const publicId = String(dossier.public_id || dossier.id || '').trim();
    const recordingId = String(dossier.recording_id || dossier.recordingId || publicId).trim();
    const originalSha256 = String(dossier.original_sha256 || dossier.originalSha256 || dossier.fileHashSha256 || '').trim();
    const processedSha256 = String(dossier.processed_sha256 || dossier.processedSha256 || originalSha256).trim();

    if (!originalSha256 || originalSha256.length !== 64 || /[^0-9a-fA-F]/.test(originalSha256)) {
      return res.status(400).json({ success: false, error: 'Hash SHA-256 original inválido.' });
    }

    if (!processedSha256 || processedSha256.length !== 64 || /[^0-9a-fA-F]/.test(processedSha256)) {
      return res.status(400).json({ success: false, error: 'Hash SHA-256 processado inválido.' });
    }

    // Normalized record for Supabase (NO sensitive customer personal data like buyer CPF, card, address)
    const payload = {
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

    // Store in memory cache
    registeredDossiers.set(publicId, { ...dossier, ...payload });
    if (recordingId && recordingId !== publicId) {
      registeredDossiers.set(recordingId, { ...dossier, ...payload });
    }

    // Persist to Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      const { error: dbError } = await supabase
        .from('provapacks')
        .upsert(payload, { onConflict: 'public_id' });

      if (dbError) {
        console.error('[Supabase Error] Falha ao registrar provapack:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Falha ao registrar no Supabase: ' + dbError.message,
          dossierId: publicId
        });
      }
    }

    return res.json({ 
      success: true, 
      dossierId: publicId,
      persistedToSupabase: !!supabase
    });
  } catch (err: any) {
    console.error('Erro ao salvar dossiê:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao salvar dossiê.' });
  }
});

// Get dossier by ID for public verification
app.get('/api/dossiers/:id', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id ? req.params.id.trim() : '';
    if (!rawId) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('provapacks')
        .select('*')
        .or(`public_id.eq.${rawId},recording_id.eq.${rawId}`)
        .maybeSingle();

      if (data && !error) {
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
            verificationStatus: 'Registro encontrado',
            created_at: data.created_at
          }
        });
      }
    }

    // Check runtime memory cache
    const cached = registeredDossiers.get(rawId);
    if (cached) {
      return res.json({
        success: true,
        dossier: {
          id: cached.public_id || cached.id,
          public_id: cached.public_id || cached.id,
          recordingId: cached.recording_id || cached.recordingId,
          recording_id: cached.recording_id || cached.recordingId,
          marketplace: cached.marketplace,
          orderNumber: cached.order_number || cached.orderNumber,
          order_number: cached.order_number || cached.orderNumber,
          trackingCode: cached.tracking_code || cached.trackingCode,
          tracking_code: cached.tracking_code || cached.trackingCode,
          productName: cached.product_name || cached.productName,
          product_name: cached.product_name || cached.productName,
          serialNumber: cached.serial_number || cached.serialNumber,
          serial_number: cached.serial_number || cached.serialNumber,
          recordedAt: cached.recorded_at || cached.recordedAt,
          recorded_at: cached.recorded_at || cached.recordedAt,
          durationSeconds: cached.duration_seconds || cached.durationSeconds,
          duration_seconds: cached.duration_seconds || cached.durationSeconds,
          originalSha256: cached.original_sha256 || cached.originalSha256,
          original_sha256: cached.original_sha256 || cached.originalSha256,
          processedSha256: cached.processed_sha256 || cached.processedSha256,
          processed_sha256: cached.processed_sha256 || cached.processedSha256,
          fileHashSha256: cached.processed_sha256 || cached.fileHashSha256,
          fileSizeBytes: cached.file_size_bytes || cached.fileSizeBytes,
          file_size_bytes: cached.file_size_bytes || cached.fileSizeBytes,
          timezone: cached.timezone,
          timeSource: cached.time_source || cached.timeSource,
          status: cached.status || 'validado',
          verificationStatus: 'Registro encontrado',
          created_at: cached.created_at || new Date().toISOString()
        }
      });
    }

    return res.status(404).json({ success: false, error: 'Registro não encontrado' });
  } catch (err: any) {
    console.error('Erro na consulta do dossiê:', err);
    return res.status(500).json({ success: false, error: 'Erro ao consultar registro.' });
  }
});

// AI candidate models with fallback sequence (prioritizing responsive flash-lite)
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

      // 6-second timeout per attempt to avoid hanging on 503 spikes
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout no modelo ${model}`)), 6000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      // 503 (model overloaded / high demand) or 429 rate limit
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
app.post('/api/ai/ocr-label', async (req: Request, res: Response) => {
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

    // Strip data URL prefix if present
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
app.post('/api/ai/dispute-defense', async (req: Request, res: Response) => {
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

    // Graceful structured defense if AI is unavailable (503 / high demand)
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProvaPack Server rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
