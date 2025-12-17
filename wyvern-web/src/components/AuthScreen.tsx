import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { Lock, ArrowUpRight } from 'lucide-react'

interface AuthScreenProps {
  defaultView?: 'sign_in' | 'sign_up'
}

export function AuthScreen({ defaultView = 'sign_in' }: AuthScreenProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/app')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/app')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Subtle Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
      </div>

      {/* Gradient Orb */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-gradient-to-b from-white/[0.02] to-transparent blur-3xl pointer-events-none z-0"></div>

      {/* Prismatic Blur */}
      <div className="fixed top-[20%] right-[30%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full opacity-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white font-medium mb-12 justify-center">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Lock size={16} />
          </div>
          <span className="text-lg font-[Playfair_Display] tracking-tight">Wyvern</span>
        </Link>

        {/* Card */}
        <div className="bg-bg-card border border-border-card rounded-2xl p-8 relative overflow-hidden">
          {/* Subtle top sheen */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent"></div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-[Playfair_Display] text-white mb-2">
              {defaultView === 'sign_up' ? 'Create account' : 'Welcome back'}
            </h1>
            <p className="text-white/40 text-sm">
              {defaultView === 'sign_up' ? 'Start storing files securely' : 'Sign in to access your vault'}
            </p>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#8B5CF6',
                    brandAccent: '#7C3AED',
                    brandButtonText: '#ffffff',
                    defaultButtonBackground: 'rgba(255,255,255,0.05)',
                    defaultButtonBackgroundHover: 'rgba(255,255,255,0.1)',
                    inputBackground: 'rgba(255,255,255,0.03)',
                    inputBorder: 'rgba(255,255,255,0.08)',
                    inputBorderHover: 'rgba(255,255,255,0.15)',
                    inputBorderFocus: 'rgba(255,255,255,0.3)',
                    inputText: '#ffffff',
                    inputLabelText: 'rgba(255,255,255,0.5)',
                    inputPlaceholder: 'rgba(255,255,255,0.25)',
                  },
                  borderWidths: {
                    buttonBorderWidth: '0px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '10px',
                    buttonBorderRadius: '10px',
                    inputBorderRadius: '10px',
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseInputSize: '14px',
                    baseLabelSize: '12px',
                    baseButtonSize: '14px',
                  },
                  fonts: {
                    bodyFontFamily: 'inherit',
                    buttonFontFamily: 'inherit',
                    inputFontFamily: 'inherit',
                    labelFontFamily: 'inherit',
                  },
                },
              },
              style: {
                button: {
                  fontWeight: '500',
                  padding: '14px 16px',
                },
                input: {
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                },
                anchor: {
                  color: 'rgba(255,255,255,0.5)',
                },
                label: {
                  marginBottom: '6px',
                },
              },
            }}
            providers={[]}
            redirectTo={`${window.location.origin}/app`}
            view={defaultView}
            showLinks={true}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: 'Your password',
                  button_label: 'Sign In',
                  loading_button_label: 'Signing in...',
                  link_text: "Don't have an account? Sign up",
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: 'At least 8 characters',
                  button_label: 'Create Account',
                  loading_button_label: 'Creating account...',
                  link_text: 'Already have an account? Sign in',
                },
              },
            }}
          />

          <p className="text-xs text-white/30 text-center mt-8">
            By continuing, you agree to store files on your own Discord server.
          </p>
        </div>

        {/* Back to home */}
        <div className="text-center mt-8">
          <Link to="/" className="text-white/40 text-sm hover:text-white/60 transition-colors inline-flex items-center gap-1">
            Back to home <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}
