import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Video, StopCircle, CheckCircle, ArrowRight, ArrowLeft, 
  RotateCw, AlertTriangle, ShieldCheck, Sparkles, Hash, Scan, 
  Layers, Package, Check, HelpCircle, RefreshCw, ShieldAlert, X, Download
} from 'lucide-react';
import { Marketplace, Dossier, CheckpointFrame, SellerAccount, EvidenceRecording, ProcessingStatus, TimeSource } from '../types';
import { RECORDING_STEPS } from '../data/steps';
import { calculateBlobSha256, generateDossierId, formatSecondsToTime, formatBrasiliaDate } from '../utils/crypto';
import { saveDossierToStorage, updateDossierInStorage } from '../utils/storage';
import {
  generateRecordingId,
  getTimezoneOffsetString,
  formatWatermarkDateTime,
  processVideoWatermark,
  storeVideoBlobs
} from '../utils/watermark';

interface RecordingStudioProps {
  seller: SellerAccount;
  onCancel: () => void;
  onDossierCreated: (dossier: Dossier) => void;
  onPhaseChange?: (phase: 'setup' | 'recording' | 'processing' | 'error') => void;
}

// Helper for safe video mime types supported across Chromium, Safari, Firefox and mobile
const getSupportedVideoMimeType = (): string => {
  const mimeTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4'
  ];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return '';
  }
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
};

export const RecordingStudio: React.FC<RecordingStudioProps> = ({
  seller,
  onCancel,
  onDossierCreated,
  onPhaseChange
}) => {
  // Wizard state: 'setup' | 'recording' | 'processing' | 'error'
  const [phase, setPhase] = useState<'setup' | 'recording' | 'processing' | 'error'>('setup');

  // Mobile immersive modals
  const [showTipSheet, setShowTipSheet] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Order Details
  const [marketplace, setMarketplace] = useState<Marketplace>('Mercado Livre');
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [productName, setProductName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [accessories, setAccessories] = useState('Carregador, Cabo original e Manual');
  const [packageType, setPackageType] = useState('Caixa de papelão com plástico bolha 3 camadas');
  const [sellerName, setSellerName] = useState(seller.sellerName || 'Expedidor ProvaPack');
  const [notes, setNotes] = useState('');

  // AI OCR Label scanner state
  const [isScanningLabel, setIsScanningLabel] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);

  // Recording engine state
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [capturedCheckpoints, setCapturedCheckpoints] = useState<CheckpointFrame[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('Processando gravação ininterrupta...');
  const [discreteNotice, setDiscreteNotice] = useState<string | null>(null);
  const recordingHasAudioRef = useRef<boolean>(false);

  // Forensic Watermark and Temporal Metadata
  const [recordingId, setRecordingId] = useState<string>(() => generateRecordingId());
  const [startedAtUtc, setStartedAtUtc] = useState<string>('');
  const [startedAtTimestamp, setStartedAtTimestamp] = useState<number>(0);
  const [serverTime, setServerTime] = useState<string | undefined>(undefined);
  const [timeSource, setTimeSource] = useState<TimeSource>('DEVICE');
  const [timeDivergenceMs, setTimeDivergenceMs] = useState<number | undefined>(undefined);
  const [timeDivergenceNote, setTimeDivergenceNote] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo');
  const [timezoneOffsetFormatted, setTimezoneOffsetFormatted] = useState<string>(() => getTimezoneOffsetString());
  const [liveClockTime, setLiveClockTime] = useState<Date>(new Date());

  // Processing pipeline states
  const [processingStage, setProcessingStage] = useState<ProcessingStatus>('RECORDING');
  const [processingPct, setProcessingPct] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [originalBlobHolder, setOriginalBlobHolder] = useState<Blob | null>(null);
  const [originalSha256Holder, setOriginalSha256Holder] = useState<string>('');
  const [processedBlobHolder, setProcessedBlobHolder] = useState<Blob | null>(null);
  const [processedSha256Holder, setProcessedSha256Holder] = useState<string>('');

  // Media references
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Automatically attach media stream whenever video DOM node mounts or changes
  const assignVideoRef = (node: HTMLVideoElement | null) => {
    videoPreviewRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
      }
      node.play().catch(() => {});
    }
  };

  // Re-sync camera stream to video preview on phase change
  useEffect(() => {
    if (videoPreviewRef.current && mediaStreamRef.current) {
      if (videoPreviewRef.current.srcObject !== mediaStreamRef.current) {
        videoPreviewRef.current.srcObject = mediaStreamRef.current;
      }
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [phase]);

  // Quick accessory templates
  const accessoryPresets = [
    'Carregador + Cabo',
    'Manual + Certificado',
    'Fone de Ouvido',
    'Fonte de Alimentação',
    'Chavinha Gaveta SIM',
    'Brinde Promocional'
  ];

  // Initialize camera stream
  const startCamera = async (preferBack = true) => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream;
        try {
          // Attempt 1: Video with ideal dimensions + audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: preferBack ? { ideal: 'environment' } : 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: true
          });
        } catch (audioErr) {
          console.warn('Microfone indisponível ou negado, tentando apenas câmera de vídeo:', audioErr);
          try {
            // Attempt 2: Video only (handles cases where microphone is blocked or absent)
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: preferBack ? { ideal: 'environment' } : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          } catch (facingErr) {
            console.warn('Tentativa com facingMode falhou, tentando fallback simples de vídeo:', facingErr);
            // Attempt 3: Simplest video fallback
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }

        mediaStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(() => {});
        }
        setCameraError(null);
      } else {
        throw new Error('Navegador sem suporte direto a getUserMedia.');
      }
    } catch (err: any) {
      console.warn('Câmera física indisponível:', err);
      setCameraError('Não foi possível acessar a câmera.');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Capture single frame from current stream
  const grabCurrentFrame = (targetStepIdx?: number): string => {
    const video = videoPreviewRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const effectiveStepIdx = typeof targetStepIdx === 'number' ? targetStepIdx : currentStepIdx;
    const step = RECORDING_STEPS[effectiveStepIdx] || RECORDING_STEPS[0];

    // Check if real camera video is streaming and has active frames
    const hasLiveVideo = video && (video.videoWidth > 0 || video.readyState >= 2);

    if (hasLiveVideo && video) {
      const origWidth = video.videoWidth || 1280;
      const origHeight = video.videoHeight || 720;

      // Scale to max 800px width for checkpoint snapshots to optimize memory and prevent quota issues
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / origWidth);
      const width = Math.round(origWidth * scale);
      const height = Math.round(origHeight * scale);

      canvas.width = width;
      canvas.height = height;

      // Draw real live camera frame
      ctx.drawImage(video, 0, 0, width, height);

      // Watermark bar
      const barHeight = Math.max(26, Math.round(36 * scale));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(0, height - barHeight, width, barHeight);

      const fontSize = Math.max(10, Math.round(13 * scale));
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`PROVAPACK • PASSO ${step.number}/7: ${step.title.toUpperCase()}`, 12, height - Math.round(barHeight / 3));

      ctx.fillStyle = '#f8fafc';
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`${new Date().toLocaleTimeString('pt-BR')} • ${orderNumber || 'PEDIDO'}`, width - 12, height - Math.round(barHeight / 3));

      return canvas.toDataURL('image/jpeg', 0.78);
    }

    return '';
  };

  // OCR Auto-detect using Gemini API via /api/ai/ocr-label
  const handleScanLabelWithAI = async () => {
    setIsScanningLabel(true);
    setOcrMessage('Capturando e analisando etiqueta com IA...');

    try {
      const frameBase64 = grabCurrentFrame();
      const res = await fetch('/api/ai/ocr-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: frameBase64 })
      });

      if (!res.ok) {
        setOcrMessage('Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.');
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.orderNumber) setOrderNumber(json.data.orderNumber);
        if (json.data.trackingCode) setTrackingCode(json.data.trackingCode);
        if (json.data.serialNumber) setSerialNumber(json.data.serialNumber);
        if (json.data.productName && !productName) setProductName(json.data.productName);
        if (json.data.marketplace) {
          const match = ['Mercado Livre', 'Shopee', 'Amazon Brasil', 'Magalu'].find(m => 
            json.data.marketplace.toLowerCase().includes(m.toLowerCase())
          );
          if (match) setMarketplace(match as Marketplace);
        }
        setOcrMessage(json.message || 'Dados lidos com sucesso da etiqueta/produto!');
      } else {
        setOcrMessage('Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.');
      }
    } catch {
      setOcrMessage('Não foi possível identificar automaticamente os dados da etiqueta. Preencha ou confirme manualmente.');
    } finally {
      setIsScanningLabel(false);
      setTimeout(() => setOcrMessage(null), 4000);
    }
  };

  // Start continuous 7-step recording
  const handleStartRecording = async () => {
    if (!productName.trim() || !orderNumber.trim()) {
      alert('Por favor, informe o nome do produto e o número do pedido antes de iniciar a gravação.');
      return;
    }

    if (!mediaStreamRef.current || cameraError) {
      alert('Não foi possível acessar a câmera.');
      return;
    }

    // 1. Immutable unique recording ID (PP-YYYYMMDD-XXXXXX)
    const newRecId = generateRecordingId();
    setRecordingId(newRecId);

    // 2. Temporal synchronization
    const now = new Date();
    const startTs = now.getTime();
    setStartedAtTimestamp(startTs);
    setStartedAtUtc(now.toISOString());
    setLiveClockTime(now);

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    const tzOffset = getTimezoneOffsetString(now);
    setTimezone(localTz);
    setTimezoneOffsetFormatted(tzOffset);

    // Query server time reference from backend (/api/time)
    try {
      const res = await fetch('/api/time');
      if (res.ok) {
        const timeData = await res.json();
        setServerTime(timeData.utc);
        setTimeSource('DEVICE_WITH_SERVER_REFERENCE');
        const divergence = Math.abs(startTs - timeData.timestamp);
        setTimeDivergenceMs(divergence);
        if (divergence > 10000) {
          setTimeDivergenceNote(`Divergência detectada de ${Math.round(divergence / 1000)}s entre relógio local e servidor central.`);
        }
      } else {
        setTimeSource('DEVICE');
      }
    } catch {
      // Offline mode - fallback gracefully to device time
      setTimeSource('DEVICE');
    }

    setPhase('recording');
    setCurrentStepIdx(0);
    setRecordingSeconds(0);
    setCapturedCheckpoints([]);
    recordedChunksRef.current = [];
    setProcessingError(null);

    // Setup MediaRecorder on active stream with multi-codec resilience and video-only fallback
    try {
      if (mediaStreamRef.current) {
        const activeTracks = mediaStreamRef.current.getTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length === 0) {
          console.warn('Tracks do mediaStream não estão ativos. Reiniciando câmera.');
          await startCamera(true);
        }

        // P4: Detect if live audio track is present in active media stream
        const hasLiveAudio = mediaStreamRef.current ? mediaStreamRef.current.getAudioTracks().some(t => t.readyState === 'live') : false;
        recordingHasAudioRef.current = hasLiveAudio;

        const chosenMime = getSupportedVideoMimeType();
        let recorder: MediaRecorder | null = null;

        try {
          if (chosenMime) {
            recorder = new MediaRecorder(mediaStreamRef.current, {
              mimeType: chosenMime,
              videoBitsPerSecond: 2500000
            });
          } else {
            recorder = new MediaRecorder(mediaStreamRef.current);
          }
        } catch (err1) {
          console.warn('Tentativa 1 MediaRecorder falhou, tentando padrão do navegador:', err1);
          try {
            recorder = new MediaRecorder(mediaStreamRef.current);
          } catch (err2) {
            console.warn('Tentativa 2 falhou, tentando apenas faixas de vídeo sem microfone:', err2);
            const videoTracks = mediaStreamRef.current.getVideoTracks();
            if (videoTracks.length > 0) {
              const videoOnlyStream = new MediaStream(videoTracks);
              recorder = chosenMime ? new MediaRecorder(videoOnlyStream, { mimeType: chosenMime }) : new MediaRecorder(videoOnlyStream);
            }
          }
        }

        if (recorder) {
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          recorder.onerror = (errEvent) => {
            console.error('Erro no MediaRecorder durante gravação:', errEvent);
          };

          // Collect chunks every 400ms to avoid losing any tail frames
          recorder.start(400);
          mediaRecorderRef.current = recorder;
        }
      }
    } catch (e) {
      console.warn('Erro ao inicializar MediaRecorder:', e);
    }

    // Start timer & live watermark clock
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
      setLiveClockTime(new Date());
    }, 1000);

    // Initial snapshot for Step 1
    setTimeout(() => {
      captureStepSnapshot(0);
    }, 1200);
  };

  // Capture snapshot for given step
  const captureStepSnapshot = (stepIndex: number) => {
    const step = RECORDING_STEPS[stepIndex];
    if (!step) return;

    const frameUrl = grabCurrentFrame(stepIndex);
    if (!frameUrl || frameUrl.length < 100 || !frameUrl.startsWith('data:image')) {
      setDiscreteNotice('Não foi possível registrar a imagem deste passo.');
      setTimeout(() => {
        setDiscreteNotice(prev => (prev === 'Não foi possível registrar a imagem deste passo.' ? null : prev));
      }, 3500);
      return;
    }

    const newCheckpoint: CheckpointFrame = {
      stepId: step.id,
      stepTitle: `${step.number}. ${step.title}`,
      timestampSeconds: recordingSeconds,
      formattedTime: formatSecondsToTime(recordingSeconds),
      imageDataUrl: frameUrl
    };

    setCapturedCheckpoints((prev) => {
      const filtered = prev.filter(cp => cp.stepId !== step.id);
      return [...filtered, newCheckpoint].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    });
  };

  // Advance to next step in recording
  const handleNextStep = () => {
    // Snap current step before leaving if not yet snapped
    captureStepSnapshot(currentStepIdx);

    if (currentStepIdx < RECORDING_STEPS.length - 1) {
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      setTimeout(() => {
        captureStepSnapshot(nextIdx);
      }, 500);
    } else {
      // Finished all 7 steps!
      handleFinishRecording();
    }
  };

  // Go to previous step if needed
  const handlePrevStep = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  // Finish continuous recording and compile dossier with permanent watermark
  const handleFinishRecording = async () => {
    const lastStep = RECORDING_STEPS[currentStepIdx] || RECORDING_STEPS[RECORDING_STEPS.length - 1];
    const lastFrame = grabCurrentFrame(currentStepIdx);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    setPhase('processing');
    setProcessingStage('RECORDING');
    setProcessingPct(20);
    setProcessingStatus('Finalizando gravação ininterrupta da câmera...');

    // Stop recorder & retrieve original video chunks
    let recordedBlob: Blob | null = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch (e) {
        console.warn('requestData:', e);
      }
      const stopPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
      await Promise.race([stopPromise, new Promise(r => setTimeout(r, 1200))]);
    }

    if (recordedChunksRef.current.length > 0) {
      const mime = recorder?.mimeType || getSupportedVideoMimeType() || 'video/webm';
      recordedBlob = new Blob(recordedChunksRef.current, { type: mime });
    }

    if (!recordedBlob || recordedBlob.size === 0) {
      setProcessingError('Não foi possível concluir a gravação. Nenhuma evidência foi registrada.');
      setPhase('error');
      return;
    }

    // Step 1: Preserve original camera recording
    setProcessingStage('ORIGINAL_SAVED');
    setOriginalBlobHolder(recordedBlob);
    setProcessingPct(30);
    setProcessingStatus('Arquivo de vídeo original preservado...');

    // Step 2: Calculate cryptographic SHA-256 of the original video
    setProcessingStage('HASHING_ORIGINAL');
    let originalHash = '';
    try {
      originalHash = await calculateBlobSha256(recordedBlob);
      setOriginalSha256Holder(originalHash);
      setProcessingPct(50);
      setProcessingStatus('Hash SHA-256 do vídeo original calculado.');
    } catch {
      setProcessingError('Não foi possível calcular o hash SHA-256 do arquivo original.');
      setPhase('error');
      return;
    }

    // Step 3: Process video watermark burning badge onto video frames
    setProcessingStage('PROCESSING');
    setProcessingPct(60);
    setProcessingStatus('Incorporando carimbo de data/hora nos frames...');

    let processedBlob: Blob | null = null;
    let processedHash = '';

    try {
      processedBlob = await processVideoWatermark(recordedBlob, {
        startedAtTimestamp: startedAtTimestamp || Date.now(),
        recordingId,
        durationSeconds: recordingSeconds,
        timezoneOffsetFormatted,
        requiresAudio: recordingHasAudioRef.current,
        onProgress: (pct, msg) => {
          setProcessingPct(Math.round(50 + pct * 0.45));
          setProcessingStatus(msg);
        }
      });
      processedHash = await calculateBlobSha256(processedBlob);
      setProcessedBlobHolder(processedBlob);
      setProcessedSha256Holder(processedHash);
      setProcessingPct(95);
    } catch (watermarkErr: any) {
      console.warn('Falha no processamento da marca d\'água:', watermarkErr);
      setProcessingStage('FAILED');
      setProcessingError(watermarkErr?.message || 'O vídeo original foi preservado, mas a versão ProvaPack com marca d\'água não foi gerada.');
      return;
    }

    setProcessingStage('READY');
    setProcessingPct(100);
    setProcessingStatus('Registro técnico ProvaPack gerado com sucesso.');

    await finalizeDossier(recordedBlob, originalHash, processedBlob, processedHash);
  };

  const handleRetryWatermark = async () => {
    if (!originalBlobHolder || !originalSha256Holder) return;
    setProcessingStage('PROCESSING');
    setProcessingPct(60);
    setProcessingStatus('Tentando gerar versão ProvaPack com marca d\'água novamente...');
    setProcessingError(null);

    try {
      const processedBlob = await processVideoWatermark(originalBlobHolder, {
        startedAtTimestamp: startedAtTimestamp || Date.now(),
        recordingId,
        durationSeconds: recordingSeconds,
        timezoneOffsetFormatted,
        requiresAudio: recordingHasAudioRef.current,
        onProgress: (pct, msg) => {
          setProcessingPct(Math.round(50 + pct * 0.45));
          setProcessingStatus(msg);
        }
      });
      const processedHash = await calculateBlobSha256(processedBlob);
      setProcessedBlobHolder(processedBlob);
      setProcessedSha256Holder(processedHash);
      setProcessingPct(100);
      setProcessingStage('READY');
      setProcessingStatus('Registro técnico ProvaPack gerado com sucesso.');
      await finalizeDossier(originalBlobHolder, originalSha256Holder, processedBlob, processedHash);
    } catch (watermarkErr: any) {
      setProcessingStage('FAILED');
      setProcessingError(watermarkErr?.message || 'O vídeo original foi preservado, mas a versão ProvaPack com marca d\'água não foi gerada.');
    }
  };

  const handleDownloadOriginalOnly = () => {
    if (!originalBlobHolder) return;
    const url = URL.createObjectURL(originalBlobHolder);
    const a = document.createElement('a');
    a.href = url;
    const ext = originalBlobHolder.type.includes('mp4') ? 'mp4' : 'webm';
    const slug = (orderNumber || recordingId || 'gravacao').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `ORIGINAL_${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const finalizeDossier = async (
    originalBlob: Blob,
    originalHash: string,
    processedBlob: Blob,
    processedHash: string
  ) => {
    // Only real checkpoints effectively captured during recording
    const finalCheckpoints = [...capturedCheckpoints].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

    const dossierId = generateDossierId();
    const nowIso = new Date().toISOString();
    const originalUrl = URL.createObjectURL(originalBlob);
    const processedUrl = URL.createObjectURL(processedBlob);

    // Save blobs in memory store for instant export / downloads
    storeVideoBlobs(dossierId, originalBlob, processedBlob);

    const evidence: EvidenceRecording = {
      id: 'evid-' + Date.now(),
      recordingId,
      orderId: orderNumber.trim() || undefined,
      originalVideoUri: originalUrl,
      processedVideoUri: processedUrl,
      startedAtUtc: startedAtUtc || nowIso,
      endedAtUtc: nowIso,
      deviceTime: formatWatermarkDateTime(new Date(startedAtTimestamp || Date.now())),
      serverTime,
      timeSource,
      timezone,
      timezoneOffsetFormatted,
      durationMs: Math.max(1, recordingSeconds) * 1000,
      originalSha256: originalHash,
      processedSha256: processedHash,
      processingStatus: 'READY',
      createdAt: nowIso,
      timeDivergenceMs,
      timeDivergenceNote
    };

    const newDossier: Dossier = {
      id: dossierId,
      recordingId,
      marketplace,
      orderNumber: orderNumber.trim(),
      trackingCode: trackingCode.trim() || undefined,
      productName: productName.trim(),
      serialNumber: serialNumber.trim() || undefined,
      accessories: accessories.trim() || 'Conferidos na gravação contínua',
      packageType: packageType.trim() || 'Caixa lacrada',
      sellerName: sellerName.trim() || seller.sellerName,
      recordedAt: nowIso,
      formattedDate: formatBrasiliaDate(nowIso),
      durationSeconds: Math.max(1, recordingSeconds),
      fileHashSha256: processedHash, // Primary hash is the watermarked derived video
      originalSha256: originalHash,
      processedSha256: processedHash,
      fileSizeBytes: processedBlob.size,
      videoBlobUrl: processedUrl, // Primary video is watermarked
      originalVideoBlobUrl: originalUrl,
      processedVideoBlobUrl: processedUrl,
      videoMimeType: processedBlob.type || 'video/webm',
      checkpoints: finalCheckpoints,
      status: 'validado',
      verificationStatus: 'Registro técnico ProvaPack',
      notes: notes.trim() || undefined,
      evidenceRecording: evidence,
      timeSource,
      timezone,
      timezoneOffsetFormatted
    };

    // Save locally
    saveDossierToStorage(newDossier);

    // Send to backend and check Supabase persistence status
    let isPersistedOnline = false;
    let onlineNotice = '';

    try {
      setProcessingStatus('Registrando metadados no Supabase...');
      const serverRes = await fetch('/api/dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newDossier.id,
          public_id: newDossier.id,
          recording_id: newDossier.recordingId,
          marketplace: newDossier.marketplace,
          order_number: newDossier.orderNumber,
          tracking_code: newDossier.trackingCode,
          product_name: newDossier.productName,
          serial_number: newDossier.serialNumber,
          recorded_at: newDossier.recordedAt,
          duration_seconds: newDossier.durationSeconds,
          original_sha256: newDossier.originalSha256,
          processed_sha256: newDossier.processedSha256,
          file_size_bytes: newDossier.fileSizeBytes,
          status: newDossier.status,
          time_source: newDossier.timeSource,
          timezone: newDossier.timezone
        })
      });

      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json.success && json.persistedToSupabase) {
          isPersistedOnline = true;
          onlineNotice = 'Registro online confirmado';
        } else {
          isPersistedOnline = false;
          onlineNotice = 'Seus arquivos foram gerados, mas o registro online não foi confirmado.';
        }
      } else {
        isPersistedOnline = false;
        onlineNotice = 'Seus arquivos foram gerados, mas o registro online não foi confirmado.';
      }
    } catch (netErr) {
      console.warn('Erro ao conectar com servidor para registro online:', netErr);
      isPersistedOnline = false;
      onlineNotice = 'Seus arquivos foram gerados, mas o registro online não foi confirmado.';
    }

    newDossier.onlinePersisted = isPersistedOnline;
    if (newDossier.evidenceRecording) {
      newDossier.evidenceRecording.onlinePersisted = isPersistedOnline;
    }
    newDossier.verificationStatus = isPersistedOnline 
      ? 'Registro online confirmado' 
      : 'Registro local (Online pendente)';

    // Update storage with final online confirmation status (without deducting quota again)
    updateDossierInStorage(newDossier);

    setProcessingStatus(onlineNotice);
    setTimeout(() => {
      onDossierCreated(newDossier);
    }, 1200);
  };

  const requestCancelRecording = () => {
    // If recording has active progress, ask for confirmation to prevent accidental loss
    if (recordingSeconds > 0 || capturedCheckpoints.length > 0) {
      setShowCancelConfirmModal(true);
    } else {
      executeCancelRecording();
    }
  };

  const executeCancelRecording = () => {
    setShowCancelConfirmModal(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    onCancel();
  };

  const activeStep = RECORDING_STEPS[currentStepIdx] || RECORDING_STEPS[0];

  return (
    <div className={phase === 'recording' ? 'w-full md:max-w-6xl md:mx-auto md:px-4 md:py-6' : 'max-w-6xl mx-auto px-4 py-6'}>
      {/* Hidden canvas for image frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* PHASE 1: PRE-FLIGHT SETUP */}
      {phase === 'setup' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-950 text-sky-400 border border-sky-800">
                  Passo Prévio
                </span>
                <span className="text-xs text-slate-400">Identificação do Envio</span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">
                Novo Empacotamento Monitorado
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Informe os dados do pedido. Em seguida, o aplicativo conduzirá a gravação contínua sem cortes em 7 etapas.
              </p>
            </div>

            <button
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>

          {/* Form and Camera Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Marketplace */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Canal / Marketplace *
                  </label>
                  <select
                    value={marketplace}
                    onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Mercado Livre">Mercado Livre</option>
                    <option value="Shopee">Shopee</option>
                    <option value="Amazon Brasil">Amazon Brasil</option>
                    <option value="Instagram / WhatsApp">Instagram / WhatsApp</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                    <option value="Magalu">Magalu</option>
                    <option value="Loja Própria / Outros">Loja Própria / Outros</option>
                  </select>
                </div>

                {/* Order Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Número do Pedido *
                    </label>
                    <button
                      type="button"
                      onClick={handleScanLabelWithAI}
                      disabled={isScanningLabel}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                    >
                      <Scan className="w-3 h-3" />
                      <span>{isScanningLabel ? 'Lendo...' : 'Ler Etiqueta com IA'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex: MLB-948201948 ou 702-84920"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {ocrMessage && (
                <div className="p-2.5 rounded-xl bg-sky-950/70 border border-sky-800/80 text-sky-300 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
                  <span>{ocrMessage}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: iPhone 14 Pro 128GB Roxo ou Furadeira Bosch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Serial & Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Número de Série / IMEI (se houver)
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Ex: RF8W91X4082M ou IMEI"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Código de Rastreio (se já impresso)
                  </label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="Ex: BR948294820SL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              {/* Accessories Checklist */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Acessórios e Componentes Inclusos
                </label>
                <input
                  type="text"
                  value={accessories}
                  onChange={(e) => setAccessories(e.target.value)}
                  placeholder="Ex: Carregador, Cabo original, Chavinha SIM..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {accessoryPresets.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (!accessories.includes(preset)) {
                          setAccessories(prev => prev ? `${prev}, ${preset}` : preset);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Packaging type */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Embalagem e Proteção
                </label>
                <input
                  type="text"
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  placeholder="Ex: Caixa de papelão com plástico bolha 3 camadas"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Right Column: Camera Readiness Preview */}
            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-sky-400" />
                    Enquadramento da Câmera de Bancada
                  </span>
                  <button
                    type="button"
                    onClick={() => startCamera(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Alternar Câmera</span>
                  </button>
                </div>

                <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
                  <video
                    ref={assignVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover block"
                  />

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-10">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-white mb-1">
                        Não foi possível acessar a câmera.
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-xs mb-4">
                        Verifique as permissões de acesso ao dispositivo no navegador.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startCamera(true)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Tentar novamente</span>
                        </button>
                        <button
                          type="button"
                          onClick={onCancel}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Watermark Overlay in preview */}
                  {!cameraError && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-sky-300">
                      LIVE PREVIEW
                    </div>
                  )}
                </div>

                {/* 7-Step Script Preview */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Roteiro Contínuo que você irá gravar:
                  </div>
                  <ol className="space-y-1.5 text-[11px] text-slate-400">
                    {RECORDING_STEPS.map((step) => (
                      <li key={step.id} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-800 text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {step.number}
                        </span>
                        <span className="text-slate-300">{step.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Start recording CTA */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleStartRecording}
                  id="btn-start-continuous-recording"
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 active:scale-98 transition-all"
                >
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  <span>Iniciar Gravação Contínua Sem Cortes</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  A gravação é contínua e sem pausas para garantir a idoneidade do dossiê.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: ACTIVE 7-STEP CONTINUOUS RECORDING */}
      {phase === 'recording' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden md:static md:inset-auto md:z-auto md:bg-slate-900 md:border md:border-slate-800 md:rounded-3xl md:p-5 md:sm:p-7 md:shadow-2xl md:overflow-visible">
          {/* MOBILE COMPACT HEADER (Requirement 2: ProvaPack logo, 2/7, height 48-56px, no commercial clutter) */}
          <header className="h-12 sm:h-14 px-3 sm:px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0 md:hidden z-30 pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-white tracking-tight font-['Plus_Jakarta_Sans']">
                Prova<span className="text-sky-400">Pack</span>
              </span>
            </div>

            {/* Mobile Progress indicator: compact dots + 2/7 badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {RECORDING_STEPS.map((step, idx) => (
                  <span
                    key={step.id}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentStepIdx
                        ? 'w-4 bg-sky-400'
                        : idx < currentStepIdx || capturedCheckpoints.some(cp => cp.stepId === step.id)
                        ? 'w-1.5 bg-emerald-400'
                        : 'w-1.5 bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
                {activeStep.number}/7
              </span>

              <button
                type="button"
                onClick={requestCancelRecording}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-slate-800 hover:bg-slate-800/80 transition-colors ml-1"
                title="Cancelar gravação"
              >
                Sair
              </button>
            </div>
          </header>

          {/* DESKTOP TOP RECORDING BAR (Preserved on >= 768px, hidden on mobile) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/80 border border-red-800/80 text-red-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>REC CONTÍNUO</span>
              </div>

              <div className="text-2xl font-mono font-bold text-white">
                {formatSecondsToTime(recordingSeconds)}
              </div>

              <span className="text-xs text-slate-400 hidden sm:inline">
                • Gravando sem cortes
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-white block">
                {productName}
              </span>
              <span className="text-[11px] text-slate-400">
                {marketplace} • Pedido: {orderNumber || 'S/N'}
              </span>
            </div>
          </div>

          {/* DESKTOP STEPPER HEADER (1 to 7 grid, preserved on >= 768px, hidden on mobile) */}
          <div className="hidden md:grid mt-4 grid-cols-7 gap-1 sm:gap-2">
            {RECORDING_STEPS.map((step, idx) => {
              const isActive = idx === currentStepIdx;
              const isPast = idx < currentStepIdx;
              const hasPhoto = capturedCheckpoints.some(cp => cp.stepId === step.id);

              return (
                <div
                  key={step.id}
                  onClick={() => setCurrentStepIdx(idx)}
                  className={`cursor-pointer rounded-xl p-1.5 sm:p-2 text-center transition-all ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                      : isPast || hasPhoto
                      ? 'bg-emerald-950/50 border border-emerald-800/80 text-emerald-400'
                      : 'bg-slate-950 border border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="text-[10px] sm:text-xs font-mono leading-none">
                    <span className="hidden sm:inline">Passo </span>
                    <span className="sm:hidden">P</span>{step.number}
                  </div>
                  <div className="text-xs truncate font-medium mt-0.5 hidden md:block">
                    {step.title.replace('Mostre ', '')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CENTRAL RECORDING CANVAS / VIEWFINDER */}
          <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-3 md:p-0 md:grid md:grid-cols-12 md:gap-6 md:mt-5 overflow-hidden md:overflow-visible">
            {/* Viewfinder Video Stream with Guidance Overlays */}
            <div className="flex-1 min-h-0 relative w-full rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center bg-black shadow-lg md:flex-initial md:aspect-video md:col-span-8">
              <video
                ref={assignVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover block"
              />

              {/* Viewfinder Target / Crosshair Grid */}
              <div className="absolute inset-0 pointer-events-none border border-white/10 m-3 sm:m-6 rounded-xl flex items-center justify-center">
                <div className="w-6 sm:w-12 h-6 sm:h-12 border-t-2 border-l-2 border-sky-400 absolute top-0 left-0" />
                <div className="w-6 sm:w-12 h-6 sm:h-12 border-t-2 border-r-2 border-sky-400 absolute top-0 right-0" />
                <div className="w-6 sm:w-12 h-6 sm:h-12 border-b-2 border-l-2 border-sky-400 absolute bottom-0 left-0" />
                <div className="w-6 sm:w-12 h-6 sm:h-12 border-b-2 border-r-2 border-sky-400 absolute bottom-0 right-0" />
              </div>

              {/* Camera Error Screen (Requirement 13: same area on mobile & desktop) */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-30">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Não foi possível acessar a câmera.
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs mb-4">
                    Verifique as permissões de acesso ao dispositivo no navegador.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Tentar novamente</span>
                    </button>
                    <button
                      type="button"
                      onClick={executeCancelRecording}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold active:scale-95"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* MOBILE OVERLAY: Compact REC & Timer Badge (Requirement 4) */}
              <div className="md:hidden absolute top-2.5 left-2.5 z-20 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-red-500/40 text-red-400 text-[11px] font-mono font-bold shadow-md">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>REC</span>
                  <span className="text-white ml-1">{formatSecondsToTime(recordingSeconds)}</span>
                </div>
              </div>

              {/* MOBILE OVERLAY: Quick camera switch button */}
              <div className="md:hidden absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startCamera(false)}
                  className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white text-xs active:scale-90 transition-transform"
                  title="Alternar Câmera"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Discrete Notice Banner (P2 requirement) */}
              {discreteNotice && (
                <div className="absolute top-16 left-4 right-4 z-30 flex justify-center pointer-events-none">
                  <div className="bg-amber-950/95 border border-amber-500/80 text-amber-200 text-xs px-3.5 py-1.5 rounded-lg shadow-xl backdrop-blur-sm font-medium animate-pulse text-center">
                    {discreteNotice}
                  </div>
                </div>
              )}

              {/* MOBILE OVERLAY: Active Step Guidance Pin on Video (Requirement 6 & 8) */}
              <div className="md:hidden absolute top-11 left-2.5 right-2.5 z-20">
                <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {activeStep.number}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {activeStep.title}
                      </span>
                    </div>

                    {/* Compact Anti-Fraud Tip Button (Requirement 8) */}
                    <button
                      type="button"
                      onClick={() => setShowTipSheet(true)}
                      className="min-h-[26px] px-2 py-0.5 rounded-lg bg-amber-950/70 border border-amber-700/70 text-amber-300 text-[10px] font-semibold flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Dica</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-200 mt-1 leading-tight line-clamp-2">
                    {activeStep.instruction}
                  </p>
                  {activeStep.instruction.length > 70 && (
                    <button
                      type="button"
                      onClick={() => setShowInstructionModal(true)}
                      className="text-[10px] text-sky-400 font-semibold underline mt-0.5 block"
                    >
                      Ver instrução
                    </button>
                  )}
                </div>
              </div>

              {/* DESKTOP OVERLAY: Active Step Prompt Pin on Video */}
              <div className="hidden md:block absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 pointer-events-none">
                <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-xl max-w-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sky-500 text-slate-950 text-[10px] sm:text-xs font-extrabold flex items-center justify-center shrink-0">
                      {activeStep.number}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white line-clamp-1">{activeStep.title}</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-200 mt-1 leading-snug line-clamp-2 sm:line-clamp-none">
                    {activeStep.instruction}
                  </p>
                </div>
              </div>

              {/* DESKTOP OVERLAY: Live Forensic Watermark Badge */}
              <div className="hidden md:block absolute bottom-2 sm:bottom-4 right-2 sm:right-4 z-20 pointer-events-none">
                <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 sm:p-2.5 text-right shadow-2xl font-mono">
                  <div className="text-[10px] sm:text-[11px] font-bold text-sky-400 tracking-wider">
                    PROVAPACK
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-white tracking-wide">
                    {formatWatermarkDateTime(liveClockTime)}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400">
                    {timezoneOffsetFormatted}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-semibold text-sky-300">
                    Registro: {recordingId}
                  </div>
                </div>
              </div>

              {/* MOBILE OVERLAY: Photo Checkpoint Button & Discrete Indicator (Requirement 9) */}
              <div className="md:hidden absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => capturedCheckpoints.length > 0 && setShowGalleryModal(true)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-slate-700/80 text-slate-300 text-xs font-mono flex items-center gap-1.5 active:scale-95 transition-transform"
                  title="Ver fotos capturadas"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-400" />
                  <span>{capturedCheckpoints.length}/7</span>
                  {capturedCheckpoints.some(cp => cp.stepId === activeStep.id) && (
                    <span className="text-emerald-400 font-bold ml-0.5">✓</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => captureStepSnapshot(currentStepIdx)}
                  id="btn-mobile-capture-frame"
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all whitespace-nowrap ${
                    capturedCheckpoints.some(cp => cp.stepId === activeStep.id)
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  }`}
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>
                    {capturedCheckpoints.some(cp => cp.stepId === activeStep.id)
                      ? `✓ Foto ${activeStep.number} Registrada`
                      : `Foto Passo ${activeStep.number}`}
                  </span>
                </button>
              </div>

              {/* DESKTOP OVERLAY: Frame capture button */}
              <div className="hidden md:flex absolute bottom-2 sm:bottom-4 left-2 sm:left-4 z-20 items-center gap-2">
                <div className="text-[9px] sm:text-[11px] font-mono text-white/90 bg-black/60 px-2 sm:px-2.5 py-1 rounded-lg backdrop-blur-xs hidden xs:block">
                  SHA-256 SYNC
                </div>

                <button
                  type="button"
                  onClick={() => captureStepSnapshot(currentStepIdx)}
                  id="btn-capture-checkpoint-frame"
                  className="px-3 sm:px-4 py-2 rounded-xl bg-sky-500/95 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Foto Passo {activeStep.number}</span>
                </button>
              </div>
            </div>

            {/* DESKTOP RIGHT COLUMN: Instruction, Tips & Step Actions (Requirement 7: hidden on mobile) */}
            <div className="hidden md:flex md:col-span-4 flex-col justify-between bg-slate-950/80 rounded-2xl border border-slate-800 p-5">
              <div>
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                  Etapa {activeStep.number} de 7
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {activeStep.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {activeStep.instruction}
                </p>

                {/* Pro Tip */}
                <div className="mt-4 p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-sky-300">Dica Anti-Fraude:</div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      {activeStep.tip}
                    </p>
                  </div>
                </div>

                {/* Checkpoint Status */}
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-400 mb-2">
                    Fotos registradas ({capturedCheckpoints.length}/7):
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {capturedCheckpoints.map((cp, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black">
                        <img src={cp.imageDataUrl} alt={cp.stepTitle} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[8px] font-mono text-sky-300">
                          {cp.formattedTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop navigation controls */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStepIdx === 0}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                {currentStepIdx < RECORDING_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    id="btn-next-step"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                  >
                    <span>Próximo Passo ({currentStepIdx + 2}/7)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishRecording}
                    id="btn-finish-dossier"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Concluir & Criar Dossiê</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MOBILE FIXED BOTTOM NAVIGATION BAR (Requirement 10: safe-area aware, always accessible) */}
          <div className="md:hidden shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-2.5 z-30">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIdx === 0}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-slate-300 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {currentStepIdx < RECORDING_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                id="btn-mobile-next-step"
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
              >
                <span>Próximo Passo ({currentStepIdx + 2}/7)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishRecording}
                id="btn-mobile-finish-dossier"
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Concluir & Criar Dossiê</span>
              </button>
            )}
          </div>

          {/* MOBILE POPUPS / SHEETS (Requirements 6, 8, 9) */}
          {showTipSheet && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:hidden">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white">Dica Anti-Fraude • Passo {activeStep.number}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTipSheet(false)}
                    className="text-slate-400 hover:text-white text-xs p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeStep.tip}
                </p>
                <button
                  type="button"
                  onClick={() => setShowTipSheet(false)}
                  className="w-full mt-4 min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          )}

          {showInstructionModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:hidden">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-white">Passo {activeStep.number}: {activeStep.title}</h4>
                  <button
                    type="button"
                    onClick={() => setShowInstructionModal(false)}
                    className="text-slate-400 hover:text-white text-xs p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeStep.instruction}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInstructionModal(false)}
                  className="w-full mt-4 min-h-[44px] py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {showGalleryModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:hidden">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-white">Fotos Registradas ({capturedCheckpoints.length}/7)</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGalleryModal(false)}
                    className="text-slate-400 hover:text-white text-xs p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {capturedCheckpoints.map((cp, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black">
                      <img src={cp.imageDataUrl} alt={cp.stepTitle} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[8px] font-mono text-sky-300">
                        {cp.formattedTime}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowGalleryModal(false)}
                  className="w-full mt-4 min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Voltar à Gravação
                </button>
              </div>
            </div>
          )}

          {/* Modal de Confirmação para Evitar Descarte Acidental da Gravação */}
          {showCancelConfirmModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">
                  Descartar gravação em andamento?
                </h4>
                <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                  O vídeo contínuo e todas as fotos registradas até o momento serão descartados. Esta ação não pode ser desfeita.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirmModal(false)}
                    className="w-full sm:flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                  >
                    Continuar Gravando
                  </button>
                  <button
                    type="button"
                    onClick={executeCancelRecording}
                    className="w-full sm:flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
                  >
                    Descartar e Sair
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: CRYPTOGRAPHIC FINALIZATION & FORENSIC WATERMARK PROCESSING */}
      {phase === 'processing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center max-w-xl mx-auto">
          {processingStage !== 'FAILED' ? (
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-4 animate-spin">
              <RefreshCw className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
          )}

          <h3 className="text-xl font-bold text-white">
            {processingStage === 'FAILED'
              ? 'Atenção no Processamento da Marca D\'água'
              : 'Criando Registro Técnico ProvaPack'}
          </h3>

          <p className="text-xs text-slate-400 mt-2">
            {processingStatus}
          </p>

          {/* Progress Bar */}
          {processingStage !== 'FAILED' && (
            <div className="mt-5 w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${processingPct}%` }}
              />
            </div>
          )}

          {/* Failure & Safe Recovery Box */}
          {processingStage === 'FAILED' && (
            <div className="mt-5 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-left">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>O vídeo original foi preservado, mas a versão ProvaPack com marca d'água não foi gerada.</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5">
                {processingError || "O arquivo de vídeo original e o cálculo criptográfico SHA-256 estão preservados."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRetryWatermark}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar processamento novamente</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadOriginalOnly}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar vídeo original</span>
                </button>
              </div>
            </div>
          )}

          {/* Forensic Pipeline Audit Steps */}
          <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Identificador da Sessão:</span>
              <span className="text-sky-400 font-mono text-[11px] font-bold">{recordingId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Gravação contínua sem cortes:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {formatSecondsToTime(recordingSeconds)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Arquivo Original Preservado:</span>
              <span className={originalBlobHolder ? "text-emerald-400 font-bold flex items-center gap-1" : "text-slate-500"}>
                <Check className="w-3.5 h-3.5" /> {originalBlobHolder ? 'Salvo e Intocado' : 'Processando...'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Marca d'água nos frames:</span>
              <span className={processedBlobHolder ? "text-emerald-400 font-bold flex items-center gap-1" : "text-sky-300"}>
                <Sparkles className="w-3.5 h-3.5" /> {processedBlobHolder ? 'Incorporada aos Frames' : `${processingPct}%`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Fonte de Data/Hora:</span>
              <span className="text-slate-200 text-[11px]">
                {timeSource === 'DEVICE_WITH_SERVER_REFERENCE' ? 'Dispositivo + Referência Central' : 'Dispositivo Local'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Fuso Horário Aplicado:</span>
              <span className="text-slate-200 text-[11px] font-mono">{timezoneOffsetFormatted}</span>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: RECORDING ERROR */}
      {phase === 'error' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white">
            Falha na Gravação
          </h3>

          <p className="text-xs text-slate-300 mt-2">
            {processingError || 'Não foi possível concluir a gravação. Nenhuma evidência foi registrada.'}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPhase('setup');
                setProcessingError(null);
                startCamera(true);
              }}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
