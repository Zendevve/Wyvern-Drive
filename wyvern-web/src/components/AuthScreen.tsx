import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { Shield } from 'lucide-react'
import './AuthScreen.css'

export function AuthScreen() {
  return (
    <div className="auth-screen">
      {/* Left Panel - Branding */}
      <div className="auth-panel-left">
        <div className="brand-header">
          <Shield size={24} />
          <span>WYVERN DRIVE</span>
        </div>

        <div className="hero-content">
          <h1>Storage,<br />Evolved.</h1>
          <p className="hero-subtitle">
            A decentralized, encrypted file system that lives directly in your Discord server.
            Unlimited storage, zero monthly fees.
          </p>
        </div>

        <div className="panel-footer">
          v1.0.0 • Open Source MIT License
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="auth-panel-right">
        <div className="auth-card">
          <div className="auth-header">
            <h2>Welcome</h2>
            <p>Sign in to access your files</p>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#5e6ad2',
                    brandAccent: '#7c3aed',
                    brandButtonText: 'white',
                    defaultButtonBackground: '#1a1a2e',
                    defaultButtonBackgroundHover: '#252545',
                    inputBackground: '#1a1a2e',
                    inputBorder: 'rgba(255, 255, 255, 0.1)',
                    inputBorderHover: 'rgba(255, 255, 255, 0.2)',
                    inputBorderFocus: '#5e6ad2',
                    inputText: 'white',
                    inputLabelText: 'rgba(255, 255, 255, 0.7)',
                    inputPlaceholder: 'rgba(255, 255, 255, 0.4)',
                  },
                  borderWidths: {
                    buttonBorderWidth: '1px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '8px',
                    buttonBorderRadius: '8px',
                    inputBorderRadius: '8px',
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseInputSize: '14px',
                    baseLabelSize: '13px',
                    baseButtonSize: '14px',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
                label: 'auth-label',
              },
            }}
            providers={[]}
            redirectTo={window.location.origin}
            view="sign_in"
            showLinks={true}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email address',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: 'At least 8 characters',
                  button_label: 'Sign In',
                  loading_button_label: 'Signing in...',
                  social_provider_text: 'Continue with {{provider}}',
                  link_text: "Don't have an account? Sign up",
                },
                sign_up: {
                  email_label: 'Email address',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: 'At least 8 characters',
                  button_label: 'Sign Up',
                  loading_button_label: 'Creating account...',
                  social_provider_text: 'Continue with {{provider}}',
                  link_text: 'Already have an account? Sign in',
                },
              },
            }}
          />

          <div className="auth-footer">
            <p>By signing in, you agree to store your files on your own Discord server.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
