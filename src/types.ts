export type Marketplace = 
  | 'Mercado Livre'
  | 'Shopee'
  | 'Amazon Brasil'
  | 'Instagram / WhatsApp'
  | 'TikTok Shop'
  | 'Magalu'
  | 'Loja Própria / Outros';

export type ProcessingStatus = 
  | 'RECORDING'
  | 'ORIGINAL_SAVED'
  | 'HASHING_ORIGINAL'
  | 'PROCESSING'
  | 'HASHING_FINAL'
  | 'READY'
  | 'FAILED';

export type TimeSource = 'DEVICE' | 'DEVICE_WITH_SERVER_REFERENCE';

export interface EvidenceRecording {
  id: string;
  recordingId: string; // e.g. PP-20260922-A81F2C
  orderId?: string;
  originalVideoUri?: string;
  processedVideoUri?: string;
  startedAtUtc: string;
  endedAtUtc?: string;
  deviceTime: string;
  serverTime?: string;
  timeSource: TimeSource;
  timezone: string;
  timezoneOffsetFormatted: string; // e.g. GMT-03:00
  durationMs: number;
  originalSha256?: string;
  processedSha256?: string;
  processingStatus: ProcessingStatus;
  createdAt: string;
  timeDivergenceMs?: number;
  timeDivergenceNote?: string;
  errorMessage?: string;
  onlinePersisted?: boolean;
}

export interface CheckpointFrame {
  stepId: string;
  stepTitle: string;
  timestampSeconds: number;
  formattedTime: string;
  imageDataUrl: string;
  note?: string;
}

export interface Dossier {
  id: string; // e.g. PRV-2026-8841
  recordingId?: string; // e.g. PP-20260922-A81F2C
  marketplace: Marketplace;
  orderNumber: string;
  trackingCode?: string;
  productName: string;
  serialNumber?: string;
  accessories: string;
  packageType: string;
  sellerName: string;
  sellerCpfCnpj?: string;
  recordedAt: string; // ISO string
  formattedDate: string; // Localized Brasilia format
  durationSeconds: number;
  fileHashSha256: string; // Primary hash (processed video with watermark)
  originalSha256?: string; // Untouched camera original hash
  processedSha256?: string; // Watermarked derived video hash
  fileSizeBytes: number;
  videoBlobUrl?: string; // Primary playable video (watermarked)
  originalVideoBlobUrl?: string; // Raw camera video
  processedVideoBlobUrl?: string; // Watermarked video
  videoMimeType?: string;
  checkpoints: CheckpointFrame[];
  status: 'validado' | 'em_analise' | 'disputa_aberta';
  verificationStatus: string;
  notes?: string;
  carrier?: string;
  recipientCity?: string;
  evidenceRecording?: EvidenceRecording;
  timeSource?: TimeSource;
  timezone?: string;
  timezoneOffsetFormatted?: string;
  onlinePersisted?: boolean;
}

export interface RecordingStepDef {
  id: string;
  number: number;
  title: string;
  shortDesc: string;
  instruction: string;
  iconName: string;
  minimumRecommendedSeconds: number;
  tip: string;
}

export interface SellerAccount {
  sellerName: string;
  storeName: string;
  plan: 'Gratuito (10 envios)' | 'Pro (50 envios)' | 'Alto Volume (Ilimitado)';
  freeDossiersRemaining: number;
  monthlyLimit: number;
  usedThisMonth: number;
  extraCredits: number;
}
