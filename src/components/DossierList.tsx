import React, { useState } from 'react';
import { 
  Search, Filter, FileText, Share2, Sparkles, ShieldCheck, 
  ExternalLink, Clock, Hash, Check, Eye, Package, ArrowUpRight 
} from 'lucide-react';
import { Dossier, Marketplace } from '../types';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/crypto';

interface DossierListProps {
  dossiers: Dossier[];
  onSelectDossier: (dossier: Dossier) => void;
  onOpenDispute: (dossier: Dossier) => void;
  onNewDossier: () => void;
}

export const DossierList: React.FC<DossierListProps> = ({
  dossiers,
  onSelectDossier,
  onOpenDispute,
  onNewDossier
}) => {
  const [search, setSearch] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = dossiers.filter((d) => {
    const matchesSearch = 
      d.productName.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (d.serialNumber && d.serialNumber.toLowerCase().includes(search.toLowerCase())) ||
      (d.trackingCode && d.trackingCode.toLowerCase().includes(search.toLowerCase()));

    const matchesMarketplace = 
      selectedMarketplace === 'todos' || d.marketplace === selectedMarketplace;

    return matchesSearch && matchesMarketplace;
  });

  const handleCopyLink = (dossier: Dossier, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}?verify=${dossier.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(dossier.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPdf = async (dossier: Dossier, e: React.MouseEvent) => {
    e.stopPropagation();
    await generateDossierPDF(dossier);
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto, pedido, IMEI / serial ou ID do dossiê..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedMarketplace}
            onChange={(e) => setSelectedMarketplace(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <option value="todos">Todos os Canais</option>
            <option value="Mercado Livre">Mercado Livre</option>
            <option value="Shopee">Shopee</option>
            <option value="Amazon Brasil">Amazon Brasil</option>
            <option value="Instagram / WhatsApp">Instagram / WhatsApp</option>
            <option value="TikTok Shop">TikTok Shop</option>
            <option value="Magalu">Magalu</option>
          </select>
        </div>
      </div>

      {/* Dossiers Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((dossier) => (
            <div
              key={dossier.id}
              onClick={() => onSelectDossier(dossier)}
              className="group cursor-pointer rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/80 p-5 transition-all hover:shadow-xl hover:shadow-sky-500/5 flex flex-col justify-between"
            >
              <div>
                {/* Header Tag Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/80 border border-sky-800/80 px-2 py-0.5 rounded-md">
                      {dossier.id}
                    </span>
                    <span className="text-[11px] font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                      {dossier.marketplace}
                    </span>
                  </div>

                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Íntegro
                  </span>
                </div>

                {/* Product & Order Title */}
                <h3 className="mt-3 text-base font-bold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                  {dossier.productName}
                </h3>

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span>Pedido: <strong className="text-slate-200">{dossier.orderNumber}</strong></span>
                  {dossier.trackingCode && (
                    <>
                      <span>•</span>
                      <span>Rastreio: <strong className="text-slate-200 font-mono">{dossier.trackingCode}</strong></span>
                    </>
                  )}
                </div>

                {/* Serial Highlight */}
                {dossier.serialNumber && (
                  <div className="mt-2 text-xs text-amber-300 font-mono bg-amber-950/30 border border-amber-900/50 px-2 py-1 rounded inline-block">
                    Serial/IMEI: {dossier.serialNumber}
                  </div>
                )}

                {/* Checkpoint mini filmstrip */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-medium">
                    <span>Roteiro de 7 Passos Concluído</span>
                    <span>{dossier.durationSeconds}s sem cortes</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {dossier.checkpoints?.slice(0, 7).map((cp, idx) => (
                      <div key={idx} className="relative aspect-video rounded overflow-hidden bg-slate-950 border border-slate-800">
                        <img src={cp.imageDataUrl} alt={cp.stepTitle} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 px-0.5 bg-black/80 text-[7px] font-mono text-sky-300">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cryptographic hash snippet */}
                <div className="mt-3 text-[10px] font-mono text-slate-400 truncate flex items-center gap-1">
                  <Hash className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">{dossier.fileHashSha256}</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(dossier.recordedAt).toLocaleDateString('pt-BR')}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleDownloadPdf(dossier, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Baixar PDF Oficial"
                  >
                    <FileText className="w-4 h-4 text-sky-400" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(dossier, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copiar Link de Compartilhamento"
                  >
                    {copiedId === dossier.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDispute(dossier);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Defesa IA</span>
                  </button>

                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold flex items-center gap-1"
                  >
                    <span>Ver</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800 p-8">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum dossiê encontrado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search ? 'Tente mudar os termos da busca.' : 'Inicie seu primeiro empacotamento guiado para gerar o dossiê verificável com vídeo e hash SHA-256.'}
          </p>
          <button
            onClick={onNewDossier}
            className="mt-4 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20"
          >
            Iniciar Primeiro Empacotamento
          </button>
        </div>
      )}
    </div>
  );
};
