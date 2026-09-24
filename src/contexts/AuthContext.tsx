import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseAuth, isSupabaseAuthConfigured } from '../lib/supabaseAuth';
import { authenticatedFetch } from '../lib/apiClient';

export interface UserAccount {
  planCode: 'free' | 'pro' | 'volume';
  subscriptionStatus: 'active' | 'pending' | 'past_due' | 'cancelled';
  freeLimit: number;
  freeUsed: number;
  monthlyLimit: number | null;
  monthlyUsed: number;
  extraCredits: number;
  remaining: number | null;
  unlimited: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

// Interface de compatibilidade com componentes que consom o formato de exibição visual
export interface VisualSellerProfile {
  userId: string;
  email: string;
  plan: 'Gratuito (10 envios)' | 'Pro (50 envios)' | 'Alto Volume (Ilimitado)';
  freeDossiersRemaining: number | null;
  monthlyLimit: number;
  usedThisMonth: number;
  extraCredits: number;
  unlimited: boolean;
}

function mapAccountToVisualProfile(userId: string, email: string, account: UserAccount): VisualSellerProfile {
  let visualPlan: VisualSellerProfile['plan'] = 'Gratuito (10 envios)';
  if (account.planCode === 'pro') visualPlan = 'Pro (50 envios)';
  if (account.planCode === 'volume') visualPlan = 'Alto Volume (Ilimitado)';

  return {
    userId,
    email,
    plan: visualPlan,
    freeDossiersRemaining: account.unlimited ? null : account.remaining,
    monthlyLimit: account.monthlyLimit ?? 10,
    usedThisMonth: account.monthlyUsed,
    extraCredits: account.extraCredits,
    unlimited: account.unlimited
  };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  account: UserAccount | null;
  profile: VisualSellerProfile | null;
  sendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshAccount: () => Promise<UserAccount | null>;
  refreshProfile: () => Promise<VisualSellerProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<VisualSellerProfile | null>(null);

  // Consulta autoritativa em /api/account/me via JWT oficial Supabase
  const fetchAccount = useCallback(async (): Promise<UserAccount | null> => {
    try {
      const res = await authenticatedFetch('/api/account/me');
      if (!res.ok) {
        if (res.status === 401) {
          setAccount(null);
          setProfile(null);
        }
        return null;
      }

      const data = await res.json();
      if (data && data.account && data.user) {
        setAccount(data.account);
        const mapped = mapAccountToVisualProfile(data.user.id, data.user.email, data.account);
        setProfile(mapped);
        return data.account;
      }
      return null;
    } catch (err) {
      console.warn('[ProvaPack Auth] Erro de rede ao consultar /api/account/me:', err);
      return null;
    }
  }, []);

  const refreshAccount = useCallback(async (): Promise<UserAccount | null> => {
    return await fetchAccount();
  }, [fetchAccount]);

  const refreshProfile = useCallback(async (): Promise<VisualSellerProfile | null> => {
    const acc = await fetchAccount();
    if (acc && user) {
      return mapAccountToVisualProfile(user.id, user.email || '', acc);
    }
    return null;
  }, [fetchAccount, user]);

  // Inicialização exclusiva via Supabase Auth oficial (sem fallback sintético)
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        if (!isSupabaseAuthConfigured) {
          if (process.env.NODE_ENV !== 'production') {
            console.info('[ProvaPack Auth] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não configurados. Autenticação desativada.');
          }
          if (isMounted) {
            setUser(null);
            setSession(null);
            setAccount(null);
            setProfile(null);
          }
          return;
        }

        const { data: { session: initialSession }, error } = await supabaseAuth.auth.getSession();
        if (error) {
          console.warn('[ProvaPack Auth] Erro ao recuperar sessão do Supabase:', error.message);
        }

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            fetchAccount();
          }
        }
      } catch (err) {
        console.warn('[ProvaPack Auth] Falha ao inicializar autenticação:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initAuth();

    // Listener de eventos do Supabase Auth
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseAuthConfigured) {
      const { data } = supabaseAuth.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchAccount();
        } else {
          setAccount(null);
          setProfile(null);
        }
        setAuthLoading(false);
      });
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchAccount]);

  // Enviar código OTP exclusivamente via Supabase Auth
  const sendOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' };
    }

    if (!isSupabaseAuthConfigured) {
      return {
        success: false,
        error: 'Serviço de autenticação não configurado no cliente. Verifique as variáveis de ambiente.'
      };
    }

    try {
      const { error } = await supabaseAuth.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true
        }
      });

      if (error) {
        console.warn('[ProvaPack Auth] Erro ao solicitar OTP:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha de conexão ao enviar código.' };
    }
  };

  // Verificar código OTP exclusivamente via Supabase Auth
  const verifyOtp = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\D/g, '');

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'O código de confirmação deve ter 6 dígitos.' };
    }

    if (!isSupabaseAuthConfigured) {
      return {
        success: false,
        error: 'Serviço de autenticação não configurado no cliente.'
      };
    }

    try {
      const { data, error } = await supabaseAuth.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email'
      });

      if (error) {
        console.warn('[ProvaPack Auth] Falha na verificação de OTP:', error.message);
        return { success: false, error: 'Código incorreto ou expirado. Verifique e tente novamente.' };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        await fetchAccount();
        return { success: true };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao validar o código.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (isSupabaseAuthConfigured) {
        await supabaseAuth.auth.signOut();
      }
    } catch (err) {
      console.warn('[ProvaPack Auth] Erro ao encerrar sessão:', err);
    } finally {
      setUser(null);
      setSession(null);
      setAccount(null);
      setProfile(null);
    }
  };

  const refreshSession = async (): Promise<void> => {
    if (!isSupabaseAuthConfigured) return;
    try {
      const { data: { session: refreshed } } = await supabaseAuth.auth.refreshSession();
      setSession(refreshed);
      setUser(refreshed?.user ?? null);
      if (refreshed?.user) {
        await fetchAccount();
      }
    } catch (err) {
      console.warn('[ProvaPack Auth] Erro ao atualizar sessão:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: Boolean(user && session),
        authLoading,
        account,
        profile,
        sendOtp,
        verifyOtp,
        signOut,
        refreshSession,
        refreshAccount,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider>');
  }
  return context;
}
