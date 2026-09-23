/**
 * Cryptographic & hashing utilities for ProvaPack dossiers
 */

export async function calculateBufferSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // SubtleCrypto must be present in modern secure browser contexts
  throw new Error('Não foi possível calcular a integridade criptográfica do arquivo.');
}

export async function calculateBlobSha256(blob: Blob): Promise<string> {
  if (!blob || blob.size === 0) {
    throw new Error('Não foi possível calcular a integridade criptográfica do arquivo.');
  }
  const arrayBuffer = await blob.arrayBuffer();
  return calculateBufferSha256(arrayBuffer);
}

export function generateDossierId(date: Date = new Date()): string {
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

export function formatSecondsToTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatBrasiliaDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'long',
      timeStyle: 'medium'
    }).format(date);
  } catch {
    return isoString;
  }
}
