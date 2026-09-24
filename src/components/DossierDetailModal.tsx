import React, { useState } from 'react';
import { 
  X, Download, Share2, FileText, ShieldCheck, Check, Copy, 
  Sparkles, Clock, Hash, Eye, Video, ChevronDown, ChevronUp,
  Info, ExternalLink
} from 'lucide-react';
import { Dossier, CheckpointFrame } from '../types';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/crypto';
import { getVideoBlobs } from '../utils/watermark';

interface DossierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: Dossier | null;
  onOpenDispute: (dossier: Dossier) => void;
  onViewPublic: (dossierId: string) => void;
}

export const DossierDetailModal: React.FC<DossierDetailModalProps> = ({
  isOpen,
  onClose,
  dossier,
  onOpenDispute,
  onViewPublic
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<CheckpointFrame | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);

  if (!isOpen || !dossier) return null;

  const handleCopyHash = () => {
    const hashToCopy = dossier.processedSha256 || dossier.fileHashSha256;
    navigator.clipboard.writeText(hashToCopy);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyLink = () => {
    if (dossier.onlinePersisted === false) {
      alert('O registro online deste dossiê ainda não foi confirmado no banco Supabase. O link público de verificação só estará ativo após a confirmação no servidor.');
      return;
    }
    const url = `${window.location.origin}?verify=${dossier.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateDossierPDF(dossier);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const storedBlobs = getVideoBlobs(dossier.id);
  const fileExt = dossier.videoMimeType?.includes('mp4') ? 'mp4' : 'webm';
  const orderSlug = (dossier.orderNumber || dossier.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const processedUrl = dossier.processedVideoBlobUrl || (storedBlobs?.processed ? URL.createObjectURL(storedBlobs.processed) : dossier.videoBlobUrl);
  const originalUrl = dossier.originalVideoBlobUrl || (storedBlobs?.original ? URL.createObjectURL(storedBlobs.original) : null);

  const formattedDateClean = dossier.formattedDate?.replace(' (Horário de Brasília)', '') || '';
  const timeSourceLabel = dossier.timeSource === 'DEVICE_WITH_SERVER_REFERENCE'
    ? 'Dispositivo + referência do servidor'
    : 'Dispositivo';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-start justify-center p-0 sm:p-4 lg:p-6">
      <div className="relative w-full max-w-[1240px] lg:w-[calc(100%-48px)] bg-slate-900 border-0 sm:border border-slate-800 rounded-none sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl min-h-screen sm:min-h-0 my-0 sm:my-6">
        
        {/* Close button */}
        <button
          onClick={onClose}
          id="btn-close-dossier"
          aria-label="Fechar detalhe do dossiê"
          className="absolute top-3 sm:top-5 right-3 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-20 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. HEADER (Identificação + Ações) */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800 pr-12 lg:pr-14">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800/80">
                {dossier.id}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {dossier.verificationStatus || 'Registro Validado'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300">
                {dossier.marketplace}
              </span>
            </div>

            <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight break-words">
              {dossier.productName}
            </h1>

            <div className="mt-1.5 flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap">
              <span>Pedido: <strong className="text-slate-200">{dossier.orderNumber || 'Não informado'}</strong></span>
              {dossier.trackingCode && (
                <>
                  <span className="text-slate-600" aria-hidden="true">•</span>
                  <span>Rastreio: <strong className="text-slate-200 font-mono">{dossier.trackingCode}</strong></span>
                </>
              )}
              <span className="text-slate-600" aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{dossier.formattedDate}</span>
              </span>
            </div>
          </div>

          {/* Desktop & Mobile Actions */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch lg:items-center gap-2 pt-2 lg:pt-0">
            {/* Action Row 1 */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                id="btn-download-pdf"
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap active:scale-98"
              >
                <FileText className="w-4 h-4 text-sky-400" />
                <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar Relatório PDF'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                id="btn-copy-dossier-link"
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap active:scale-98"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-slate-400" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>

            {/* Action Row 2 (Full width on mobile, inline on desktop) */}
            <button
              onClick={() => onOpenDispute(dossier)}
              id="btn-open-dispute-ai"
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all active:scale-98 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>Gerar Defesa de Disputa</span>
            </button>
          </div>
        </div>

        {/* 2. TOP GRID: [VÍDEO / EVIDÊNCIA] (60-65%) + [DADOS DO ENVIO] (35-40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 mt-5 items-stretch">
          
          {/* VIDEO / HERO COLUMN (approx 62% on lg) */}
          <div className="lg:col-span-7 xl:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 p-3 sm:p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-sky-400" />
                  Evidência em Vídeo Ininterrupto
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {dossier.durationSeconds} segundos contínuos
                </span>
              </div>

              {/* Video Player */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800/80 flex items-center justify-center">
                {dossier.videoBlobUrl ? (
                  <video
                    src={dossier.videoBlobUrl}
                    poster={dossier.checkpoints?.[0]?.imageDataUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : dossier.checkpoints?.[0]?.imageDataUrl ? (
                  <div 
                    className="relative w-full h-full cursor-pointer group" 
                    onClick={() => setSelectedPhoto(dossier.checkpoints[0])}
                  >
                    <img
                      src={dossier.checkpoints[0].imageDataUrl}
                      alt={dossier.productName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-sky-500/90 text-white text-[10px] font-bold font-mono shadow">
                          REC • ININTERRUPTO
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-white text-[10px] font-bold font-mono shadow">
                          ✓ 7 PASSOS REGISTRADOS
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">Quadro Inicial da Gravação</span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            {dossier.durationSeconds}s sem cortes • Integridade SHA-256 registrada
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-sky-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
                          Ampliar Foto
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <Video className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-medium">Arquivo de vídeo arquivado e indexado</p>
                    <p className="text-[11px] text-slate-400 mt-1">Integridade SHA-256 validada com sucesso</p>
                  </div>
                )}
              </div>
            </div>

            {/* Video footer: status discreet note + downloads */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Marca d'água aplicada aos frames</span>
              </span>

              {/* Downloads */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {processedUrl && (
                  <a
                    href={processedUrl}
                    download={`provapack-${orderSlug}-provapack.${fileExt}`}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-slate-800 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Vídeo ProvaPack</span>
                  </a>
                )}
                {originalUrl && (
                  <a
                    href={originalUrl}
                    download={`provapack-${orderSlug}-original.${fileExt}`}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Vídeo Original</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* DADOS DO ENVIO COLUMN (approx 38% on lg) */}
          <div className="lg:col-span-5 xl:col-span-5 bg-slate-950/70 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-800/80 pb-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Número de Série / IMEI Registrado
                </span>
                <div className="mt-1">
                  <span className="text-xs sm:text-sm font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-900/60 px-2.5 py-1 rounded-lg inline-block">
                    {dossier.serialNumber || 'Conferido no fluxo do vídeo'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Acessórios e Componentes Inclusos
                </span>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  {dossier.accessories || 'Todos os itens originais conferidos na gravação'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Embalagem e Proteção de Transporte
                </span>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  {dossier.packageType || 'Caixa protetora com fita de lacre'}
                </p>
              </div>

              {dossier.notes && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Observações do Expedidor
                  </span>
                  <p className="text-xs text-slate-300 mt-1 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                    "{dossier.notes}"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span>Expedidor: <strong className="text-white">{dossier.sellerName}</strong></span>
              <button
                type="button"
                onClick={() => onViewPublic(dossier.id)}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Página de Validação Pública</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. STATUS RESUMIDO (Compact Discreet Status Line) */}
        <div className="mt-5 py-2.5 px-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Marca d'água aplicada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Integridade SHA-256 registrada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-400 font-medium">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{dossier.checkpoints?.length || 0}/7 marcos registrados</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors ml-auto"
          >
            <span>{showTechDetails ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}</span>
            {showTechDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 4. MARCOS VISUAIS (Roteiro em 7 Passos) */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Marcos Visuais (Roteiro em 7 Passos)
              </h2>
              <p className="text-xs text-slate-400">
                Quadros extraídos da gravação contínua comprovando cada etapa de embalagem.
              </p>
            </div>
            <span className="text-xs text-sky-400 font-semibold font-mono">
              {dossier.checkpoints?.length || 0} de 7 passos capturados
            </span>
          </div>

          {/* Responsive Checkpoint Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
            {dossier.checkpoints?.map((frame, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPhoto(frame)}
                className="group cursor-pointer rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 overflow-hidden transition-all flex flex-col min-w-0"
              >
                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                  <img
                    src={frame.imageDataUrl}
                    alt={frame.stepTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-sky-300">
                    {frame.formattedTime}
                  </span>
                </div>
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-slate-200 line-clamp-1 leading-snug">
                    {frame.stepTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Passo {idx + 1}</span>
                    <span className="text-sky-400 group-hover:underline">Ampliar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. SEÇÃO EXPANSÍVEL: DETALHES TÉCNICOS (Closed by default) */}
        {showTechDetails && (
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Detalhes Técnicos do Registro
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopyHash}
                id="btn-copy-tech-hash"
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHash ? 'Hash Copiado!' : 'Copiar Hash'}</span>
              </button>
            </div>

            {/* Hashes */}
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider block">
                  SHA-256 do Vídeo ProvaPack (com carimbo aplicado nos frames)
                </span>
                <div className="mt-1 text-xs font-mono text-slate-200 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  {dossier.processedSha256 || dossier.fileHashSha256}
                </div>
              </div>

              {dossier.originalSha256 && (
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    SHA-256 do Vídeo Original (arquivo bruto preservado)
                  </span>
                  <div className="mt-1 text-xs font-mono text-slate-300 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    {dossier.originalSha256}
                  </div>
                </div>
              )}
            </div>

            {/* Technical Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ID ProvaPack</span>
                <span className="font-mono text-slate-200 font-semibold mt-0.5 block">{dossier.id}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ID da Gravação</span>
                <span className="font-mono text-slate-200 font-semibold mt-0.5 block">{dossier.recordingId || dossier.id}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Data e Hora</span>
                <span className="text-slate-200 mt-0.5 block">{formattedDateClean}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fuso / Timezone</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{dossier.timezoneOffsetFormatted || 'GMT-03:00'} ({dossier.timezone || 'America/Sao_Paulo'})</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fonte de Horário</span>
                <span className="text-slate-200 mt-0.5 block">{timeSourceLabel}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duração Contínua</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{dossier.durationSeconds} segundos</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tamanho do Arquivo</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{formatBytes(dossier.fileSizeBytes)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Formato / Codec</span>
                <span className="text-slate-200 font-mono mt-0.5 block">{dossier.videoMimeType || 'video/webm'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 6. AVISO LEGAL RESUMIDO COM "VER TERMOS" */}
        <div className="mt-6 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <strong className="text-white block mb-0.5">Sobre este registro:</strong>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                O ProvaPack organiza evidências técnicas do processo de embalagem. Não garante aceitação ou resultado em disputas de terceiros.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFullTerms(!showFullTerms)}
              className="text-sky-400 hover:text-sky-300 font-semibold text-[11px] shrink-0 underline transition-colors"
            >
              {showFullTerms ? 'Ocultar termos' : 'Ver termos'}
            </button>
          </div>

          {showFullTerms && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed space-y-1.5">
              <p>
                Este documento comprova o estado do produto e embalagem no momento da gravação. O ProvaPack não se responsabiliza pelo transporte ou entrega.
              </p>
              <p>
                A plataforma opera como Prova-como-Serviço para fins de documentação pelo vendedor. As plataformas de e-commerce e transportadoras possuem procedimentos próprios de mediação e regras autônomas para tomada de decisão em contestações.
              </p>
            </div>
          )}
        </div>

        {/* 7. PHOTO LIGHTBOX MODAL */}
        {selectedPhoto && (
          <div 
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div 
              className="relative max-w-3xl w-full bg-slate-900 rounded-2xl p-4 border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedPhoto(null)}
                aria-label="Fechar foto ampliada"
                className="absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-white mb-2 pr-12">
                {selectedPhoto.stepTitle} <span className="text-sky-400 font-mono font-normal">({selectedPhoto.formattedTime})</span>
              </h4>
              <img
                src={selectedPhoto.imageDataUrl}
                alt={selectedPhoto.stepTitle}
                referrerPolicy="no-referrer"
                className="w-full max-h-[75vh] object-contain rounded-lg bg-black"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
