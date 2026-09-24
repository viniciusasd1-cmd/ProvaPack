import { Dossier, SellerAccount } from '../types';
import { PRODUCT_SHOWCASES, showcaseProductToDossier } from '../data/productShowcase';

const STORAGE_KEY_DOSSIERS = 'provapack_dossiers_v2';
const STORAGE_KEY_SELLER = 'provapack_seller_v1';
const IDB_NAME = 'provapack_storage_db';
const IDB_VERSION = 1;
const IDB_STORE_DOSSIERS = 'dossiers';

export const INITIAL_DOSSIERS: Dossier[] = PRODUCT_SHOWCASES.map(showcaseProductToDossier);

// In-memory cache for ultra-fast synchronous access
let cachedDossiers: Dossier[] = [];
let isHydratedFromIdb = false;
let isHydrationStarted = false;
const listeners = new Set<(dossiers: Dossier[]) => void>();

// IndexedDB Helper (no external dependencies)
function openIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_DOSSIERS)) {
          db.createObjectStore(IDB_STORE_DOSSIERS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB não disponível, utilizando fallback em memória/localStorage');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function idbSaveDossier(dossier: Dossier): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_DOSSIERS, 'readwrite');
      const store = tx.objectStore(IDB_STORE_DOSSIERS);
      store.put(dossier);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllDossiers(): Promise<Dossier[]> {
  const db = await openIDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_DOSSIERS, 'readonly');
      const store = tx.objectStore(IDB_STORE_DOSSIERS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbDeleteDossier(id: string): Promise<void> {
  const db = await openIDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_DOSSIERS, 'readwrite');
      const store = tx.objectStore(IDB_STORE_DOSSIERS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function notifySubscribers() {
  listeners.forEach((fn) => {
    try {
      fn([...cachedDossiers]);
    } catch (e) {
      console.warn('Erro em subscriber de dossiês:', e);
    }
  });
}

export function subscribeToDossiers(callback: (dossiers: Dossier[]) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Safely save user dossiers to localStorage without exceeding browser quota
function safeSaveUserDossiersToLocalStorage(userDossiers: Dossier[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // Filter out any showcase dossiers so we only store real user-created dossiers in localStorage
  const showcaseIds = new Set(PRODUCT_SHOWCASES.map(p => p.dossierId));
  const onlyUser = userDossiers.filter(d => !showcaseIds.has(d.id));

  try {
    localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(onlyUser));
  } catch {
    // Quota exceeded: store a lightweight compact copy without heavy checkpoint base64 strings
    // (The full images are safely stored in IndexedDB and in-memory cache)
    try {
      const compactList = onlyUser.map(d => ({
        ...d,
        checkpoints: (d.checkpoints || []).map(cp => ({
          ...cp,
          imageDataUrl: '' // stripped from localStorage to save space, preserved in IDB
        }))
      }));
      localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(compactList));
    } catch {
      // If still exceeding, keep only latest 3 dossiers in localStorage
      try {
        const minimalList = onlyUser.slice(0, 3).map(d => ({
          ...d,
          checkpoints: (d.checkpoints || []).map(cp => ({
            ...cp,
            imageDataUrl: ''
          }))
        }));
        localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(minimalList));
      } catch {
        // Tolerated gracefully: memory cache and IndexedDB remain intact
      }
    }
  }
}

// Synchronous and asynchronous loader
export function loadStoredDossiers(): Dossier[] {
  // If already in memory, return immediately
  if (cachedDossiers.length > 0) {
    if (!isHydrationStarted) {
      triggerAsyncIdbHydration();
    }
    return [...cachedDossiers];
  }

  let userDossiers: Dossier[] = [];
  const showcaseIds = new Set(PRODUCT_SHOWCASES.map(p => p.dossierId));

  // Try reading user dossiers from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOSSIERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        userDossiers = parsed.filter(d => d && d.id && !showcaseIds.has(d.id));
      }
    } else {
      // Fallback check v1
      const rawV1 = localStorage.getItem('provapack_dossiers_v1');
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1);
        if (Array.isArray(parsedV1)) {
          userDossiers = parsedV1.filter(d => d && d.id && !showcaseIds.has(d.id));
        }
      }
    }
  } catch {
    userDossiers = [];
  }

  // Merge user dossiers with fresh showcase products
  cachedDossiers = [...userDossiers, ...INITIAL_DOSSIERS];

  // Also trigger async hydration from IndexedDB in background
  if (!isHydrationStarted) {
    triggerAsyncIdbHydration();
  }

  return [...cachedDossiers];
}

function triggerAsyncIdbHydration() {
  if (typeof window === 'undefined' || isHydrationStarted) return;
  isHydrationStarted = true;

  idbGetAllDossiers()
    .then((idbDossiers) => {
      if (idbDossiers && idbDossiers.length > 0) {
        const showcaseIds = new Set(PRODUCT_SHOWCASES.map(p => p.dossierId));
        const idbUserDossiers = idbDossiers.filter(d => d && d.id && !showcaseIds.has(d.id));

        if (idbUserDossiers.length > 0) {
          // Merge IDB dossiers with cached dossiers (IDB has full checkpoint images)
          const mergedMap = new Map<string, Dossier>();
          INITIAL_DOSSIERS.forEach(d => mergedMap.set(d.id, d));
          cachedDossiers.forEach(d => mergedMap.set(d.id, d));
          idbUserDossiers.forEach(d => {
            const existing = mergedMap.get(d.id);
            // If existing had stripped checkpoints, prefer IDB's full checkpoints
            if (existing && existing.checkpoints?.some(c => !c.imageDataUrl) && d.checkpoints?.some(c => c.imageDataUrl)) {
              mergedMap.set(d.id, d);
            } else if (!existing) {
              mergedMap.set(d.id, d);
            }
          });

          cachedDossiers = Array.from(mergedMap.values());
          isHydratedFromIdb = true;
          notifySubscribers();
        }
      }
    })
    .catch((err) => {
      console.warn('Aviso: falha na hidratação do IndexedDB:', err);
    });
}

export function saveDossierToStorage(dossier: Dossier): void {
  try {
    // 1. Update in-memory cache
    const current = loadStoredDossiers();
    const updated = [dossier, ...current.filter(d => d.id !== dossier.id)];
    cachedDossiers = updated;

    // 2. Persist full fidelity record to IndexedDB (virtually unlimited quota)
    idbSaveDossier(dossier).catch((idbErr) => {
      console.warn('Aviso ao salvar no IndexedDB:', idbErr);
    });

    // 3. Persist safely to localStorage (with quota protection)
    safeSaveUserDossiersToLocalStorage(updated);

    // 4. Update seller quota
    const seller = loadSellerAccount();
    if (seller.freeDossiersRemaining > 0) {
      seller.freeDossiersRemaining -= 1;
    }
    seller.usedThisMonth += 1;
    saveSellerAccount(seller);

    // 5. Notify any active subscribers
    notifySubscribers();
  } catch (err) {
    console.error('Falha ao salvar dossiê:', err);
  }
}

/**
 * Atualiza um dossiê existente em memória, IndexedDB e localStorage
 * sem alterar a cota do vendedor (freeDossiersRemaining e usedThisMonth permanecem inalterados).
 */
export function updateDossierInStorage(dossier: Dossier): void {
  try {
    // 1. Update in-memory cache
    const current = loadStoredDossiers();
    const updated = current.map(d => d.id === dossier.id ? dossier : d);
    if (!current.some(d => d.id === dossier.id)) {
      updated.unshift(dossier);
    }
    cachedDossiers = updated;

    // 2. Persist full fidelity record to IndexedDB
    idbSaveDossier(dossier).catch((idbErr) => {
      console.warn('Aviso ao atualizar no IndexedDB:', idbErr);
    });

    // 3. Persist safely to localStorage
    safeSaveUserDossiersToLocalStorage(updated);

    // 4. Notify active subscribers (SEM alterar cota do vendedor)
    notifySubscribers();
  } catch (err) {
    console.error('Falha ao atualizar dossiê:', err);
  }
}

export function deleteDossierFromStorage(id: string): void {
  try {
    cachedDossiers = cachedDossiers.filter(d => d.id !== id);
    idbDeleteDossier(id).catch(() => {});
    safeSaveUserDossiersToLocalStorage(cachedDossiers);
    notifySubscribers();
  } catch (err) {
    console.error('Falha ao excluir dossiê:', err);
  }
}

export function loadSellerAccount(): SellerAccount {
  const defaultSeller: SellerAccount = {
    sellerName: 'Vendedor ProvaPack',
    storeName: 'Minha Loja Online',
    plan: 'Gratuito (10 envios)',
    freeDossiersRemaining: 8,
    monthlyLimit: 10,
    usedThisMonth: 2,
    extraCredits: 0
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELLER);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(defaultSeller));
      return defaultSeller;
    }
    return JSON.parse(raw);
  } catch {
    return defaultSeller;
  }
}

export function saveSellerAccount(seller: SellerAccount): void {
  try {
    localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(seller));
  } catch (err) {
    console.warn('Aviso ao salvar conta do vendedor:', err);
  }
}
