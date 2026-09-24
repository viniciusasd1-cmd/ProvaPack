import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseAuth, isSupabaseAuthConfigured } from '../lib/supabaseAuth';

export interface ServerSellerProfile {
  userId: string;
  email: string;
  plan: string;
  freeDossiersRemaining: number;
  monthlyLimit: number;
  usedThisMonth: number;
  extraCredits: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  profile: ServerSellerProfile | null;
  sendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<ServerSellerProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<ServerSellerProfile | null>(null);

  // Consulta autoritativa de plano e créditos no backend
  const fetchProfile = useCallback(async (token: string): Promise<ServerSellerProfile | null> => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        console.warn('[ProvaPack Auth] Falha ao consultar perfil no servidor:', res.status);
        return null;
      }
      const data = await res.json();
      if (data && data.success && data.profile) {
        setProfile(data.profile);
        return data.profile;
      }
      return null;
    } catch (err) {
      console.warn('[ProvaPack Auth] Erro de rede ao buscar perfil:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<ServerSellerProfile | null> => {
    if (!session?.access_token) return null;
    return await fetchProfile(session.access_token);
  }, [session, fetchProfile]);

  // Inicialização e monitoramento de estado de autenticação Supabase
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        if (isSupabaseAuthConfigured) {
          const { data: { session: initialSession }, error } = await supabaseAuth.auth.getSession();
          if (error) {
            console.warn('[ProvaPack Auth] Erro ao recuperar sessão:', error.message);
          }
          if (isMounted) {
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            if (initialSession?.access_token) {
              fetchProfile(initialSession.access_token);
            }
          }
        } else {
          // Fallback se chave pública não estiver configurada no client
          const savedToken = localStorage.getItem('provapack_backend_session_token');
          if (savedToken) {
            const p = await fetchProfile(savedToken);
            if (p && isMounted) {
              const syntheticUser: any = {
                id: p.userId,
                email: p.email,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString()
              };
              const syntheticSession: any = {
                access_token: savedToken,
                token_type: 'bearer',
                user: syntheticUser
              };
              setUser(syntheticUser);
              setSession(syntheticSession);
            } else {
              localStorage.removeItem('provapack_backend_session_token');
            }
          }
        }
      } catch (err) {
        console.warn('[ProvaPack Auth] Erro na inicialização de Auth:', err);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initAuth();

    // Listener de mudanças na sessão
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseAuthConfigured) {
      const { data } = supabaseAuth.auth.onAuthStateChange(async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.access_token) {
          await fetchProfile(newSession.access_token);
        } else {
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
  }, [fetchProfile]);

  // Enviar código OTP para o e-mail informado
  const sendOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' };
    }

    try {
      if (isSupabaseAuthConfigured) {
        const { error } = await supabaseAuth.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true
          }
        });

        if (error) {
          console.warn('[ProvaPack Auth] Erro ao enviar OTP via Supabase:', error.message);
          return { success: false, error: error.message };
        }
        return { success: true };
      } else {
        // Fallback via backend proxy seguro se chave publishable não estiver no build Vite
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || 'Erro ao enviar código de acesso.' };
        }
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha de conexão ao enviar código.' };
    }
  };

  // Verificar código OTP informado pelo usuário
  const verifyOtp = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\D/g, '');

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'O código de confirmação deve ter pelo menos 6 dígitos.' };
    }

    try {
      if (isSupabaseAuthConfigured) {
        const { data, error } = await supabaseAuth.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'email'
        });

        if (error) {
          console.warn('[ProvaPack Auth] Código OTP inválido ou expirado:', error.message);
          return { success: false, error: 'Código incorreto ou expirado. Tente novamente.' };
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.user);
          if (data.session.access_token) {
            await fetchProfile(data.session.access_token);
          }
          return { success: true };
        }
        return { success: true };
      } else {
        // Fallback backend proxy
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, token: cleanCode })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || 'Código incorreto ou expirado.' };
        }

        if (data.sessionToken && data.user) {
          localStorage.setItem('provapack_backend_session_token', data.sessionToken);
          const syntheticUser: any = {
            id: data.user.id,
            email: data.user.email,
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString()
          };
          const syntheticSession: any = {
            access_token: data.sessionToken,
            token_type: 'bearer',
            user: syntheticUser
          };
          setUser(syntheticUser);
          setSession(syntheticSession);
          await fetchProfile(data.sessionToken);
        }
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao validar o código.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (isSupabaseAuthConfigured) {
        await supabaseAuth.auth.signOut();
      }
      localStorage.removeItem('provapack_backend_session_token');
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.warn('[ProvaPack Auth] Erro ao sair da conta:', err);
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      if (isSupabaseAuthConfigured) {
        const { data: { session: refreshed } } = await supabaseAuth.auth.refreshSession();
        setSession(refreshed);
        setUser(refreshed?.user ?? null);
        if (refreshed?.access_token) {
          await fetchProfile(refreshed.access_token);
        }
      } else if (session?.access_token) {
        await fetchProfile(session.access_token);
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
        profile,
        sendOtp,
        verifyOtp,
        signOut,
        refreshSession,
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
