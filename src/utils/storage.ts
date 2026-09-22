import { Dossier, SellerAccount } from '../types';
import { PRODUCT_SHOWCASES, showcaseProductToDossier } from '../data/productShowcase';

const STORAGE_KEY_DOSSIERS = 'provapack_dossiers_v2';
const STORAGE_KEY_SELLER = 'provapack_seller_v1';

export const INITIAL_DOSSIERS: Dossier[] = PRODUCT_SHOWCASES.map(showcaseProductToDossier);

export function loadStoredDossiers(): Dossier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOSSIERS);
    let list: Dossier[] = [];
    if (raw) {
      list = JSON.parse(raw);
    } else {
      // Try fallback to v1 if exists
      const oldRaw = localStorage.getItem('provapack_dossiers_v1');
      if (oldRaw) {
        try {
          const oldList: Dossier[] = JSON.parse(oldRaw);
          // Keep only non-demo/user created dossiers
          const userDossiers = oldList.filter(d => !PRODUCT_SHOWCASES.some(p => p.dossierId === d.id));
          list = [...userDossiers, ...INITIAL_DOSSIERS];
        } catch {
          list = [...INITIAL_DOSSIERS];
        }
      } else {
        list = [...INITIAL_DOSSIERS];
      }
      localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(list));
      return list;
    }

    // Always ensure demo / showcase dossiers have their real photos synchronized
    const showcaseMap = new Map<string, Dossier>();
    INITIAL_DOSSIERS.forEach(d => showcaseMap.set(d.id, d));

    let modified = false;
    list = list.map(item => {
      const match = showcaseMap.get(item.id);
      if (match) {
        modified = true;
        return {
          ...item,
          ...match,
          checkpoints: match.checkpoints
        };
      }
      return item;
    });

    // Also include any showcase product not yet in list
    INITIAL_DOSSIERS.forEach(d => {
      if (!list.some(item => item.id === d.id)) {
        list.push(d);
        modified = true;
      }
    });

    if (modified) {
      localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(list));
    }

    return list;
  } catch {
    return INITIAL_DOSSIERS;
  }
}

export function saveDossierToStorage(dossier: Dossier): void {
  try {
    const current = loadStoredDossiers();
    const updated = [dossier, ...current.filter(d => d.id !== dossier.id)];
    localStorage.setItem(STORAGE_KEY_DOSSIERS, JSON.stringify(updated));

    // Also decrement or update seller quota
    const seller = loadSellerAccount();
    if (seller.freeDossiersRemaining > 0) {
      seller.freeDossiersRemaining -= 1;
    }
    seller.usedThisMonth += 1;
    saveSellerAccount(seller);
  } catch (err) {
    console.error('Falha ao salvar dossiê:', err);
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
    console.error('Erro ao salvar conta do vendedor:', err);
  }
}
