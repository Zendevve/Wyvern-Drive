import { Link } from 'react-router-dom'
import { Shield, Lock, Zap, Share2, HardDrive, ArrowRight, Upload, Key, Download, Globe } from 'lucide-react'
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
          <Link to="/signup" className="nav-link">Create Account</Link>
          <Link to="/signin" className="nav-btn-primary">Sign In</Link>
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
          Your files. Your server. Zero monthly fees.<br />
          Unlimited cloud storage powered by Discord.
        </p>

        <div className="hero-actions">
          <Link to="/signin" className="btn-primary">
            <span>Launch App</span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/signup" className="btn-secondary">
            <span>Create Account</span>
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
        <h2 className="section-title">Why Wyvern?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Lock size={20} />
            </div>
            <h3>Your Keys Only</h3>
            <p>Files encrypted before they leave your browser. We never see your data.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <HardDrive size={20} />
            </div>
            <h3>Unlimited Storage</h3>
            <p>No limits. No subscriptions. Use your Discord server as infinite storage.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={20} />
            </div>
            <h3>Blazing Fast</h3>
            <p>Parallel chunk uploads and smart compression for maximum speed.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Share2 size={20} />
            </div>
            <h3>Secure Sharing</h3>
            <p>Password-protected links with expiration dates.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Three simple steps to unlimited cloud storage</p>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon">
              <Key size={24} />
            </div>
            <h3>Connect Discord</h3>
            <p>Create a private Discord server and add webhooks. Your files stay on your server.</p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">
              <Upload size={24} />
            </div>
            <h3>Upload Files</h3>
            <p>Drag and drop any file. It's encrypted, chunked, and stored automatically.</p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon">
              <Download size={24} />
            </div>
            <h3>Access Anywhere</h3>
            <p>Download, share, and manage your files from any browser.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <Globe size={48} className="cta-icon" />
          <h2>Ready to take control?</h2>
          <p>Join thousands of users who've already made the switch to truly free cloud storage.</p>
          <Link to="/signin" className="btn-primary btn-large">
            <span>Get Started Now</span>
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Shield size={18} />
            <span>Wyvern Drive</span>
          </div>
          <div className="footer-links">
            <a href="https://github.com/Zendevve/Wyvern-Drive" target="_blank" rel="noopener noreferrer">GitHub</a>
            <span className="footer-divider">•</span>
            <a href="https://github.com/sponsors/Zendevve" target="_blank" rel="noopener noreferrer">Sponsor</a>
          </div>
          <p className="footer-copy">Open Source • MIT License • © 2025</p>
        </div>
      </footer>
    </div>
  )
}
