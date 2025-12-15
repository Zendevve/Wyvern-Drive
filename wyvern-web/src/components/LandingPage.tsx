import { Link } from 'react-router-dom'
import { Shield, Lock, Zap, Share2, HardDrive, ArrowRight } from 'lucide-react'
import './LandingPage.css'

export function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <Shield size={24} />
          <span>WYVERN DRIVE</span>
        </div>
        <div className="nav-links">
          <Link to="/signin" className="nav-link">Sign In</Link>
          <Link to="/signup" className="nav-btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <Lock size={14} />
          <span>End-to-End Encrypted</span>
        </div>

        <h1 className="hero-title">
          Storage,<br />
          <span className="gradient-text">Evolved.</span>
        </h1>

        <p className="hero-description">
          Your files. Your server. Zero monthly fees.
        </p>

        <div className="hero-actions">
          <Link to="/signup" className="btn-primary">
            <span>Get Started Free</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <span className="stat-value">∞</span>
            <span className="stat-label">Storage</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-value">$0</span>
            <span className="stat-label">Monthly</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <span className="stat-value">AES-256</span>
            <span className="stat-label">Encryption</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Lock size={20} />
            </div>
            <h3>Your Keys Only</h3>
            <p>Files encrypted before they leave your browser.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <HardDrive size={20} />
            </div>
            <h3>Unlimited Storage</h3>
            <p>No limits. No subscriptions.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={20} />
            </div>
            <h3>Fast Transfers</h3>
            <p>Optimized for speed.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Share2 size={20} />
            </div>
            <h3>Secure Sharing</h3>
            <p>Password-protected links.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <Shield size={18} />
          <span>Wyvern Drive</span>
        </div>
        <p className="footer-copy">Open Source • MIT License</p>
      </footer>
    </div>
  )
}
