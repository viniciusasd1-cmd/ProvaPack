import { Dossier, Marketplace } from '../types';

export interface ShowcaseStep {
  stepNumber: number;
  stepName: string;
  tag: string;
  imageUrl: string;
  caption: string;
  proofDetail: string;
}

export interface ShowcaseProduct {
  id: string;
  categoryName: string;
  icon: string;
  dossierId: string;
  productName: string;
  orderNumber: string;
  marketplace: string;
  serialNumber: string;
  carrier: string;
  sha256: string;
  durationSeconds: number;
  steps: ShowcaseStep[];
}

export const PRODUCT_SHOWCASES: ShowcaseProduct[] = [
  {
    id: 'smartphone',
    categoryName: 'Smartphones & Celulares',
    icon: 'Smartphone',
    dossierId: 'PRV-2026-8841',
    productName: 'Samsung Galaxy S23 256GB Preto Phantom',
    orderNumber: 'MLB-489201948',
    marketplace: 'Mercado Livre',
    serialNumber: 'RF8W91X4082M (IMEI: 358920192849102)',
    carrier: 'Mercado Envios',
    sha256: '9f83a45c2e176b9a84d319e07f66a12b4892cfa76e902b1f8c4e78a94b3210aa',
    durationSeconds: 78,
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Produto 360°',
        tag: '00:11',
        imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=600&q=80',
        caption: 'Inspeção física do aparelho',
        proofDetail: 'Apresentação 360° comprovando tela frontal, aro de alumínio e tampa traseira 100% livres de riscos ou marcas.'
      },
      {
        stepNumber: 2,
        stepName: '2. Tela Funcionando',
        tag: '00:26',
        imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
        caption: 'Aparelho ligado e operacional',
        proofDetail: 'Display Dynamic AMOLED 2X iluminado, touch responsivo, nível de bateria e sistema Android ativo ao vivo.'
      },
      {
        stepNumber: 3,
        stepName: '3. IMEI / Serial',
        tag: '00:41',
        imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
        caption: 'Conferência de IMEI e Anatel',
        proofDetail: 'Macro da etiqueta com número de série RF8W91X4082M e IMEI idêntico na gaveta SIM e na caixa original.'
      },
      {
        stepNumber: 4,
        stepName: '4. Acessórios',
        tag: '00:52',
        imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=80',
        caption: 'Cabos e fonte original 25W',
        proofDetail: 'Cabo USB-C lacrado de fábrica, carregador rápido homologado, chave de gaveta SIM e guia rápido.'
      },
      {
        stepNumber: 5,
        stepName: '5. Proteção Caixa',
        tag: '01:03',
        imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
        caption: 'Plástico bolha e calços anti-choque',
        proofDetail: 'Acondicionamento do smartphone na caixa de transporte parda com 3 voltas de plástico bolha de alta densidade.'
      },
      {
        stepNumber: 6,
        stepName: '6. Fita Lacre',
        tag: '01:12',
        imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=600&q=80',
        caption: 'Fechamento com fita de segurança',
        proofDetail: 'Caixa selada com fita adesiva reforçada cobrindo todas as frestas, impedindo abertura sem violação visível.'
      },
      {
        stepNumber: 7,
        stepName: '7. Etiqueta Rastreio',
        tag: '01:17',
        imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
        caption: 'Etiqueta Mercado Envios fixada',
        proofDetail: 'Código de barras BR948294820SL e dados do destinatário 100% nítidos, vinculando o pacote ao pedido MLB.'
      }
    ]
  },
  {
    id: 'laptop',
    categoryName: 'Notebooks & Informática',
    icon: 'Laptop',
    dossierId: 'PRV-2026-7210',
    productName: 'Notebook Dell G15 Intel Core i7 16GB RTX 3050',
    orderNumber: 'SHP-910482019',
    marketplace: 'Shopee',
    serialNumber: 'ST-9482K19 (Express Code: 2019482)',
    carrier: 'Shopee Xpress',
    sha256: '7c81a29f8e4012ba4d78219c018274f881290310fa291b2c4e7901842b109efa',
    durationSeconds: 84,
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Produto 360°',
        tag: '00:12',
        imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
        caption: 'Chassi, teclado e tampa intactos',
        proofDetail: 'Inspeção do chassi superior e inferior, dobradiças íntegras e teclado sem desgaste.'
      },
      {
        stepNumber: 2,
        stepName: '2. Tela Funcionando',
        tag: '00:28',
        imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
        caption: 'Boot do Windows 11 com display ativo',
        proofDetail: 'Inicialização completa do sistema operacional, tela IPS 120Hz sem dead pixels e teclado retroiluminado.'
      },
      {
        stepNumber: 3,
        stepName: '3. Service Tag / Serial',
        tag: '00:44',
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        caption: 'Etiqueta gravada na tampa inferior',
        proofDetail: 'Foco na Service Tag da Dell com código de barras legível, batendo com a Nota Fiscal emitida.'
      },
      {
        stepNumber: 4,
        stepName: '4. Acessórios',
        tag: '00:56',
        imageUrl: 'https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?auto=format&fit=crop&w=600&q=80',
        caption: 'Fonte original 240W e cabo de força',
        proofDetail: 'Fonte bivolt original com selo Inmetro, cabo de alimentação de 3 pinos lacrado e manual do proprietário.'
      },
      {
        stepNumber: 5,
        stepName: '5. Proteção Caixa',
        tag: '01:08',
        imageUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=600&q=80',
        caption: 'Caixa sob medida com berço de EVA',
        proofDetail: 'Notebook acomodado entre berços de espuma expandida para absorção de impactos mecânicos no transporte.'
      },
      {
        stepNumber: 6,
        stepName: '6. Fita Lacre',
        tag: '01:18',
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
        caption: 'Fita gomada de alta resistência',
        proofDetail: 'Fechamento hermético em H com fita reforçada, demonstrando embalagem inviolada na bancada.'
      },
      {
        stepNumber: 7,
        stepName: '7. Etiqueta Rastreio',
        tag: '01:24',
        imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
        caption: 'Etiqueta Shopee Xpress impressa',
        proofDetail: 'Etiqueta térmica da Shopee com número de rastreio e comprovante do pacote pronto para coleta.'
      }
    ]
  },
  {
    id: 'console',
    categoryName: 'Games & Consoles',
    icon: 'Gamepad2',
    dossierId: 'PRV-2026-9533',
    productName: 'Sony PlayStation 5 Slim 1TB + Controle DualSense',
    orderNumber: 'AMZ-820194820',
    marketplace: 'Amazon Brasil',
    serialNumber: 'CFI-2014A (S/N: 03-27481920-1049281)',
    carrier: 'Logística Amazon',
    sha256: '4a19b84e0192a74c8812049182cb9018e4720198129a04812b719481920acb12',
    durationSeconds: 80,
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Produto 360°',
        tag: '00:10',
        imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80',
        caption: 'Console PS5 Slim imaculado',
        proofDetail: 'Painéis brancos laterais sem riscos, entradas USB frontais e traseiras intactas.'
      },
      {
        stepNumber: 2,
        stepName: '2. Tela Funcionando',
        tag: '00:25',
        imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
        caption: 'Led azul/branco e boot no monitor',
        proofDetail: 'Console ligando na bancada com tela de início do PlayStation exibida com áudio e vídeo.'
      },
      {
        stepNumber: 3,
        stepName: '3. Serial Anatel',
        tag: '00:40',
        imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
        caption: 'Número de série gravado no chassi',
        proofDetail: 'Serial CFI-2014A registrado na base do console correspondendo exatamente ao código impresso na caixa.'
      },
      {
        stepNumber: 4,
        stepName: '4. Acessórios',
        tag: '00:52',
        imageUrl: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&w=600&q=80',
        caption: 'DualSense, cabo HDMI 2.1 e base',
        proofDetail: 'Controle original na embalagem protetora, cabos originais de força e HDMI 2.1 ultra high speed inclusos.'
      },
      {
        stepNumber: 5,
        stepName: '5. Proteção Caixa',
        tag: '01:04',
        imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
        caption: 'Caixa original dentro de caixa de envio',
        proofDetail: 'Dupla proteção com papel kraft e ar para neutralizar impactos laterais durante o trajeto.'
      },
      {
        stepNumber: 6,
        stepName: '6. Fita Lacre',
        tag: '01:14',
        imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=600&q=80',
        caption: 'Fita personalizada de segurança',
        proofDetail: 'Aplicação contínua de fita adesiva de segurança nas duas extremidades da caixa.'
      },
      {
        stepNumber: 7,
        stepName: '7. Etiqueta Rastreio',
        tag: '01:20',
        imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
        caption: 'Etiqueta Amazon Logistics afixada',
        proofDetail: 'Comprovante impresso com código de barras Amazon escaneado na bancada de expedição.'
      }
    ]
  },
  {
    id: 'wearables',
    categoryName: 'Smartwatches & Acessórios',
    icon: 'Watch',
    dossierId: 'PRV-2026-6410',
    productName: 'Apple Watch Series 9 GPS 45mm Alumínio Meia-Noite',
    orderNumber: 'TIK-481920491',
    marketplace: 'TikTok Shop',
    serialNumber: 'SN: H48K9104LA92 (Modelo A2980)',
    carrier: 'Jadlog Express',
    sha256: '38190fae419b882019482019482cb410928419b0284719082cb4819204192bfa',
    durationSeconds: 65,
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Produto 360°',
        tag: '00:08',
        imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80',
        caption: 'Caixa de alumínio e vidro de safira',
        proofDetail: 'Inspeção minuciosa dos sensores de batimento cardíaco, botões laterais e tela sem micro-riscos.'
      },
      {
        stepNumber: 2,
        stepName: '2. Tela Funcionando',
        tag: '00:19',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
        caption: 'Logo Apple no display Always-On',
        proofDetail: 'Mostrador ativo, animação de emparelhamento exibida e touch perfeitamente calibrado.'
      },
      {
        stepNumber: 3,
        stepName: '3. Serial Gravado',
        tag: '00:32',
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        caption: 'Código de série no encaixe da pulseira',
        proofDetail: 'Número gravado a laser no encaixe do relógio correspondendo 100% à caixa lacrada.'
      },
      {
        stepNumber: 4,
        stepName: '4. Acessórios',
        tag: '00:41',
        imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=80',
        caption: 'Cabo magnético USB-C e pulseira',
        proofDetail: 'Pulseira esportiva tamanho S/M e M/L original lacrada e carregador magnético rápido.'
      },
      {
        stepNumber: 5,
        stepName: '5. Proteção Caixa',
        tag: '00:50',
        imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
        caption: 'Envelope de segurança acolchoado',
        proofDetail: 'Embalagem interna protegida em plástico bolha grosso para impedir atritos durante a triagem.'
      },
      {
        stepNumber: 6,
        stepName: '6. Fita Lacre',
        tag: '00:58',
        imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=600&q=80',
        caption: 'Lacre adesivo hot-melt de segurança',
        proofDetail: 'Aba de segurança termo-selada mostrando evidência imediata caso haja tentativa de abertura.'
      },
      {
        stepNumber: 7,
        stepName: '7. Etiqueta Rastreio',
        tag: '01:05',
        imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
        caption: 'Etiqueta Jadlog com DANFE Simplificada',
        proofDetail: 'Etiqueta com código de barras de rastreamento e chave de acesso da NFe anexada ao pacote.'
      }
    ]
  }
];

export function showcaseProductToDossier(prod: ShowcaseProduct): Dossier {
  return {
    id: prod.dossierId,
    marketplace: (prod.marketplace as Marketplace) || 'Mercado Livre',
    orderNumber: prod.orderNumber,
    trackingCode: prod.id === 'smartphone' ? 'BR948294820SL' : prod.id === 'laptop' ? 'SHPX-9102482BR' : prod.id === 'console' ? 'AMZL-2819401BR' : 'JAD-4819204BR',
    productName: prod.productName,
    serialNumber: prod.serialNumber,
    accessories: prod.steps[3]?.proofDetail || prod.steps[3]?.caption || 'Acessórios originais conferidos na gravação',
    packageType: `${prod.steps[4]?.caption || 'Embalagem protetora'}, ${prod.steps[5]?.caption || 'fita de segurança lacrada'}`,
    sellerName: 'TechStore SP',
    recordedAt: '2026-09-20T14:32:10.000Z',
    formattedDate: '20/09/2026, 14:32:10 (Horário de Brasília)',
    durationSeconds: prod.durationSeconds,
    fileHashSha256: prod.sha256,
    fileSizeBytes: 24890120,
    status: 'validado',
    verificationStatus: 'Registro Validado & Integridade 100%',
    notes: `Aparelho ligado na bancada, tela e funcionamento testados, número de série (${prod.serialNumber}) coincide na caixa e aparelho.`,
    carrier: prod.carrier,
    recipientCity: 'Curitiba / PR',
    checkpoints: prod.steps.map((st) => {
      const parts = st.tag.split(':');
      const secs = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      return {
        stepId: `step-${st.stepNumber}`,
        stepTitle: st.stepName,
        timestampSeconds: secs,
        formattedTime: st.tag,
        imageDataUrl: st.imageUrl,
        note: st.proofDetail
      };
    })
  };
}

export function getShowcaseDossier(identifier: string): Dossier | null {
  const prod = PRODUCT_SHOWCASES.find(p => p.id === identifier || p.dossierId === identifier);
  if (!prod) return null;
  return showcaseProductToDossier(prod);
}

