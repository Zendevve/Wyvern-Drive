import type { Session } from '@supabase/supabase-js'

const API_BASE = 'http://localhost:3001/api';

const authListeners = new Set<(event: string, session: Session | null) => void>();

function emitAuthStateChange(event: string, session: Session | null) {
  authListeners.forEach(listener => {
    try {
      listener(event, session);
    } catch (e) {
      console.error('[Supabase Mock] Error in auth listener:', e);
    }
  });
}

function getStoredSession(): Session | null {
  try {
    const val = localStorage.getItem('sb-wyvern-auth-token');
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: Session | null) {
  if (session) {
    localStorage.setItem('sb-wyvern-auth-token', JSON.stringify(session));
  } else {
    localStorage.removeItem('sb-wyvern-auth-token');
  }
}

// Custom mock supabase client routing to localhost Express backend
export const supabase = {
  auth: {
    getSession: async () => {
      return { data: { session: getStoredSession() }, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      authListeners.add(callback);
      const session = getStoredSession();
      callback(session ? 'INITIAL_SESSION' : 'SIGNED_OUT', session);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            }
          }
        }
      };
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
          const err = await res.json();
          return { data: { session: null, user: null }, error: new Error(err.error || 'Login failed') };
        }
        const data = await res.json();
        setStoredSession(data.session);
        emitAuthStateChange('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (e: any) {
        return { data: { session: null, user: null }, error: e };
      }
    },
    signUp: async ({ email, password }: any) => {
      try {
        const res = await fetch(`${API_BASE}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
          const err = await res.json();
          return { data: { session: null, user: null }, error: new Error(err.error || 'Signup failed') };
        }
        const data = await res.json();
        setStoredSession(data.session);
        emitAuthStateChange('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (e: any) {
        return { data: { session: null, user: null }, error: e };
      }
    },
    signOut: async (_options?: any) => {
      setStoredSession(null);
      emitAuthStateChange('SIGNED_OUT', null);
      return { error: null };
    }
  },
  from: (table: string) => {
    if (table !== 'user_profiles') {
      throw new Error(`Unsupported table: ${table}`);
    }

    return {
      select: (_columns?: string) => ({
        eq: (_field: string, val: string) => ({
          single: async () => {
            const session = getStoredSession();
            if (!session?.access_token) {
              return { data: null, error: { message: 'Unauthorized', code: 'PGRST401' } };
            }
            try {
              const res = await fetch(`${API_BASE}/profiles/${val}`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              if (!res.ok) {
                const err = await res.json();
                return { data: null, error: { message: err.error || 'Not found', code: 'PGRST116' } };
              }
              const data = await res.json();
              return { data, error: null };
            } catch (e: any) {
              return { data: null, error: { message: e.message || 'Network error', code: 'PGRST116' } };
            }
          }
        })
      }),
      upsert: async (record: any, _options?: any) => {
        const session = getStoredSession();
        if (!session?.access_token) {
          return { error: { message: 'Unauthorized', code: 'PGRST401' } };
        }
        try {
          const res = await fetch(`${API_BASE}/profiles/${record.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              webhook_urls: record.webhook_urls,
              encryption_enabled: record.encryption_enabled,
              server_boost_level: record.server_boost_level
            })
          });
          if (!res.ok) {
            const err = await res.json();
            return { error: new Error(err.error || 'Failed to upsert profile') };
          }
          return { error: null };
        } catch (e: any) {
          return { error: e };
        }
      }
    };
  }
};

// Types for user profile
export interface UserProfile {
  id: string
  webhook_urls: string[]
  encryption_enabled: boolean
  server_boost_level?: string
  created_at: string
  updated_at: string
}

// Helper to get or create user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await (supabase.from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single() as any);

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

// Helper to upsert user profile
export async function saveUserProfile(
  userId: string,
  webhookUrls: string[],
  encryptionEnabled: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      webhook_urls: webhookUrls,
      encryption_enabled: encryptionEnabled,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error saving profile:', error)
    return false
  }

  return true
}
