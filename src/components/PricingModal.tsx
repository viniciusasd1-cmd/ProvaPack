import React, { useState } from 'react';
import { X, Check, Zap, Shield, Sparkles, CreditCard, ChevronRight, ArrowLeft, Lock, Info } from 'lucide-react';
import { SellerAccount } from '../types';
import { PRICING_TIERS } from '../data/steps';
import { useAuth } from '../contexts/AuthContext';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerAccount;
  onUpdateSeller?: (seller: SellerAccount) => void;
  onRequestAuth?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  seller,
  onRequestAuth
}) => {
  const { isAuthenticated } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectTier = (tierId: string) => {
    // 1. Se usuário não estiver autenticado, abrir AuthModal primeiro
    if (!isAuthenticated) {
      if (onRequestAuth) {
        onRequestAuth();
      }
      return;
    }

    // 2. Se já autenticado, NÃO ativar plano no navegador (sem Mercado Pago / gateway nesta etapa)
    if (tierId === 'free') {
      setNotice('Sua conta já possui 10 ProvaPacks gratuitos válidos garantidos pelo servidor.');
    } else {
      setNotice('Pagamento será conectado na próxima etapa.');
    }

    setTimeout(() => {
      setNotice(null);
    }, 6000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl my-3 sm:my-8">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
          <button
            onClick={onClose}
            id="btn-back-to-home-pricing"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-all px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 group shadow-sm active:scale-95"
            title="Voltar para a tela principal"
          >
            <ArrowLeft className="w-4 h-4 text-sky-400 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar para tela principal</span>
          </button>

          <button
            onClick={onClose}
            id="btn-close-pricing"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center max-w-xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800/80">
            <Sparkles className="w-3.5 h-3.5" />
            Modelo Simples de Prova-como-Serviço
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Planos & Créditos de Envio
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Proteja suas encomendas com custos irrisórios frente ao valor de um único golpe de devolução.
          </p>
        </div>

        {/* Current Quota Status */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Seu Status Atual</div>
              <div className="text-sm font-semibold text-white">
                {seller.plan} • <span className="text-sky-400">{seller.freeDossiersRemaining} envios disponíveis</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Dossiês já emitidos este mês: <strong className="text-white">{seller.usedThisMonth}</strong>
          </div>
        </div>

        {notice && (
          <div className="mt-4 p-3 rounded-xl bg-sky-950/80 border border-sky-800/80 text-sky-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-sky-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {PRICING_TIERS.map((tier) => {
            const isCurrent = (tier.id === 'free' && seller.plan.includes('Gratuito')) ||
                              (tier.id === 'pro_monthly' && seller.plan.includes('Pro')) ||
                              (tier.id === 'volume_monthly' && seller.plan.includes('Alto Volume'));

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  tier.highlight
                    ? 'bg-gradient-to-b from-sky-950/60 to-slate-900 border-2 border-sky-500 shadow-xl shadow-sky-500/10'
                    : 'bg-slate-850/60 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-sky-500 text-slate-950 shadow-md">
                    {tier.badge}
                  </span>
                )}

                <div>
                  <h3 className="text-base font-bold text-white">{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-white tracking-tight">{tier.price}</span>
                    <span className="text-xs text-slate-400">/{tier.period}</span>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                        <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => handleSelectTier(tier.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isCurrent
                        ? 'bg-slate-800 text-slate-400 cursor-default'
                        : tier.highlight
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 active:scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white active:scale-95'
                    }`}
                  >
                    <span>{isCurrent ? 'Plano Ativo' : tier.cta}</span>
                    {!isCurrent && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Pagamento facilitado via PIX ou Cartão • Cancele quando quiser • Sem fidelidade ou taxas ocultas.
          </div>
          <button
            onClick={onClose}
            id="btn-bottom-back-pricing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para tela principal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
