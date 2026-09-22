import { RecordingStepDef } from '../types';

export const RECORDING_STEPS: RecordingStepDef[] = [
  {
    number: 1,
    id: 'product',
    title: 'Mostre o Produto',
    shortDesc: 'Apresentação visual 360°',
    instruction: 'Gire o produto devagar. Mostre a frente, verso, laterais e comprove ausência de riscos ou trincas.',
    iconName: 'Package',
    minimumRecommendedSeconds: 8,
    tip: 'Foque a câmera bem perto para registrar que o item está 100% íntegro fisicamente.'
  },
  {
    number: 2,
    id: 'functional',
    title: 'Mostre que está Funcionando',
    shortDesc: 'Teste de operação ao vivo',
    instruction: 'Ligue o aparelho, mostre telas ativas, LEDs, botões ou o mecanismo funcionando normalmente.',
    iconName: 'Activity',
    minimumRecommendedSeconds: 10,
    tip: 'Se for eletrônico, mostre a tela acendendo ou a bateria carregando. Se mecânico, acione a peça.'
  },
  {
    number: 3,
    id: 'serial',
    title: 'Mostre o Número de Série',
    shortDesc: 'Identificador único inviolável',
    instruction: 'Aponte a câmera com nitidez para a etiqueta de IMEI, Serial Number, Part Number ou selo Anatel.',
    iconName: 'QrCode',
    minimumRecommendedSeconds: 8,
    tip: 'Se o serial constar tanto no produto quanto na caixa original, mostre os dois para provar que batem!'
  },
  {
    number: 4,
    id: 'accessories',
    title: 'Mostre os Acessórios',
    shortDesc: 'Itens inclusos e manuais',
    instruction: 'Exiba cabos, manuais, fontes de alimentação, fones e todos os brindes ou componentes descritos.',
    iconName: 'Layers',
    minimumRecommendedSeconds: 8,
    tip: 'Evita a clássica alegação de "faltou o carregador" ou "veio faltando peças".'
  },
  {
    number: 5,
    id: 'packaging',
    title: 'Coloque Dentro da Embalagem',
    shortDesc: 'Acondicionamento e proteção',
    instruction: 'Filme a colocação do item na embalagem interna, envolvendo em plástico bolha ou calços de proteção.',
    iconName: 'Box',
    minimumRecommendedSeconds: 8,
    tip: 'Comprova que você usou material adequado contra avarias no transporte pelos Correios/transportadora.'
  },
  {
    number: 6,
    id: 'sealed',
    title: 'Feche o Pacote',
    shortDesc: 'Lacre e fita de segurança',
    instruction: 'Passe a fita adesiva, dobre as abas da caixa ou envelope e exiba o fechamento seguro e inviolável.',
    iconName: 'ShieldCheck',
    minimumRecommendedSeconds: 8,
    tip: 'Se utilizar fita gomada personalizada ou lacre picotado, mostre o número do lacre!'
  },
  {
    number: 7,
    id: 'label',
    title: 'Mostre a Etiqueta',
    shortDesc: 'Código de rastreio e destinatário',
    instruction: 'Foque a etiqueta de envio colada na embalagem. O código de barras, número do pedido e destinatário devem estar legíveis.',
    iconName: 'Barcode',
    minimumRecommendedSeconds: 6,
    tip: 'A etiqueta fecha o elo definitivo entre este pacote físico e o pedido da plataforma.'
  }
];

export const FRAUD_STATISTICS = {
  totalReturns2024: "US$ 685 bilhões",
  fraudulentReturns2024: "US$ 103 bilhões",
  source: "Appriss Retail & Deloitte / Business Insider (2024)",
  commonScams: [
    { title: "Golpe da Caixa Vazia", desc: "Comprador alega que abriu o pacote e encontrou apenas pedras, papel ou peso." },
    { title: "Devolução de Produto Falso/Trocado", desc: "Devolvem um aparelho quebrado ou uma réplica no lugar do original enviado." },
    { title: "Falso Item Não Recebido / Não Entregue", desc: "Mesmo com rastreio, alegam divergência de peso ou item incorreto." }
  ]
};

export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Degustação Gratuita',
    price: 'Grátis',
    period: 'primeiros 10 envios',
    limit: 10,
    features: [
      '10 Dossiês verificáveis completos',
      'Gravação contínua sem cortes',
      'Cálculo de Hash SHA-256 e timestamp',
      'Exportação em PDF para mediação',
      'Link público de validação'
    ],
    highlight: false,
    cta: 'Plano Atual'
  },
  {
    id: 'pro_monthly',
    name: 'Vendedor Pro',
    price: 'R$ 29,90',
    period: 'por mês',
    limit: 50,
    features: [
      'Até 50 envios mensais protegidos',
      'Roteiro guiado em 7 passos',
      'Extração automática de quadros',
      'Assistente de Defesa em Disputas (IA)',
      'Armazenamento prioritário dos dossiês',
      'Suporte a múltiplos marketplaces'
    ],
    highlight: true,
    badge: 'Mais Escolhido',
    cta: 'Assinar Plano Pro'
  },
  {
    id: 'volume_monthly',
    name: 'Alto Volume',
    price: 'R$ 79,90',
    period: 'por mês',
    limit: 9999,
    features: [
      'Envios ilimitados sem travas',
      'Ideal para operações de alto giro',
      'Dossiês com carimbo de tempo prioritário',
      'Download em lote de PDFs',
      'Exportação para múltiplos atendentes'
    ],
    highlight: false,
    badge: 'Power Seller',
    cta: 'Assinar Alto Volume'
  },
  {
    id: 'extra_credits',
    name: 'Créditos Avulsos',
    price: 'R$ 9,90',
    period: 'pacote com 5 envios',
    limit: 5,
    features: [
      'Para quem vende esporadicamente',
      'Créditos não expiram',
      'Todas as funções do Dossiê inclusas',
      'Perfeito para itens de alto valor'
    ],
    highlight: false,
    cta: 'Comprar Créditos'
  }
];
