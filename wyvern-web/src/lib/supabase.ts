import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

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
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

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
    }, {
      onConflict: 'id'
    })

  if (error) {
    console.error('Error saving profile:', error)
    return false
  }

  return true
}

