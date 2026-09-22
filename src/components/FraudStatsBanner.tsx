import React from 'react';
import { AlertTriangle, ShieldCheck, FileText, CheckCircle2, X } from 'lucide-react';
import { FRAUD_STATISTICS } from '../data/steps';

interface FraudStatsBannerProps {
  onClose?: () => void;
  inline?: boolean;
}

export const FraudStatsBanner: React.FC<FraudStatsBannerProps> = ({ onClose, inline = false }) => {
  return (
    <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden ${inline ? 'my-6' : ''}`}>
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="max-w-4xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <AlertTriangle className="w-3.5 h-3.5" />
            Problema Real do E-commerce
          </span>
          <span className="text-xs text-slate-400">
            Fonte: {FRAUD_STATISTICS.source}
          </span>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
          Em 2024, US$ 103 bilhões em devoluções foram classificadas como fraudulentas
        </h3>

        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          Nos Estados Unidos e no Brasil, vendedores sofrem prejuízos diários com <strong className="text-white font-medium">golpes da caixa vazia</strong>, <strong className="text-white font-medium">devoluções de produtos trocados</strong> ou quebrados e <strong className="text-white font-medium">alegações falsas de item não recebido</strong>.
        </p>

        {/* 3 Columns Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
            <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Golpe da Caixa Vazia</div>
            <p className="text-xs text-slate-300 mt-1">
              O comprador alega que abriu o pacote e não havia nada dentro. O dossiê ProvaPack documenta o item sendo colocado e lacrado.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Troca de Aparelho / IMEI</div>
            <p className="text-xs text-slate-300 mt-1">
              Devolução de aparelho defeituoso antigo. O dossiê registra o número de série/IMEI original exato gravado na peça e na caixa.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
            <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Prova-como-Serviço</div>
            <p className="text-xs text-slate-300 mt-1">
              Não é ERP nem controle de estoque: é a camada simples de proteção técnica entre o vendedor, a caixa e a mediação da plataforma.
            </p>
          </div>
        </div>

        {/* Legal Communication Principle Callout */}
        <div className="mt-4 p-3 rounded-lg bg-sky-950/40 border border-sky-800/50 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300">
            <strong className="text-sky-300 font-medium">Princípio de Transparência ProvaPack:</strong> Nossa ferramenta melhora substancialmente a robustez da documentação em disputas com gravação sem cortes e Hash SHA-256 inviolável. Não prometemos vitória automática nem garantia de aceitação pela mediação da plataforma, mas fornecemos a melhor evidência material possível para o vendedor.
          </p>
        </div>
      </div>
    </div>
  );
};
