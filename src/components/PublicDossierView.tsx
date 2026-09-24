import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Search, Hash, Clock, CheckCircle2, FileText, 
  ArrowLeft, ExternalLink, Video, Lock, Download,
  Maximize2, X, Check, ChevronDown, ChevronUp, Copy, Eye,
  ShieldAlert, Loader2
} from 'lucide-react';
import { Dossier, CheckpointFrame } from '../types';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/crypto';
import { getVideoBlobs } from '../utils/watermark';

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
  const [copiedHash, setCopiedHash] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(() => {
    if (initialDossierId) {
      return dossiers.find(d => 
        d.id.toLowerCase() === initialDossierId.toLowerCase() ||
        d.recordingId?.toLowerCase() === initialDossierId.toLowerCase()
      ) || null;
    }
    return dossiers[0] || null;
  });

  const fetchDossierFromApi = async (id: string): Promise<Dossier | null> => {
    try {
      const res = await fetch(`/api/dossiers/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.dossier) return null;
      const d = data.dossier;

      // Check if user has local matching blob data
      const localMatch = dossiers.find(loc => loc.id === (d.public_id || d.id) || loc.recordingId === (d.recording_id || d.recordingId));

      return {
        id: d.public_id || d.id,
        recordingId: d.recording_id || d.recordingId,
        marketplace: d.marketplace,
        orderNumber: d.order_number || d.orderNumber,
        trackingCode: d.tracking_code || d.trackingCode,
        productName: d.product_name || d.productName,
        serialNumber: d.serial_number || d.serialNumber,
        accessories: localMatch?.accessories || 'Conferidos na gravação contínua',
        packageType: localMatch?.packageType || 'Caixa lacrada com proteção',
        sellerName: localMatch?.sellerName || 'Expedidor ProvaPack',
        recordedAt: d.recorded_at || d.recordedAt,
        formattedDate: d.recorded_at ? new Date(d.recorded_at).toLocaleString('pt-BR') : '',
        durationSeconds: d.duration_seconds || d.durationSeconds || 0,
        fileHashSha256: d.processed_sha256 || d.fileHashSha256 || '',
        originalSha256: d.original_sha256 || d.originalSha256,
        processedSha256: d.processed_sha256 || d.processedSha256,
        fileSizeBytes: d.file_size_bytes || d.fileSizeBytes || 0,
        videoBlobUrl: localMatch?.videoBlobUrl,
        originalVideoBlobUrl: localMatch?.originalVideoBlobUrl,
        processedVideoBlobUrl: localMatch?.processedVideoBlobUrl,
        videoMimeType: localMatch?.videoMimeType || 'video/webm',
        checkpoints: localMatch?.checkpoints || d.checkpoints || [],
        status: d.status || 'validado',
        verificationStatus: 'Registro oficial Supabase',
        timeSource: d.time_source || 'DEVICE_WITH_SERVER_REFERENCE',
        timezone: d.timezone || 'America/Sao_Paulo',
        onlinePersisted: true
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (initialDossierId) {
      setSearchQuery(initialDossierId);
      const localFound = dossiers.find(d => 
        d.id.toLowerCase() === initialDossierId.toLowerCase() ||
        d.recordingId?.toLowerCase() === initialDossierId.toLowerCase()
      );
      if (localFound) {
        setSelectedDossier(localFound);
        setNotFoundError(null);
        return;
      }

      setIsLoading(true);
      fetchDossierFromApi(initialDossierId).then((apiDossier) => {
        setIsLoading(false);
        if (apiDossier) {
          setSelectedDossier(apiDossier);
          setNotFoundError(null);
        } else {
          setSelectedDossier(null);
          setNotFoundError(`Registro não encontrado para "${initialDossierId}".`);
        }
      });
    } else if (dossiers.length > 0) {
      setSelectedDossier(dossiers[0]);
      setNotFoundError(null);
    } else {
      setSelectedDossier(null);
    }
  }, [initialDossierId, dossiers]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsLoading(true);
    setNotFoundError(null);

    const localFound = dossiers.find(d => 
      d.id.toUpperCase() === query.toUpperCase() || 
      d.orderNumber.toUpperCase() === query.toUpperCase() ||
      (d.trackingCode && d.trackingCode.toUpperCase() === query.toUpperCase()) ||
      d.fileHashSha256.toUpperCase() === query.toUpperCase() ||
      (d.recordingId && d.recordingId.toUpperCase() === query.toUpperCase())
    );

    if (localFound) {
      setSelectedDossier(localFound);
      setIsLoading(false);
      return;
    }

    const apiDossier = await fetchDossierFromApi(query);
    setIsLoading(false);
    if (apiDossier) {
      setSelectedDossier(apiDossier);
      setNotFoundError(null);
    } else {
      setSelectedDossier(null);
      setNotFoundError(`Registro não encontrado para "${query}".`);
    }
  };

  const handleDownloadPdf = async (dossier: Dossier) => {
    setIsGeneratingPdf(true);
    try {
      await generateDossierPDF(dossier);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyHash = () => {
    if (!selectedDossier) return;
    const hashToCopy = selectedDossier.processedSha256 || selectedDossier.fileHashSha256;
    navigator.clipboard.writeText(hashToCopy);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const storedBlobs = selectedDossier ? getVideoBlobs(selectedDossier.id) : null;
  const fileExt = selectedDossier?.videoMimeType?.includes('mp4') ? 'mp4' : 'webm';
  const orderSlug = selectedDossier ? (selectedDossier.orderNumber || selectedDossier.id).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const processedUrl = selectedDossier?.processedVideoBlobUrl || (storedBlobs?.processed ? URL.createObjectURL(storedBlobs.processed) : selectedDossier?.videoBlobUrl);
  const originalUrl = selectedDossier?.originalVideoBlobUrl || (storedBlobs?.original ? URL.createObjectURL(storedBlobs.original) : null);

  const formattedDateClean = selectedDossier?.formattedDate?.replace(' (Horário de Brasília)', '') || '';
  const timeSourceLabel = selectedDossier?.timeSource === 'DEVICE_WITH_SERVER_REFERENCE'
    ? 'Dispositivo + referência do servidor'
    : 'Dispositivo';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <button
          onClick={onBackToApp}
          className="min-h-[44px] flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel ProvaPack</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Portal Público de Verificação
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block">
              Validação de integridade e registro técnico
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1240px] mx-auto mt-6">
        {/* Search bar for verifying any code */}
        <form onSubmit={handleSearch} className="mb-6 sm:mb-8">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o ID do Dossiê, Pedido ou Hash..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-28 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 shadow-xl min-h-[44px]"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow"
            >
              Consultar
            </button>
          </div>
        </form>

        {selectedDossier ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl">
            {/* Header: Identificação + Ação */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800/80">
                    {selectedDossier.id}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Registro Validado & Íntegro
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300">
                    {selectedDossier.marketplace}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight mt-2 break-words">
                  {selectedDossier.productName}
                </h1>

                <div className="mt-1.5 flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap">
                  <span>Pedido: <strong className="text-slate-200">{selectedDossier.orderNumber || 'Não especificado'}</strong></span>
                  {selectedDossier.trackingCode && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>Rastreio: <strong className="text-slate-200 font-mono">{selectedDossier.trackingCode}</strong></span>
                    </>
                  )}
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedDossier.formattedDate}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDownloadPdf(selectedDossier)}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors whitespace-nowrap active:scale-98"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar Relatório PDF'}</span>
              </button>
            </div>

            {/* Top Grid: Video & Information */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 mt-5 items-stretch">
              
              {/* Video Column (60-65%) */}
              <div className="lg:col-span-7 xl:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 p-3 sm:p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-sky-400" />
                      Reprodução do Vídeo com Marca d'Água Aplicada
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {selectedDossier.durationSeconds}s contínuos
                    </span>
                  </div>

                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                    {selectedDossier.videoBlobUrl ? (
                      <video
                        src={selectedDossier.videoBlobUrl}
                        poster={selectedDossier.checkpoints?.[0]?.imageDataUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    ) : selectedDossier.checkpoints?.[0]?.imageDataUrl ? (
                      <div 
                        className="relative w-full h-full cursor-pointer group"
                        onClick={() => setSelectedPhoto(selectedDossier.checkpoints[0])}
                      >
                        <img
                          src={selectedDossier.checkpoints[0].imageDataUrl}
                          alt={selectedDossier.productName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3.5 flex flex-col justify-between">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-white text-[10px] font-bold font-mono self-start shadow">
                            ✓ 7 PASSOS REGISTRADOS
                          </span>
                          <div className="flex items-end justify-between">
                            <span className="text-xs font-bold text-white">Quadro Inicial da Gravação</span>
                            <span className="text-[11px] font-semibold text-sky-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">Ampliar</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6">
                        <Video className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-xs text-slate-300 font-medium">Arquivo de vídeo arquivado e indexado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Footer */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Marca d'água aplicada aos frames</span>
                  </span>

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

              {/* Information Column (35-40%) */}
              <div className="lg:col-span-5 xl:col-span-5 bg-slate-950/70 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-800/80 pb-3">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Número de Série / IMEI
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-900/60 px-2.5 py-1 rounded-lg inline-block mt-1">
                      {selectedDossier.serialNumber || 'Conferido no fluxo do vídeo'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Acessórios e Componentes Inclusos
                    </span>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {selectedDossier.accessories || 'Todos os itens originais conferidos na gravação'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Embalagem e Proteção de Transporte
                    </span>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {selectedDossier.packageType || 'Caixa protetora com fita de lacre'}
                    </p>
                  </div>

                  {selectedDossier.notes && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Observações do Expedidor
                      </span>
                      <p className="text-xs text-slate-300 mt-1 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                        "{selectedDossier.notes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Expedidor: <strong className="text-white">{selectedDossier.sellerName}</strong></span>
                  <span className="text-emerald-400 font-medium">Autenticação Pública</span>
                </div>
              </div>
            </div>

            {/* Status Resumido */}
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
                  <span>{selectedDossier.checkpoints?.length || 0}/7 marcos registrados</span>
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

            {/* Checkpoints Grid */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Marcos Visuais (Roteiro em 7 Passos)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Quadros capturados da gravação comprovando cada etapa de embalagem.
                  </p>
                </div>
                <span className="text-xs text-sky-400 font-semibold font-mono">
                  {selectedDossier.checkpoints?.length || 0} de 7 passos capturados
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                {selectedDossier.checkpoints?.map((cp, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedPhoto(cp)}
                    className="group cursor-pointer rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 overflow-hidden flex flex-col transition-all min-w-0"
                  >
                    <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                      <img
                        src={cp.imageDataUrl}
                        alt={cp.stepTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-sky-400">
                        {cp.formattedTime}
                      </span>
                    </div>
                    <div className="p-2 flex-1 flex flex-col justify-between">
                      <span className="text-[11px] font-semibold text-slate-200 line-clamp-1 leading-snug">
                        {cp.stepTitle}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Passo {i + 1}</span>
                        <span className="text-sky-400 group-hover:underline">Ampliar</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expandable Technical Details */}
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
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedHash ? 'Hash Copiado!' : 'Copiar Hash'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider block">
                      SHA-256 do Vídeo ProvaPack (com carimbo aplicado nos frames)
                    </span>
                    <div className="mt-1 text-xs font-mono text-slate-200 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      {selectedDossier.processedSha256 || selectedDossier.fileHashSha256}
                    </div>
                  </div>

                  {selectedDossier.originalSha256 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        SHA-256 do Vídeo Original (arquivo bruto preservado)
                      </span>
                      <div className="mt-1 text-xs font-mono text-slate-300 break-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        {selectedDossier.originalSha256}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ID ProvaPack</span>
                    <span className="font-mono text-slate-200 font-semibold mt-0.5 block">{selectedDossier.id}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ID da Gravação</span>
                    <span className="font-mono text-slate-200 font-semibold mt-0.5 block">{selectedDossier.recordingId || selectedDossier.id}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Data e Hora</span>
                    <span className="text-slate-200 mt-0.5 block">{formattedDateClean}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fuso / Timezone</span>
                    <span className="text-slate-200 font-mono mt-0.5 block">{selectedDossier.timezoneOffsetFormatted || 'GMT-03:00'} ({selectedDossier.timezone || 'America/Sao_Paulo'})</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Fonte de Horário</span>
                    <span className="text-slate-200 mt-0.5 block">{timeSourceLabel}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duração Contínua</span>
                    <span className="text-slate-200 font-mono mt-0.5 block">{selectedDossier.durationSeconds} segundos</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tamanho do Arquivo</span>
                    <span className="text-slate-200 font-mono mt-0.5 block">{formatBytes(selectedDossier.fileSizeBytes)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Formato / Codec</span>
                    <span className="text-slate-200 font-mono mt-0.5 block">{selectedDossier.videoMimeType || 'video/webm'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso Legal Resumido */}
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

            {/* Photo Lightbox */}
            {selectedPhoto && (
              <div 
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
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
                  {selectedPhoto.note && (
                    <p className="text-xs text-slate-300 mt-2 font-mono">{selectedPhoto.note}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
            <span className="text-sm font-semibold text-slate-200">Consultando registro oficial no Supabase...</span>
          </div>
        ) : notFoundError ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg mx-auto shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Registro Não Encontrado (404)</h3>
            <p className="text-xs text-slate-400 mb-6">
              {notFoundError}
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-5">
              Nenhum dado técnico foi gerado ou cadastrado para este identificador.
            </div>
            <button
              onClick={() => { setNotFoundError(null); setSearchQuery(''); }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Fazer nova busca
            </button>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800 p-8">
            Nenhum dossiê selecionado. Utilize a busca acima com o ID do registro.
          </div>
        )}
      </div>
    </div>
  );
};
