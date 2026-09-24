import React from 'react';
import { ShieldCheck, Plus, Search, CreditCard, AlertCircle, User as UserIcon, LogOut } from 'lucide-react';
import { SellerAccount } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  seller: SellerAccount;
  onNewDossier: () => void;
  onOpenVerify: () => void;
  onOpenPricing: () => void;
  onOpenStats: () => void;
  onRequestAuth?: () => void;
  currentView: 'landing' | 'dashboard' | 'recording' | 'public_verify';
  onNavigateHome: () => void;
  onNavigateLanding?: () => void;
  onNavigateDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  seller,
  onNewDossier,
  onOpenVerify,
  onOpenPricing,
  onOpenStats,
  onRequestAuth,
  currentView,
  onNavigateHome
}) => {
  const { user, isAuthenticated, profile, signOut } = useAuth();

  const effectiveRemaining = profile?.freeDossiersRemaining ?? seller.freeDossiersRemaining;
  const effectivePlan = profile?.plan ?? seller.plan;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          id="nav-brand-logo"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                Prova<span className="text-sky-400">Pack</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800/80">
                Prova-como-Serviço
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              “Embale uma vez e saia com um dossiê verificável”
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Industry Fraud Stats Callout */}
          <button
            onClick={onOpenStats}
            id="nav-btn-stats"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/50 rounded-lg transition-colors whitespace-nowrap"
            title="Dados de Fraudes em Devoluções 2024"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>US$ 103 Bi em Fraudes</span>
          </button>

          {/* Quota / Plan indicator */}
          <button
            onClick={onOpenPricing}
            id="nav-btn-pricing"
            aria-label="Ver planos e créditos"
            className="min-h-[40px] flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-200 transition-colors whitespace-nowrap active:scale-98"
          >
            <CreditCard className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <div className="text-left">
              <span className="block font-medium leading-none text-[11px] sm:text-xs">
                {effectiveRemaining > 0 
                  ? `${effectiveRemaining}/10` 
                  : `${effectivePlan}`}
                <span className="hidden sm:inline">{effectiveRemaining > 0 ? ' Grátis' : ''}</span>
              </span>
            </div>
            <span className="text-[10px] text-sky-400 font-semibold underline ml-0.5 sm:ml-1 hidden sm:inline">Planos</span>
          </button>

          {/* Public Verification search */}
          <button
            onClick={onOpenVerify}
            id="nav-btn-verify-lookup"
            aria-label="Consultar dossiê"
            className="hidden sm:flex min-h-[40px] items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap active:scale-98"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Consultar Dossiê</span>
          </button>

          {/* Auth Button */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <div 
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-xs text-slate-300"
                title={user?.email}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[120px] truncate">{user?.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={() => signOut()}
                id="nav-btn-signout"
                title="Sair da conta"
                aria-label="Sair da conta"
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 border border-slate-700/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onRequestAuth}
              id="nav-btn-auth-login"
              aria-label="Acessar conta ProvaPack"
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/80 rounded-lg transition-colors whitespace-nowrap active:scale-98"
            >
              <UserIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>Acessar</span>
            </button>
          )}

          {/* New Recording Action */}
          {currentView !== 'recording' && (
            <button
              onClick={onNewDossier}
              id="nav-btn-new-recording"
              aria-label="Iniciar novo empacotamento"
              className="min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-lg shadow-md shadow-sky-500/25 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Novo Empacotamento</span>
              <span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

