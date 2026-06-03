import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'
import './AuthScreen.css'

interface AuthScreenProps {
  defaultView?: 'sign_in' | 'sign_up'
}

export function AuthScreen({ defaultView = 'sign_in' }: AuthScreenProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<'sign_in' | 'sign_up'>(defaultView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Listen for auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        navigate('/app')
      }
    })

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (view === 'sign_up') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      {/* Subtle Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      </div>

      {/* Left Panel */}
      <div className="auth-panel-left">
        <div className="brand-header">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Lock size={16} />
          </div>
          <span className="text-lg font-[Playfair_Display] tracking-tight text-white ml-2">Wyvern</span>
        </div>
        <div className="hero-content">
          <h1 className="font-[Playfair_Display]">Secure Vault</h1>
          <p className="hero-subtitle">
            A self-hosted, end-to-end encrypted file manager using Discord channels for reliable data storage and local SQLite database for blazing fast retrieval.
          </p>
        </div>
        <div className="panel-footer">
          <p>&copy; {new Date().getFullYear()} Wyvern Drive. Fully self-hosted.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-panel-right relative z-10">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{view === 'sign_up' ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{view === 'sign_up' ? 'Start storing files securely' : 'Sign in to access your vault'}</p>
          </div>

          {error && (
            <div className="auth-error-message" role="alert" id="auth-error-msg">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-field">
              <label htmlFor="email-input">Email</label>
              <div className="auth-input-wrapper">
                <Mail className="input-icon" size={16} />
                <input
                  id="email-input"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? "auth-error-msg" : undefined}
                />
              </div>
            </div>

            <div className="auth-form-field">
              <label htmlFor="password-input">Password</label>
              <div className="auth-input-wrapper">
                <Lock className="input-icon" size={16} />
                <input
                  id="password-input"
                  type="password"
                  className="auth-input"
                  placeholder={view === 'sign_up' ? 'At least 8 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? "auth-error-msg" : undefined}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>{view === 'sign_up' ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <span>{view === 'sign_up' ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="auth-switch-prompt">
            {view === 'sign_up' ? (
              <>
                Already have an account?
                <button type="button" className="auth-switch-btn" onClick={() => setView('sign_in')}>
                  Sign In
                </button>
              </>
            ) : (
              <>
                Don't have an account?
                <button type="button" className="auth-switch-btn" onClick={() => setView('sign_up')}>
                  Sign Up
                </button>
              </>
            )}
          </div>

          <div className="auth-footer">
            <p>Your webhooks and keys never leave this host.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
