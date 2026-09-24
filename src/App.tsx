import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Package, Plus, Sparkles, CheckCircle2, 
  AlertTriangle, Search, Lock, ArrowRight, Video, FileText 
} from 'lucide-react';
import { Dossier, SellerAccount } from './types';
import { loadStoredDossiers, loadSellerAccount, saveSellerAccount, subscribeToDossiers } from './utils/storage';
import { getShowcaseDossier } from './data/productShowcase';
import { useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { FraudStatsBanner } from './components/FraudStatsBanner';
import { DossierList } from './components/DossierList';
import { RecordingStudio } from './components/RecordingStudio';
import { DossierDetailModal } from './components/DossierDetailModal';
import { DisputeDefenseModal } from './components/DisputeDefenseModal';
import { PricingModal } from './components/PricingModal';
import { PublicDossierView } from './components/PublicDossierView';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const { isAuthenticated, profile } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [seller, setSeller] = useState<SellerAccount>(loadSellerAccount());
  
  // Navigation / View state
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'recording' | 'public_verify'>('landing');
  const [verifyTargetId, setVerifyTargetId] = useState<string | undefined>(undefined);

  // Modals state
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [disputeDossier, setDisputeDossier] = useState<Dossier | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [showStatsBanner, setShowStatsBanner] = useState(true);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);

  // Quick lookup search modal
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [lookupInput, setLookupInput] = useState('');

  // Active recording phase tracking for mobile immersive mode & footer hiding
  const [recordingPhase, setRecordingPhase] = useState<'setup' | 'recording' | 'processing' | 'error'>('setup');

  // Sincroniza estado de cota com perfil autoritativo do servidor Supabase
  useEffect(() => {
    if (profile) {
      setSeller(prev => ({
        ...prev,
        plan: (profile.plan as SellerAccount['plan']) || 'Gratuito (10 envios)',
        freeDossiersRemaining: profile.freeDossiersRemaining,
        monthlyLimit: profile.monthlyLimit,
        usedThisMonth: profile.usedThisMonth,
        extraCredits: profile.extraCredits
      }));
    }
  }, [profile]);

  // Initial load & URL check for public verification links
  useEffect(() => {
    const loaded = loadStoredDossiers();
    setDossiers(loaded);

    // Subscribe to async IndexedDB hydration & updates
    const unsubscribe = subscribeToDossiers((updatedList) => {
      setDossiers(updatedList);
    });

    // Check if ?verify=PRV-XXXX or #public-PRV-XXXX is in the URL
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get('verify');
    if (verifyParam) {
      setVerifyTargetId(verifyParam);
      setCurrentView('public_verify');
    } else if (window.location.hash.startsWith('#public-')) {
      const hashId = window.location.hash.replace('#public-', '').trim();
      if (hashId) {
        setVerifyTargetId(hashId);
        setCurrentView('public_verify');
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStartRecording = () => {
    if (!isAuthenticated) {
      setAuthModalMessage('Identifique-se com seu e-mail para validar seus 10 envios gratuitos e salvar seu dossiê.');
      setPendingAuthAction(() => () => setCurrentView('recording'));
      setIsAuthModalOpen(true);
    } else {
      setCurrentView('recording');
    }
  };

  const handleOpenAuthModal = (message?: string, onSuccessAction?: () => void) => {
    setAuthModalMessage(message || 'Informe seu e-mail para salvar seus créditos e acessar sua conta em qualquer dispositivo.');
    setPendingAuthAction(() => onSuccessAction || null);
    setIsAuthModalOpen(true);
  };

  const handleUpdateSeller = (updated: SellerAccount) => {
    setSeller(updated);
    saveSellerAccount(updated);
  };

  const handleDossierCreated = (newDossier: Dossier) => {
    setDossiers((prev) => [newDossier, ...prev.filter(d => d.id !== newDossier.id)]);
    const updatedSeller = loadSellerAccount();
    setSeller(updatedSeller);
    setCurrentView('dashboard');
    setSelectedDossier(newDossier);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = lookupInput.trim().toUpperCase();
    if (!query) return;

    const found = dossiers.find(d => 
      d.id.toUpperCase() === query || 
      d.orderNumber.toUpperCase() === query ||
      d.fileHashSha256.toUpperCase() === query
    );

    setIsLookupOpen(false);
    if (found) {
      setSelectedDossier(found);
    } else {
      setVerifyTargetId(query);
      setCurrentView('public_verify');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation - hidden on mobile during active recording (Requirement 2) */}
      <div className={currentView === 'recording' && recordingPhase === 'recording' ? 'hidden md:block' : ''}>
        <Navbar
          seller={seller}
          onNewDossier={handleStartRecording}
          onOpenVerify={() => setIsLookupOpen(true)}
          onOpenPricing={() => setIsPricingOpen(true)}
          onOpenStats={() => setShowStatsBanner(true)}
          onRequestAuth={() => handleOpenAuthModal('Acesse sua conta com seu e-mail para consultar seus créditos e envios.')}
          currentView={currentView}
          onNavigateHome={() => setCurrentView('landing')}
          onNavigateLanding={() => setCurrentView('landing')}
          onNavigateDashboard={() => setCurrentView('dashboard')}
        />
      </div>

      {/* Main Content Router */}
      <main className={`flex-1 w-full mx-auto ${
        currentView === 'recording' && recordingPhase === 'recording'
          ? 'p-0 md:max-w-7xl md:px-6 lg:px-8 md:py-6'
          : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-6'
      }`}>
        {currentView === 'landing' && (
          <LandingPage
            onStartTrial={handleStartRecording}
            onViewDemoDossier={(demoId) => {
              const currentList = loadStoredDossiers();
              setDossiers(currentList);
              const target = (demoId ? getShowcaseDossier(demoId) : null) || currentList.find(d => d.id === demoId) || currentList[0];
              if (target) {
                setSelectedDossier(target);
              } else {
                handleStartRecording();
              }
            }}
            onOpenPricing={() => setIsPricingOpen(true)}
          />
        )}

        {currentView === 'recording' && (
          <RecordingStudio
            seller={seller}
            onCancel={() => {
              setRecordingPhase('setup');
              setCurrentView('dashboard');
            }}
            onDossierCreated={(dossier) => {
              setRecordingPhase('setup');
              handleDossierCreated(dossier);
            }}
            onPhaseChange={setRecordingPhase}
          />
        )}

        {currentView === 'public_verify' && (
          <PublicDossierView
            dossiers={dossiers}
            initialDossierId={verifyTargetId}
            onBackToApp={() => {
              setCurrentView('dashboard');
              window.history.pushState({}, '', window.location.pathname);
            }}
          />
        )}

        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Header Hero Greeting */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800">
                    Prova-como-Serviço para E-commerce
                  </span>
                  <span className="text-xs text-slate-400">
                    Mercado Livre • Shopee • Amazon • TikTok Shop
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
                  “Embale uma vez e saia com um dossiê verificável do que foi enviado.”
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                  Gere gravações ininterruptas sem cortes com carimbo de tempo, extração automática dos 7 marcos visuais e hash SHA-256 criptográfico para blindar seus envios em mediações e disputas.
                </p>
              </div>

              <div className="shrink-0 flex sm:flex-col gap-2 w-full sm:w-auto">
                <button
                  onClick={handleStartRecording}
                  id="hero-btn-new-recording"
                  className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Empacotamento</span>
                </button>
              </div>
            </div>

            {/* Fraud Stats Context Callout Banner */}
            {showStatsBanner && (
              <FraudStatsBanner onClose={() => setShowStatsBanner(false)} />
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Dossiês Ativos</span>
                <span className="text-2xl font-black text-white mt-1 block">{dossiers.length}</span>
                <span className="text-[10px] text-emerald-400 mt-0.5 block">Arquivados e indexados</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Envios Disponíveis</span>
                <span className="text-2xl font-black text-sky-400 mt-1 block">{seller.freeDossiersRemaining}</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{seller.plan}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Integridade SHA-256</span>
                <span className="text-2xl font-black text-white mt-1 block">100%</span>
                <span className="text-[10px] text-emerald-400 mt-0.5 block">Sem cortes ou edições</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">7 Marcos Auditados</span>
                <span className="text-2xl font-black text-white mt-1 block">Roteiro</span>
                <span className="text-[10px] text-sky-400 mt-0.5 block">Produto a etiqueta</span>
              </div>
            </div>

            {/* Dossiers List & History */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Dossiês Técnicos de Empacotamento
                  </h2>
                  <p className="text-xs text-slate-400">
                    Histórico de pacotes conferidos com links verificáveis e relatórios em PDF.
                  </p>
                </div>
              </div>

              <DossierList
                dossiers={dossiers}
                onSelectDossier={(d) => setSelectedDossier(d)}
                onOpenDispute={(d) => setDisputeDossier(d)}
                onNewDossier={handleStartRecording}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer - completely hidden during active recording phase (Requirement 12) */}
      {!(currentView === 'recording' && recordingPhase === 'recording') && (
        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-500" />
              <span className="font-semibold text-slate-400">ProvaPack</span>
              <span>— Prova-como-Serviço para E-commerce</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Documentação técnica independente para Mercado Livre, Shopee, Amazon Brasil, Instagram e lojas virtuais.
            </div>
          </div>
        </footer>
      )}

      {/* MODALS */}
      {/* 1. Dossier Detail Modal */}
      <DossierDetailModal
        isOpen={Boolean(selectedDossier)}
        onClose={() => setSelectedDossier(null)}
        dossier={selectedDossier}
        onOpenDispute={(d) => setDisputeDossier(d)}
        onViewPublic={(id) => {
          setSelectedDossier(null);
          setVerifyTargetId(id);
          setCurrentView('public_verify');
        }}
      />

      {/* 2. AI Dispute Defense Modal */}
      {disputeDossier && (
        <DisputeDefenseModal
          isOpen={Boolean(disputeDossier)}
          onClose={() => setDisputeDossier(null)}
          dossier={disputeDossier}
        />
      )}

      {/* 3. Pricing & Credits Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        seller={seller}
        onUpdateSeller={handleUpdateSeller}
        onRequestAuth={() => handleOpenAuthModal('Acesse sua conta com seu e-mail para consultar seus créditos e planos.')}
      />

      {/* 4. Quick ID / Hash Lookup Dialog */}
      {isLookupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Consultar Dossiê por ID ou Hash</h3>
            <p className="text-xs text-slate-400 mb-4">
              Informe o código do dossiê (ex: PRV-2026-8841), número de pedido ou hash SHA-256.
            </p>
            <form onSubmit={handleLookupSubmit} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Ex: PRV-2026-8841"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLookupOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                >
                  Buscar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Passwordless E-mail + OTP Authentication Modal (MVP-02A) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingAuthAction(null);
        }}
        initialMessage={authModalMessage}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          if (pendingAuthAction) {
            pendingAuthAction();
            setPendingAuthAction(null);
          }
        }}
      />
    </div>
  );
}
