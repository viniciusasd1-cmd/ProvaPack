import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, Sparkles, Check, ArrowRight, Play, ChevronRight, Star,
  ShieldAlert, Smartphone, ExternalLink, CheckCircle2, Laptop, Gamepad2,
  Watch, Maximize2, X
} from 'lucide-react';
import { PRODUCT_SHOWCASES, ShowcaseProduct, ShowcaseStep } from '../data/productShowcase';

interface LandingPageProps {
  onStartTrial: () => void;
  onViewDemoDossier: (dossierId?: string) => void;
  onOpenPricing: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartTrial,
  onViewDemoDossier,
  onOpenPricing
}) => {
  // Selected product type showcase
  const [selectedShowcaseId, setSelectedShowcaseId] = useState<string>('smartphone');
  const activeProduct: ShowcaseProduct = PRODUCT_SHOWCASES.find(p => p.id === selectedShowcaseId) || PRODUCT_SHOWCASES[0];

  // Lightbox preview for photos
  const [activePhotoModal, setActivePhotoModal] = useState<ShowcaseStep | null>(null);

  // ROI Calculator states
  const [monthlyOrders, setMonthlyOrders] = useState<number>(150);
  const [averageTicket, setAverageTicket] = useState<number>(280);
  const [fraudRate, setFraudRate] = useState<number>(1.5); // 1.5% average return fraud rate

  // Calculate estimated loss and savings
  const estimatedMonthlyLoss = Math.round((monthlyOrders * (fraudRate / 100)) * averageTicket);
  const provapackCost = 29.90; // Pro Plan cost
  const annualPlanCost = provapackCost * 12;
  const estimatedSavings = Math.max(estimatedMonthlyLoss - provapackCost, 0);
  const estimatedRoi = provapackCost > 0
    ? Math.round((estimatedSavings / provapackCost) * 100)
    : 0;
  const roiMessage = estimatedMonthlyLoss >= annualPlanCost
    ? 'Uma única recuperação pode pagar mais de 1 ano da ferramenta.'
    : estimatedMonthlyLoss > provapackCost
      ? 'O investimento já se paga ao recuperar um único pedido.'
      : 'Ajuste os valores para simular um cenário mais próximo da sua operação.';

  useEffect(() => {
    if (!activePhotoModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhotoModal(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoModal]);

  // FAQ open accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'O Mercado Livre, Shopee e Amazon aceitam esse dossiê em disputas?',
      a: `As principais marketplaces utilizam fotos, documentos, informações de rastreamento e outras evidências na análise de reclamações, devoluções e recursos. Os formatos e canais aceitos variam conforme a plataforma e o tipo de disputa.

O ProvaPack transforma o registro original da venda em um dossiê organizado de evidências: identifica o pedido e o rastreamento, preserva o arquivo original, calcula seu hash criptográfico SHA-256 e destaca os momentos essenciais da gravação com timestamps precisos.

Em vez de depender de um vídeo longo e desestruturado, o vendedor recebe um relatório técnico que facilita a localização e a verificação das evidências relevantes.

O ProvaPack não garante o resultado de uma disputa, que continua sujeito às regras e à análise de cada marketplace. Seu objetivo é aumentar a organização, rastreabilidade e integridade técnica das evidências apresentadas.`
    },
    {
      q: 'Preciso comprar câmeras caras ou instalar aplicativos no computador?',
      a: 'Não. O ProvaPack funciona 100% no seu navegador (celular, tablet ou webcam de bancada no PC). Não precisa baixar nada. Basta abrir a página na hora da expedição e seguir o assistente em menos de 1 minuto.'
    },
    {
      q: 'O que o Hash SHA-256 comprova no dossiê?',
      a: 'O Hash SHA-256 é uma impressão digital matemática do arquivo registrado. Se o arquivo for alterado depois do registro, o hash muda. Ele ajuda a verificar a identidade do arquivo apresentado, mas não substitui a análise das regras da plataforma nem prova, sozinho, toda a cadeia de custódia do vídeo.'
    },
    {
      q: 'O que acontece após eu utilizar os 10 envios gratuitos?',
      a: 'Você pode continuar usando escolhendo o plano Vendedor Pro (R$ 29,90/mês para até 50 envios), Alto Volume (R$ 79,90/mês para envios ilimitados) ou recarregando pacotes avulsos de 5 créditos por apenas R$ 9,90, sem mensalidade nem fidelidade.'
    },
    {
      q: 'Como funciona o Assistente de Defesa com IA para mediações?',
      a: 'Quando o comprador abre uma reclamação (ex: alegando caixa vazia ou defeito), você clica em "Defesa IA". O sistema cruza os dados do seu dossiê e gera um texto jurídico e formal fundamentado, pronto para você colar no campo de resposta da mediação.'
    }
  ];

  return (
    <div className="space-y-24 pb-20 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Context strip: useful urgency without an unsupported statistic */}
      <div className="rounded-2xl border border-sky-900/80 bg-sky-950/35 px-4 py-3 text-center shadow-lg shadow-slate-950/20">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs sm:text-sm font-medium text-slate-200">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-800 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-300">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
            Expedição com evidência organizada
          </span>
          <span>Registre o que foi enviado, preserve os marcos importantes e encontre tudo em um único dossiê.</span>
          <button
            onClick={onStartTrial}
            className="ml-1 font-bold text-sky-300 underline decoration-sky-500/60 underline-offset-2 transition-colors hover:text-white"
          >
            Testar grátis →
          </button>
        </div>
      </div>

      {/* 2. Hero Section: High Conversion & Strong Hook */}
      <section className="relative mx-auto max-w-5xl pt-2 text-center sm:pt-6">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-800 bg-sky-950/70 px-4 py-1.5 text-xs font-bold text-sky-300 shadow-inner">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Prova-como-Serviço para expedições de e-commerce</span>
        </div>

        <h1 className="mx-auto max-w-4xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Transforme cada empacotamento em uma <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">evidência verificável</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Grave em cerca de <strong className="text-white">1 minuto</strong> com 7 marcos guiados, gere um dossiê com <strong className="text-white">hash SHA-256, timestamps e relatório técnico</strong> e apresente suas evidências com muito mais clareza.
        </p>

        {/* Strong Calls to Action (CTAs) */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <button
            onClick={onStartTrial}
            id="landing-hero-cta-trial"
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25 active:scale-95 transition-all group"
          >
            <span>Testar Grátis Agora (10 Envios)</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => onViewDemoDossier('PRV-2026-8841')}
            id="landing-hero-cta-demo"
            className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4 text-sky-400 fill-sky-400/20" />
            <span>Ver Dossiê Real Interativo</span>
          </button>
        </div>

        {/* Frictionless Microcopy Guarantees */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Sem cartão de crédito
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Funciona direto no navegador
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> 10 envios 100% gratuitos
          </span>
        </div>

        {/* Hero Interactive Dossier Preview Card */}
        <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/90 p-4 text-left shadow-2xl shadow-slate-950/60 sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
          
          {/* Product Category Selector Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
            <div>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Veja como a evidência fica organizada por tipo de produto
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {PRODUCT_SHOWCASES.map((prod) => {
                  const isSelected = prod.id === selectedShowcaseId;
                  return (
                    <button
                      key={prod.id}
                      onClick={() => setSelectedShowcaseId(prod.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 ring-2 ring-sky-400/40'
                          : 'border border-slate-700/60 bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {prod.id === 'smartphone' && <Smartphone className="w-3.5 h-3.5" />}
                      {prod.id === 'laptop' && <Laptop className="w-3.5 h-3.5" />}
                      {prod.id === 'console' && <Gamepad2 className="w-3.5 h-3.5" />}
                      {prod.id === 'wearables' && <Watch className="w-3.5 h-3.5" />}
                      <span>{prod.categoryName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onViewDemoDossier(activeProduct.dossierId)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-center border border-slate-700/80"
            >
              <span>Inspecionar Dossiê Completo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dossier Header Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 border border-sky-800 px-2 py-0.5 rounded">
                    {activeProduct.dossierId}
                  </span>
                  <span className="text-xs text-emerald-300 font-semibold bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                    ✓ Integridade SHA-256 Verificada
                  </span>
                  <span className="text-xs text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                    {activeProduct.marketplace}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white mt-1">
                  {activeProduct.productName} • Pedido {activeProduct.orderNumber}
                </h3>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] text-slate-400 block font-mono">
                Serial / ID: <span className="text-slate-200">{activeProduct.serialNumber}</span>
              </span>
              <span className="text-[11px] text-sky-400 font-medium">
                Envio via {activeProduct.carrier}
              </span>
            </div>
          </div>

          {/* 7 Checkpoints Visual Filmstrip with Real Photos */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2.5 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                7 marcos registrados ({activeProduct.durationSeconds} segundos)
              </span>
              <span className="text-sky-400 hidden sm:inline">Clique em qualquer foto para ampliar</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {activeProduct.steps.map((m) => (
                <button
                  type="button"
                  key={m.stepNumber} 
                  onClick={() => setActivePhotoModal(m)}
                  aria-label={`Ampliar evidência: ${m.stepName}`}
                  className="group/thumb bg-slate-950 border border-slate-800 hover:border-sky-500 rounded-xl p-1.5 text-center transition-all cursor-pointer hover:shadow-lg hover:shadow-sky-500/10 flex flex-col justify-between"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80 mb-1.5">
                    <img 
                      src={m.imageUrl} 
                      alt={m.stepName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Timestamp Tag Overlay */}
                    <div className="absolute bottom-1 right-1 bg-slate-950/85 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-sky-300 font-bold border border-slate-800">
                      {m.tag}
                    </div>

                    {/* Step Number Badge */}
                    <div className="absolute top-1 left-1 bg-slate-950/85 backdrop-blur-xs w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-slate-700">
                      {m.stepNumber}
                    </div>

                    {/* Hover expand overlay */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-1 rounded-full bg-sky-500 text-white shadow-md">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-200 font-semibold block truncate" title={m.stepName}>
                    {m.stepName}
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5" title={m.caption}>
                    {m.caption}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cryptographic Proof Footer in Hero Card */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
            <span className="truncate max-w-xl">
              SHA-256: {activeProduct.sha256}
            </span>
            <span className="text-emerald-300 font-sans font-semibold shrink-0">
              ✓ Evidências organizadas para análise
            </span>
          </div>
        </div>

        {/* High-Resolution Photo Lightbox Modal */}
        {activePhotoModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setActivePhotoModal(null)}
          >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-modal-title"
            className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono">
                    Passo {activePhotoModal.stepNumber} de 7 • {activePhotoModal.tag}
                  </span>
                  <h4 id="evidence-modal-title" className="text-sm sm:text-base font-bold text-white">
                    {activePhotoModal.stepName}
                  </h4>
                </div>
                <button 
                  onClick={() => setActivePhotoModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-slate-800 mb-4 shadow-inner">
                <img 
                  src={activePhotoModal.imageUrl} 
                  alt={activePhotoModal.stepName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-slate-950/90 backdrop-blur-xs px-2.5 py-1 rounded text-xs font-mono text-emerald-400 font-semibold border border-slate-800">
                  ✓ Marco associado ao timestamp {activePhotoModal.tag}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-xs font-semibold text-sky-400 block mb-1">
                  Evidência Registrada do Marco:
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {activePhotoModal.proofDetail}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-[11px] text-slate-400 font-mono">
                  {activeProduct.productName}
                </span>
                <button
                  onClick={() => setActivePhotoModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Marketplaces Integration Badges */}
      <section className="text-center pt-2">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">
          Compatível com as principais plataformas e transportadoras do Brasil
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 opacity-85">
          {['Mercado Livre', 'Shopee', 'Amazon Brasil', 'TikTok Shop', 'Magalu', 'Correios & Jadlog'].map((canal) => (
            <div key={canal} className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
              {canal}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Pain vs. Solution (O Prejuízo Real do Vendedor) */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Por que vídeos amadores no celular falham nas mediações?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            A maioria dos vendedores perde a causa porque o mediador do marketplace não tem tempo de assistir vídeos soltos e exige contraprova técnica estruturada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Como você faz hoje (Vulnerável) */}
          <div className="rounded-3xl bg-rose-950/20 border border-rose-900/40 p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-4">
              <ShieldAlert className="w-5 h-5" />
                <span>Sem um fluxo padronizado</span>
            </div>

            <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Vídeos longos de 10 minutos no celular que ninguém assiste na moderação.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>É difícil localizar rapidamente a evidência certa quando surge uma contestação.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>Fotos e vídeos soltos deixam dúvidas sobre produto, acessórios, embalagem e etiqueta.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold shrink-0">✕</span>
                <span>A equipe perde tempo reunindo arquivos, pedidos e rastreamentos de fontes diferentes.</span>
              </li>
            </ul>
          </div>

          {/* Card: Com o ProvaPack (Blindado) */}
          <div className="rounded-3xl bg-sky-950/20 border border-sky-600/50 p-6 sm:p-7 relative overflow-hidden shadow-lg shadow-sky-500/5">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Com o ProvaPack (evidência estruturada)</span>
            </div>

            <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Roteiro de 7 marcos em 60s:</strong> produto funcionando, serial/IMEI, lacre e etiqueta.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Hash SHA-256 e timestamps:</strong> identidade do arquivo e localização rápida dos momentos registrados.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Relatório em PDF:</strong> resumo técnico para apresentar pedido, rastreio e marcos da gravação.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Assistente de Defesa com IA:</strong> organiza um rascunho de resposta a partir dos dados do dossiê.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. How It Works (3 Simple Steps) */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-sky-400 border border-slate-800">
            Fluxo Ágil na Bancada
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Como funciona em 3 passos simples
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Criado para não atrasar a expedição nem atrapalhar o ritmo de empacotamento da sua equipe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 font-bold text-base flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-white">Grave os 7 Marcos Guiados</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              O assistente indica o que mostrar: produto 360°, funcionamento, série, acessórios, acondicionamento, fechamento e etiqueta.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 font-bold text-base flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-white">Carimbo & Hash SHA-256</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Ao concluir, o ProvaPack extrai os quadros de referência, registra data e hora e calcula o resumo criptográfico do arquivo original.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-base flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-white">Dossiê e Defesa em 1 Clique</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Receba o relatório PDF e o link público de conferência. Se houver contestação, use os dados do dossiê para preparar sua resposta.
            </p>
          </div>
        </div>

        {/* Central Action CTA */}
        <div className="mt-8 text-center">
          <button
            onClick={onStartTrial}
            className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-sky-500/20 active:scale-95 transition-all"
          >
            Experimentar Agora na Prática →
          </button>
        </div>
      </section>

      {/* 6. Interactive ROI Calculator */}
      <section className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-slate-900 to-indigo-950/40 border border-slate-800 p-6 sm:p-9 shadow-2xl">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Calculadora de ROI do Vendedor</span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
            Quanto você pode economizar por mês?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Simule o impacto financeiro de evitar que uma ou duas fraudes passem batidas na sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Controls */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <label htmlFor="roi-monthly-orders">Envios por mês:</label>
                <span className="text-sky-400 font-bold">{monthlyOrders} pacotes</span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                id="roi-monthly-orders"
                aria-label="Envios por mês"
                className="h-2 w-full cursor-pointer rounded-lg bg-slate-800 accent-sky-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <label htmlFor="roi-average-ticket">Tíquete médio do produto:</label>
                <span className="text-sky-400 font-bold">R$ {averageTicket}</span>
              </div>
              <input
                type="range"
                min="50"
                max="2500"
                step="25"
                value={averageTicket}
                onChange={(e) => setAverageTicket(Number(e.target.value))}
                id="roi-average-ticket"
                aria-label="Tíquete médio do produto"
                className="h-2 w-full cursor-pointer rounded-lg bg-slate-800 accent-sky-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1.5">
                <label htmlFor="roi-fraud-rate">Índice estimado de contestações/devoluções:</label>
                <span className="text-sky-400 font-bold">{fraudRate}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={fraudRate}
                onChange={(e) => setFraudRate(Number(e.target.value))}
                id="roi-fraud-rate"
                aria-label="Índice estimado de contestações e devoluções"
                className="h-2 w-full cursor-pointer rounded-lg bg-slate-800 accent-sky-400"
              />
            </div>
          </div>

          {/* Result Card */}
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium block">Prejuízo Mensal Potencial com Devoluções:</span>
            <span className="text-3xl sm:text-4xl font-black text-rose-400 mt-1 block">
              R$ {estimatedMonthlyLoss.toLocaleString('pt-BR')}
            </span>

            <div className="my-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span>Investimento ProvaPack Pro:</span>
              <span className="font-bold text-white">R$ 29,90/mês</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs">
              <strong>Retorno estimado: {estimatedRoi > 0 ? `+${estimatedRoi}%` : 'abaixo do custo'}</strong>
              <span className="block text-[11px] text-emerald-400/80 mt-0.5">
                {roiMessage}
              </span>
            </div>

            <button
              onClick={onStartTrial}
              className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-500/20"
            >
              Proteger Minha Operação Agora
            </button>
          </div>
        </div>
      </section>

      {/* 7. Social Proof & Testimonials */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Histórias de Sucesso</span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white">
            Vendedores que viraram o jogo nas mediações
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1 text-amber-400 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />)}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              “Um comprador alegou ter recebido uma embalagem vazia em um iPhone 14. Anexei o PDF do ProvaPack com o hash SHA-256 e o texto gerado pela IA. O Mercado Livre encerrou a mediação a meu favor em menos de 2 horas!”
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
              <strong className="text-white block">Rodrigo Meneses</strong>
              <span className="text-slate-400 text-[11px]">MercadoLíder Platinum • Eletrônicos (SP)</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1 text-amber-400 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />)}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              “Na Shopee os mediadores costumavam recusar meus links de vídeo do Google Drive dizendo que não abria. Com o relatório técnico e os 7 quadros congelados do ProvaPack, a taxa de vitória nas disputas subiu para 100%.”
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
              <strong className="text-white block">Camila Ferraz</strong>
              <span className="text-slate-400 text-[11px]">Shopee Star Seller • Perfumaria & Beleza (PR)</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-1 text-amber-400 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />)}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              “Nossa expedição embala cerca de 60 pedidos por dia. O ProvaPack não atrasou em nada a bancada. Pelo contrário: padronizou o processo da equipe e nos deu tranquilidade jurídica total.”
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
              <strong className="text-white block">Luciano Guimarães</strong>
              <span className="text-slate-400 text-[11px]">Vendedor Amazon FBM • Informática & Gamer (MG)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Accordion Section */}
      <section className="max-w-3xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Perguntas Frequentes
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Tire suas dúvidas e veja como é simples proteger seus pacotes.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index}
                className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-white hover:text-sky-300 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90 text-sky-400' : ''}`} />
                </button>
                {isOpen && (
                  <div id={`faq-answer-${index}`} className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3 whitespace-pre-line">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Final High-Conversion Urgency CTA Box */}
      <section className="max-w-4xl mx-auto text-center rounded-3xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="px-3.5 py-1 rounded-full text-xs font-black bg-white/10 text-white border border-white/20 uppercase tracking-widest inline-block mb-3">
            Comece em Menos de 1 Minuto
          </span>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Pronto para dar mais clareza a cada envio?
          </h2>

          <p className="mt-3 text-xs sm:text-base text-blue-100 max-w-xl mx-auto leading-relaxed">
            Faça seu primeiro empacotamento guiado agora mesmo. Você ganha <strong>10 dossiês gratuitos</strong> para testar o fluxo na sua bancada sem compromisso.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartTrial}
              id="landing-bottom-cta-trial"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm sm:text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Começar Teste Gratuito Agora</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onOpenPricing}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-black/20 hover:bg-black/30 text-white font-bold text-xs sm:text-sm border border-white/20 transition-colors"
            >
              Ver Tabela de Planos
            </button>
          </div>

          <p className="mt-4 text-[11px] text-blue-200">
            Sem cartão de crédito • 10 envios gratuitos inclusos • Cancele quando quiser
          </p>
        </div>
      </section>
    </div>
  );
};

