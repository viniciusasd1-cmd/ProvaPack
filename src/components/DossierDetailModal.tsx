import React, { useState } from 'react';
import { 
  X, Download, Share2, FileText, ShieldCheck, Check, Copy, 
  ExternalLink, Sparkles, Clock, Hash, AlertTriangle, Eye, Video
} from 'lucide-react';
import { Dossier, CheckpointFrame } from '../types';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/crypto';

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

  if (!isOpen || !dossier) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(dossier.fileHashSha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyLink = () => {
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-2.5 sm:p-4 bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl my-3 sm:my-6">
        <button
          onClick={onClose}
          id="btn-close-dossier"
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-10 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-950 text-sky-400 border border-sky-800">
                {dossier.id}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {dossier.verificationStatus || 'Registro Validado'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                {dossier.marketplace}
              </span>
            </div>

            <h2 className="mt-2 text-xl sm:text-2xl font-bold text-white tracking-tight">
              {dossier.productName}
            </h2>

            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span>Pedido: <strong className="text-slate-200">{dossier.orderNumber || 'Não especificado'}</strong></span>
              {dossier.trackingCode && (
                <>
                  <span>•</span>
                  <span>Rastreio: <strong className="text-slate-200">{dossier.trackingCode}</strong></span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {dossier.formattedDate}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              id="btn-download-pdf"
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              id="btn-copy-dossier-link"
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
            </button>

            <button
              onClick={() => onOpenDispute(dossier)}
              id="btn-open-dispute-ai"
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gerar Defesa de Disputa</span>
            </button>
          </div>
        </div>

        {/* Cryptographic SHA-256 Dual Hash & Forensic Watermark Display */}
        <div className="mt-5 space-y-3">
          {/* Forensic Watermark Badge Info */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/60 via-slate-950 to-indigo-950/60 border border-sky-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                    Marca D'Água Pericial Gravada nos Frames
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    INVIOLÁVEL
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono mt-0.5">
                  PROVAPACK • {dossier.formattedDate.replace(' (Horário de Brasília)', '')} • {dossier.timezoneOffsetFormatted || 'GMT-03:00'} • Registro: {dossier.recordingId || dossier.id}
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-400 font-medium">
              Fonte Temporal: <strong className="text-white">{dossier.timeSource === 'DEVICE_WITH_SERVER_REFERENCE' ? 'Dispositivo + NTP Central' : 'Dispositivo'}</strong>
            </div>
          </div>

          {/* Cryptographic Hash Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden w-full sm:w-auto min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4" />
              </div>
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                  <span>Hash SHA-256 (Vídeo com Marca D'Água Pericial)</span>
                  <span className="text-[10px] text-slate-400 font-normal">({dossier.durationSeconds}s • {formatBytes(dossier.fileSizeBytes)})</span>
                </div>
                <div className="text-xs font-mono text-slate-300 truncate mt-0.5" title={dossier.fileHashSha256}>
                  {dossier.fileHashSha256}
                </div>
                {dossier.originalSha256 && dossier.originalSha256 !== dossier.fileHashSha256 && (
                  <div className="text-[11px] font-mono text-slate-400 truncate mt-1" title={dossier.originalSha256}>
                    SHA-256 Original Preservado: <span className="text-slate-300">{dossier.originalSha256}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleCopyHash}
              id="btn-copy-hash"
              className="w-full sm:w-auto shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1 border border-slate-700 transition-colors whitespace-nowrap"
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? 'Copiado!' : 'Copiar Hash'}</span>
            </button>
          </div>
        </div>

        {/* Video & Technical Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          {/* Video Player Column */}
          <div className="lg:col-span-6 bg-slate-950 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-sky-400" />
                Evidência em Vídeo Ininterrupto
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {dossier.durationSeconds} segundos contínuos
              </span>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center group">
              {dossier.videoBlobUrl ? (
                <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                  <video
                    src={dossier.videoBlobUrl}
                    poster={dossier.checkpoints?.[0]?.imageDataUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  {/* Forensic Watermark Badge burned over video player */}
                  <div className="absolute bottom-10 right-3 pointer-events-none z-10">
                    <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-lg p-2 text-right shadow-2xl font-mono text-white text-[10px]">
                      <div className="font-bold text-sky-400">PROVAPACK</div>
                      <div className="font-bold">{dossier.formattedDate?.replace(' (Horário de Brasília)', '')}</div>
                      <div className="text-slate-400">{dossier.timezoneOffsetFormatted || 'GMT-03:00'}</div>
                      <div className="text-sky-300">Registro: {dossier.recordingId || dossier.id}</div>
                    </div>
                  </div>
                </div>
              ) : dossier.checkpoints?.[0]?.imageDataUrl ? (
                <div className="relative w-full h-full cursor-pointer" onClick={() => setSelectedPhoto(dossier.checkpoints[0])}>
                  <img
                    src={dossier.checkpoints[0].imageDataUrl}
                    alt={dossier.productName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60 p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/90 text-white text-[10px] font-bold font-mono shadow">
                        REC • ININTERRUPTO
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/90 text-white text-[10px] font-bold font-mono shadow">
                        ✓ 7 PASSOS COBERTOS
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-white block drop-shadow-md">
                          Quadro Inicial da Gravação
                        </span>
                        <span className="text-[10px] text-slate-300 font-mono drop-shadow">
                          {dossier.durationSeconds}s sem cortes • Hash SHA-256 verificado
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-sky-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700/80">
                        Ampliar Foto
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Video className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">Arquivo de vídeo arquivado e indexado</p>
                  <p className="text-[11px] text-slate-400 mt-1">Hash SHA-256 verificado com sucesso</p>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Marca d'água pericial incorporada aos frames
              </span>
              {dossier.videoBlobUrl && (
                <a
                  href={dossier.videoBlobUrl}
                  download={`Provapack-${dossier.recordingId || dossier.orderNumber || dossier.id}.webm`}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar Vídeo (.webm)</span>
                </a>
              )}
            </div>
          </div>

          {/* Technical Data Specification Column */}
          <div className="lg:col-span-6 bg-slate-850/60 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Número de Série / IMEI Registrado:
                </span>
                <span className="text-sm font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-900/60 px-2 py-1 rounded inline-block mt-1">
                  {dossier.serialNumber || 'Conferido no fluxo do vídeo'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Acessórios e Componentes Inclusos:
                </span>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {dossier.accessories || 'Todos os itens originais conferidos na gravação'}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Embalagem e Proteção de Transporte:
                </span>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {dossier.packageType || 'Caixa protetora com fita de lacre'}
                </p>
              </div>

              {dossier.notes && (
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                    Observações do Expedidor:
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5 italic">
                    "{dossier.notes}"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Expedidor: <strong className="text-white">{dossier.sellerName}</strong></span>
              <button
                onClick={() => onViewPublic(dossier.id)}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Página de Validação Pública</span>
              </button>
            </div>
          </div>
        </div>

        {/* 7 Checkpoint Frames Gallery */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Marcos Visuais Extraídos Automaticamente (Roteiro em 7 Passos)
              </h3>
              <p className="text-xs text-slate-400">
                Quadros congelados da gravação contínua comprovando cada etapa de embalagem.
              </p>
            </div>
            <span className="text-xs text-sky-400 font-semibold">
              {dossier.checkpoints?.length || 0} de 7 passos capturados
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {dossier.checkpoints?.map((frame, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPhoto(frame)}
                className="group cursor-pointer rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 overflow-hidden transition-all flex flex-col"
              >
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
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

        {/* Legal Disclaimer Box */}
        <div className="mt-6 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Aviso Legal & Termos de Uso:</strong> O ProvaPack atua como uma ferramenta técnica de documentação e prova-como-serviço para aumentar a credibilidade do vendedor perante disputas de frete e devoluções. A plataforma não garante aceitação mandatória ou ganho de causa por terceiros (Mercado Livre, Shopee, Amazon ou transportadoras), os quais possuem suas próprias regras de arbitragem.
          </p>
        </div>

        {/* Photo Lightbox Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
            <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl p-4 border border-slate-800">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-white mb-2">{selectedPhoto.stepTitle} ({selectedPhoto.formattedTime})</h4>
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
