import { supabaseAuth, isSupabaseAuthConfigured } from './supabaseAuth';

export interface AuthenticatedFetchOptions extends RequestInit {
  onUnauthorized?: () => void;
}

/**
 * Realiza requisições HTTP autenticadas com o JWT oficial do Supabase Auth.
 * Se retornar 401, tenta atualizar a sessão via refreshSession() uma única vez.
 * Se persistir 401, aciona desautenticação e encerra a sessão.
 * Nunca armazena tokens manualmente em chaves personalizadas do localStorage.
 */
export async function authenticatedFetch(
  input: string | URL | Request,
  init?: AuthenticatedFetchOptions
): Promise<Response> {
  const options: RequestInit = { ...(init || {}) };
  const headers = new Headers(options.headers || {});

  if (isSupabaseAuthConfigured) {
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    } catch (err) {
      console.warn('[ProvaPack API] Falha ao obter sessão do Supabase:', err);
    }
  }

  options.headers = headers;

  let response: Response;
  try {
    response = await fetch(input, options);
  } catch (err) {
    throw err;
  }

  // Se receber 401 (não autorizado / token expirado), tenta refresh uma única vez
  if (response.status === 401 && isSupabaseAuthConfigured) {
    try {
      const { data: { session: refreshedSession }, error: refreshErr } = await supabaseAuth.auth.refreshSession();
      if (!refreshErr && refreshedSession?.access_token) {
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${refreshedSession.access_token}`);
        const retryOptions = { ...options, headers: retryHeaders };
        response = await fetch(input, retryOptions);
      } else {
        await supabaseAuth.auth.signOut();
        init?.onUnauthorized?.();
      }
    } catch {
      await supabaseAuth.auth.signOut();
      init?.onUnauthorized?.();
    }
  }

  return response;
}
