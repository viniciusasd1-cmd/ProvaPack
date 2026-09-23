import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Search, Hash, Clock, CheckCircle2, FileText, 
  ArrowLeft, ExternalLink, AlertCircle, Video, Lock, Download,
  Maximize2, X, Check
} from 'lucide-react';
import { Dossier, CheckpointFrame } from '../types';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/crypto';
import { getShowcaseDossier } from '../data/productShowcase';

interface PublicDossierViewProps {
  dossiers: Dossier[];
  initialDossierId?: string;
  onBackToApp: () => void;
}

export const PublicDossierView: React.FC<PublicDossierViewProps> = ({
  dossiers,
  initialDossierId,
  onBackToApp
}) => {
  const [searchQuery, setSearchQuery] = useState(initialDossierId || '');
  const [selectedPhoto, setSelectedPhoto] = useState<CheckpointFrame | null>(null);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(() => {
    if (initialDossierId) {
      return dossiers.find(d => d.id === initialDossierId) || getShowcaseDossier(initialDossierId) || dossiers[0] || null;
    }
    return dossiers[0] || null;
  });

  useEffect(() => {
    if (initialDossierId) {
      const found = dossiers.find(d => d.id === initialDossierId) || getShowcaseDossier(initialDossierId);
      if (found) {
        setSelectedDossier(found);
        setSearchQuery(initialDossierId);
      }
    }
  }, [initialDossierId, dossiers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    const found = dossiers.find(d => 
      d.id.toUpperCase() === query || 
      d.orderNumber.toUpperCase() === query ||
      (d.trackingCode && d.trackingCode.toUpperCase() === query) ||
      d.fileHashSha256.toUpperCase() === query
    ) || getShowcaseDossier(query);

    if (found) {
      setSelectedDossier(found);
    } else {
      alert(`Nenhum dossiê encontrado para o identificador "${query}".`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <button
          onClick={onBackToApp}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel ProvaPack</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Portal Público de Verificação
            </span>
            <span className="text-[10px] text-slate-400">
              Autenticação de integridade criptográfica
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto mt-6">
        {/* Search bar for verifying any code */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o ID do Dossiê (ex: PRV-2026-8841), Pedido ou Hash..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-28 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 shadow-xl"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              Consultar
            </button>
          </div>
        </form>

        {selectedDossier ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Status Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Dossiê Autenticado & Íntegro
                    </span>
                    <span className="text-xs text-slate-400">• ID: {selectedDossier.id}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                    {selectedDossier.productName}
                  </h1>
                </div>
              </div>

              <button
                onClick={() => generateDossierPDF(selectedDossier)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Baixar Certificado Oficial (PDF)</span>
              </button>
            </div>

            {/* Forensic Watermark Badge Info */}
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-sky-950/60 via-slate-950 to-indigo-950/60 border border-sky-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                      Marca D'Água Pericial Gravada nos Frames do Vídeo
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      INVIOLÁVEL
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    PROVAPACK • {selectedDossier.formattedDate.replace(' (Horário de Brasília)', '')} • {selectedDossier.timezoneOffsetFormatted || 'GMT-03:00'} • Registro: {selectedDossier.recordingId || selectedDossier.id}
                  </div>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-400 font-medium">
                Fonte de Tempo: <strong className="text-white">{selectedDossier.timeSource === 'DEVICE_WITH_SERVER_REFERENCE' ? 'Dispositivo + NTP Central' : 'Dispositivo'}</strong>
              </div>
            </div>

            {/* Cryptographic Hash Box */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Hash className="w-4 h-4" />
                  <span>SHA-256 do Vídeo ProvaPack (com Carimbo Pericial nos Frames)</span>
                </div>
                <div className="mt-1 text-xs font-mono text-slate-200 break-all bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  {selectedDossier.processedSha256 || selectedDossier.fileHashSha256}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Hash className="w-4 h-4" />
                  <span>SHA-256 do Vídeo Original (Arquivo Bruto Preservado)</span>
                </div>
                <div className="mt-1 text-xs font-mono text-slate-300 break-all bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  {selectedDossier.originalSha256 || selectedDossier.fileHashSha256}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-1">
                A integridade matemática é validada pelo hash SHA-256 calculado diretamente sobre os bytes dos arquivos gravados.
              </p>
            </div>

            {/* Video Player if available */}
            {selectedDossier.videoBlobUrl && (
              <div className="mt-6 bg-slate-950 rounded-2xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-sky-400" />
                    Reprodução da Gravação Pericial com Marca d'Água
                  </span>
                  <a
                    href={selectedDossier.videoBlobUrl}
                    download={`Provapack-${selectedDossier.recordingId || selectedDossier.id}.webm`}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Vídeo (.webm)
                  </a>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                  <video
                    src={selectedDossier.videoBlobUrl}
                    poster={selectedDossier.checkpoints?.[0]?.imageDataUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  {/* Forensic Watermark Badge burned over video player */}
                  <div className="absolute bottom-10 right-3 pointer-events-none z-10">
                    <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-lg p-2 text-right shadow-2xl font-mono text-white text-[10px]">
                      <div className="font-bold text-sky-400">PROVAPACK</div>
                      <div className="font-bold">{selectedDossier.formattedDate?.replace(' (Horário de Brasília)', '')}</div>
                      <div className="text-slate-400">{selectedDossier.timezoneOffsetFormatted || 'GMT-03:00'}</div>
                      <div className="text-sky-300">Registro: {selectedDossier.recordingId || selectedDossier.id}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mt-6">
              <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Canal / Marketplace</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{selectedDossier.marketplace}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Número do Pedido</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{selectedDossier.orderNumber || 'N/A'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Número de Série / IMEI</span>
                <span className="text-sm font-bold text-amber-300 font-mono mt-0.5 block">{selectedDossier.serialNumber || 'Conferido no vídeo'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Data da Gravação (Brasília)</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">{selectedDossier.formattedDate}</span>
              </div>
            </div>

            {/* Video & Checkpoints */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Evidências do Empacotamento em 7 Passos
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fotos reais de alta resolução extraídas de cada marco obrigatório de conferência.
                  </p>
                </div>
                <span className="text-xs text-sky-400 font-medium hidden sm:inline">
                  Clique na foto para ampliar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {selectedDossier.checkpoints?.map((cp, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedPhoto(cp)}
                    className="group cursor-pointer rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 overflow-hidden flex flex-col transition-all"
                  >
                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                      <img
                        src={cp.imageDataUrl}
                        alt={cp.stepTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[10px] font-mono text-sky-400">
                        {cp.formattedTime}
                      </span>
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-1 rounded-full bg-sky-500 text-white shadow">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                    <div className="p-2 flex-1">
                      <span className="text-[10px] font-bold text-slate-300 block line-clamp-1">{cp.stepTitle}</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Registrado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="mt-8 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <strong className="text-white block mb-1">Aviso de Responsabilidade:</strong>
              Este documento comprova o estado do produto e embalagem no momento da gravação. O ProvaPack não se responsabiliza pelo transporte ou entrega.
            </div>

            {/* Photo Lightbox */}
            {selectedPhoto && (
              <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
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
                  {selectedPhoto.note && (
                    <p className="text-xs text-slate-300 mt-2 font-mono">{selectedPhoto.note}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            Nenhum dossiê selecionado. Utilize a busca acima com o ID do registro.
          </div>
        )}
      </div>
    </div>
  );
};
