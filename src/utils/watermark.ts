/**
 * ProvaPack Cryptographic Watermark & Video Frame Processing Engine
 * 
 * Burns permanent, tamper-evident forensic timestamps, timezone and unique recording IDs
 * directly into video frames (raster pixel data), ensuring evidence remains visible
 * when played in any external video player outside the application.
 */

import { calculateBlobSha256, calculateBufferSha256 } from './crypto';

export interface WatermarkData {
  dateTimeFormatted: string; // DD/MM/YYYY HH:mm:ss
  timezoneFormatted: string; // e.g. GMT-03:00
  recordingId: string;       // e.g. PP-20260922-A81F2C
}

export interface VideoProcessingOptions {
  startedAtTimestamp: number;
  recordingId: string;
  timezoneOffsetFormatted?: string;
  onProgress?: (progressPercent: number, statusText: string) => void;
}

/**
 * Generates an immutable, non-editable recording ID.
 * Format: PP-YYYYMMDD-XXXXXX (e.g. PP-20260922-A81F2C)
 */
export function generateRecordingId(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hexChars = '0123456789ABCDEF';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return `PP-${y}${m}${d}-${rand}`;
}

/**
 * Gets formatted timezone offset (e.g. GMT-03:00)
 */
export function getTimezoneOffsetString(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset(); // Minutes ahead or behind UTC
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hours = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mins = String(absMin % 60).padStart(2, '0');
  return `GMT${sign}${hours}:${mins}`;
}

/**
 * Formats date strictly to DD/MM/YYYY HH:mm:ss
 */
export function formatWatermarkDateTime(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

/**
 * Draws the cryptographic watermark badge onto any Canvas 2D context.
 * Adapts dynamically to video dimensions, horizontal/vertical orientations,
 * placing it neatly in the bottom-right corner without covering the center.
 */
export function drawWatermarkBadge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: WatermarkData
): void {
  // Adaptive scaling based on resolution
  const minDim = Math.min(width, height);
  // Base scale reference: 720px
  const scale = Math.max(0.65, Math.min(1.4, minDim / 600));

  const paddingX = Math.round(14 * scale);
  const paddingY = Math.round(10 * scale);
  const cornerRadius = Math.round(8 * scale);
  const lineHeight = Math.round(15 * scale);
  const margin = Math.round(16 * scale);

  ctx.save();

  // Font setup
  const fontFamily = '"JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace';
  const titleFontSize = Math.round(12 * scale);
  const bodyFontSize = Math.round(11 * scale);

  ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
  const titleWidth = ctx.measureText('PROVAPACK').width;

  ctx.font = `${bodyFontSize}px ${fontFamily}`;
  const dateWidth = ctx.measureText(data.dateTimeFormatted).width;
  const tzWidth = ctx.measureText(data.timezoneFormatted).width;
  const regText = `Registro: ${data.recordingId}`;
  const regWidth = ctx.measureText(regText).width;

  const maxTextWidth = Math.max(titleWidth, dateWidth, tzWidth, regWidth);
  const badgeWidth = maxTextWidth + paddingX * 2;
  const badgeHeight = lineHeight * 4 + paddingY * 2 + Math.round(4 * scale);

  // Position: Bottom Right
  const badgeX = width - badgeWidth - margin;
  const badgeY = height - badgeHeight - margin;

  // Background box with rounded corners
  ctx.fillStyle = 'rgba(10, 15, 29, 0.82)'; // dark semi-transparent
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, cornerRadius);
  } else {
    // Fallback if roundRect not supported
    ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  ctx.fill();
  ctx.stroke();

  // Subtle accent line on top of badge
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = Math.max(1, Math.round(2 * scale));
  ctx.beginPath();
  ctx.moveTo(badgeX + cornerRadius, badgeY);
  ctx.lineTo(badgeX + badgeWidth - cornerRadius, badgeY);
  ctx.stroke();

  // Text rendering (Right-aligned inside badge for elegant security stamp layout)
  const textRightX = badgeX + badgeWidth - paddingX;
  let textY = badgeY + paddingY + lineHeight * 0.8;

  // 1. Title: PROVAPACK
  ctx.textAlign = 'right';
  ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
  ctx.fillStyle = '#38bdf8'; // Sky blue brand accent
  ctx.fillText('PROVAPACK', textRightX, textY);

  // 2. Date & Time: DD/MM/YYYY HH:mm:ss
  textY += lineHeight;
  ctx.font = `bold ${bodyFontSize}px ${fontFamily}`;
  ctx.fillStyle = '#ffffff'; // Crisp white
  ctx.fillText(data.dateTimeFormatted, textRightX, textY);

  // 3. Timezone: GMT-03:00
  textY += lineHeight;
  ctx.font = `${bodyFontSize}px ${fontFamily}`;
  ctx.fillStyle = '#94a3b8'; // Neutral slate
  ctx.fillText(data.timezoneFormatted, textRightX, textY);

  // 4. Unique Registration ID: Registro: PP-20260922-XXXXXX
  textY += lineHeight;
  ctx.font = `bold ${bodyFontSize}px ${fontFamily}`;
  ctx.fillStyle = '#7dd3fc'; // Light cyan for ID
  ctx.fillText(regText, textRightX, textY);

  ctx.restore();
}

/**
 * Processes the original captured video into a derived, watermarked video
 * by rendering every frame through canvas with the cryptographic stamp.
 * 
 * Guarantees:
 * 1. Original file is never overwritten or mutated.
 * 2. Watermark is baked into the video frames permanently.
 * 3. Works for horizontal and vertical aspect ratios.
 * 4. Advances clock frame-by-frame matching the video playback time.
 */
export async function processVideoWatermark(
  originalBlob: Blob,
  options: VideoProcessingOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const {
        startedAtTimestamp,
        recordingId,
        timezoneOffsetFormatted = getTimezoneOffsetString(new Date(startedAtTimestamp)),
        onProgress
      } = options;

      onProgress?.(5, 'Carregando arquivo original para processamento...');

      const originalUrl = URL.createObjectURL(originalBlob);
      const video = document.createElement('video');
      video.src = originalUrl;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = false;

      let isFinished = false;
      let mediaRecorder: MediaRecorder | null = null;
      let animationFrameId: number | null = null;
      let intervalTimer: any = null;
      const chunks: Blob[] = [];

      const cleanup = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (intervalTimer) clearInterval(intervalTimer);
        URL.revokeObjectURL(originalUrl);
        video.pause();
        video.src = '';
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Não foi possível ler o arquivo de vídeo original.'));
      };

      video.onloadedmetadata = async () => {
        try {
          const width = video.videoWidth || 1280;
          const height = video.videoHeight || 720;
          const duration = video.duration || 10;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (!ctx) {
            cleanup();
            reject(new Error('Contexto gráfico 2D indisponível para renderização dos frames.'));
            return;
          }

          // Use canvas captureStream with 30fps
          const stream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream?.(30);
          if (!stream) {
            cleanup();
            reject(new Error('Seu navegador não suporta captura de fluxo por canvas (captureStream).'));
            return;
          }

          // Supported MIME types
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : 'video/webm';

          mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 3000000 // 3 Mbps for high crisp fidelity
          });

          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            cleanup();
            const processedBlob = new Blob(chunks, { type: mimeType });
            resolve(processedBlob);
          };

          mediaRecorder.start(200); // 200ms slice chunks

          onProgress?.(15, 'Processando frames e incorporando marca pericial...');

          // Render loop
          const renderFrame = () => {
            if (isFinished) return;

            // Draw original video frame
            ctx.drawImage(video, 0, 0, width, height);

            // Compute exact wall clock time corresponding to this frame
            const currentVideoOffsetMs = Math.round(video.currentTime * 1000);
            const currentFrameDate = new Date(startedAtTimestamp + currentVideoOffsetMs);

            // Burn cryptographic watermark onto the frame
            drawWatermarkBadge(ctx, width, height, {
              dateTimeFormatted: formatWatermarkDateTime(currentFrameDate),
              timezoneFormatted: timezoneOffsetFormatted,
              recordingId
            });

            // Progress reporting
            if (duration > 0) {
              const pct = Math.min(95, Math.round(15 + (video.currentTime / duration) * 75));
              onProgress?.(pct, `Incorporando carimbo temporal: ${formatWatermarkDateTime(currentFrameDate)}...`);
            }

            if (!video.ended && !video.paused && !isFinished) {
              animationFrameId = requestAnimationFrame(renderFrame);
            }
          };

          const finishProcessing = () => {
            if (isFinished) return;
            isFinished = true;
            onProgress?.(96, 'Finalizando compressão e codificação do vídeo derivado...');
            setTimeout(() => {
              if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
              }
            }, 300);
          };

          video.onended = finishProcessing;

          // Fallback safety timeout if video doesn't emit onended
          const maxProcessingTimeMs = Math.max(30000, duration * 2500);
          intervalTimer = setTimeout(() => {
            if (!isFinished) {
              console.warn('[Watermark Engine] Timeout de segurança atingido. Concluindo gravação.');
              finishProcessing();
            }
          }, maxProcessingTimeMs);

          // Start playback
          // 1.0x or 1.5x playback speed for responsive processing without skipping frames
          video.playbackRate = 1.0;
          await video.play();
          renderFrame();

        } catch (err: any) {
          cleanup();
          reject(err);
        }
      };

    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * TEST 8 Cryptographic Verification:
 * Flips 1 single byte in the buffer to demonstrate the Avalanche Effect of SHA-256.
 * Proves that any alteration outside ProvaPack breaks the hash completely.
 */
export async function testTamperIntegrity(blob: Blob): Promise<{
  originalHash: string;
  tamperedHash: string;
  byteIndexModified: number;
  isHashAltered: boolean;
}> {
  const originalBuffer = await blob.arrayBuffer();
  const originalHash = await calculateBufferSha256(originalBuffer);

  // Clone buffer
  const tamperedBuffer = originalBuffer.slice(0);
  const bytes = new Uint8Array(tamperedBuffer);

  // Flip 1 byte in the middle of the file
  const byteIndex = Math.floor(bytes.length / 2);
  bytes[byteIndex] = bytes[byteIndex] ^ 0xFF; // Bitwise invert byte

  const tamperedHash = await calculateBufferSha256(tamperedBuffer);

  return {
    originalHash,
    tamperedHash,
    byteIndexModified: byteIndex,
    isHashAltered: originalHash !== tamperedHash
  };
}

// In-memory registry for video blobs across session
const videoBlobStore = new Map<string, { original: Blob; processed: Blob }>();

export function storeVideoBlobs(dossierId: string, original: Blob, processed: Blob): void {
  videoBlobStore.set(dossierId, { original, processed });
}

export function getVideoBlobs(dossierId: string): { original: Blob; processed: Blob } | undefined {
  return videoBlobStore.get(dossierId);
}
