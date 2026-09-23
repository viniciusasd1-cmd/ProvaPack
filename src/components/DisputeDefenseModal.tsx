import React, { useState } from 'react';
import { X, Copy, Check, Sparkles, ShieldAlert, Bot, RefreshCw, ExternalLink } from 'lucide-react';
import { Dossier } from '../types';

interface DisputeDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: Dossier;
}

export const DisputeDefenseModal: React.FC<DisputeDefenseModalProps> = ({
  isOpen,
  onClose,
  dossier
}) => {
  const [claimType, setClaimType] = useState('caixa_vazia_ou_item_faltando');
  const [loading, setLoading] = useState(false);
  const [defenseText, setDefenseText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async (selectedClaim = claimType) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/dispute-defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier,
          claimType: selectedClaim
        })
      });

      if (!res.ok) throw new Error('Falha na resposta');
      const data = await res.json();
      setDefenseText(data.text || '');
    } catch {
      // Fallback template
      const fallback = `À Equipe de Moderação e Mediação do ${dossier.marketplace || 'Marketplace'},

Referente à contestação do Pedido nº ${dossier.orderNumber || 'N/A'} (Rastreio: ${dossier.trackingCode || 'N/A'})
Produto: ${dossier.productName}
Identificador / Serial / IMEI: ${dossier.serialNumber || 'Conferido em vídeo'}

Apresentamos como prova material o Dossiê Técnico Verificável ProvaPack nº ${dossier.id}, gravado de forma ininterrupta e contínua em ${dossier.formattedDate || new Date(dossier.recordedAt).toLocaleString('pt-BR')}.

Evidências registradas no fluxo sem cortes (${dossier.durationSeconds} segundos):
1. Produto 100% íntegro e em perfeito funcionamento comprovado visualmente.
2. Número de série e identificadores gravados no chassi e na caixa conferidos.
3. Inclusão de todos os acessórios listados: ${dossier.accessories || 'Todos os itens originais'}.
4. Acondicionamento seguro e lacração da embalagem com fita de lacre.
5. Etiqueta de despacho conferida com o código de rastreamento da transação.
6. Integridade SHA-256 da gravação original: ${dossier.fileHashSha256}

O arquivo original possui integridade validada pelo hash informado.
Diante da evidência do envio em perfeito estado e devidamente lacrado, solicitamos o encerramento da disputa em favor do vendedor ou acionamento do seguro de frete.

Dossiê completo e fotos dos quadros disponíveis em anexo (PDF) e no link de verificação:
https://provapack.app/verificar/${dossier.id}`;

      setDefenseText(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Initial trigger if empty
  if (!defenseText && !loading) {
    handleGenerate(claimType);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(defenseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center">
      <div className="relative w-full max-w-2xl bg-slate-900 border-0 sm:border border-slate-800 rounded-none sm:rounded-3xl p-4 sm:p-7 shadow-2xl min-h-screen sm:min-h-0 my-0 sm:my-8">
        <button
          onClick={onClose}
          id="btn-close-dispute"
          aria-label="Fechar assistente de defesa"
          className="absolute top-3 sm:top-5 right-3 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Assistente de Defesa em Disputas</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                IA ProvaPack
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gera texto formal embasado nos dados do dossiê para responder à mediação do {dossier.marketplace}.
            </p>
          </div>
        </div>

        {/* Claim Selector */}
        <div className="mt-5">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Qual a alegação do comprador ou motivo da disputa?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { id: 'caixa_vazia_ou_item_faltando', label: 'Caixa Vazia ou Item Faltando' },
              { id: 'produto_trocado_ou_divergente', label: 'Produto Trocado ou Serial Divergente' },
              { id: 'produto_danificado_ou_nao_funciona', label: 'Alegação de Defeito / Não Liga' },
              { id: 'falta_acessorios', label: 'Faltam Peças / Acessórios / Cabos' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => {
                  setClaimType(type.id);
                  handleGenerate(type.id);
                }}
                className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  claimType === type.id
                    ? 'bg-sky-950/60 border-sky-500 text-sky-200 shadow-sm'
                    : 'bg-slate-850/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Defense Output Box */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              Texto formatado para o campo de mediação:
            </span>
            <button
              onClick={() => handleGenerate(claimType)}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Regerar</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={11}
              value={defenseText}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 selection:bg-sky-500/30 leading-relaxed resize-none"
            />
            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-xs text-sky-400">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Formatando defesa com os marcos do dossiê...</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            Dica: Cole o texto na mediação e anexe o relatório PDF do Dossiê ProvaPack.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopy}
              id="btn-copy-dispute-text"
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado para a Área de Transferência!' : 'Copiar Texto da Defesa'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
