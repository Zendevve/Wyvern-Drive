import { Link } from 'react-router-dom'
import { ArrowRight, Box } from 'lucide-react'
import './LandingPage.css'

export function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <Box size={24} strokeWidth={2} />
          <span>Wyvern</span>
        </div>
        <div className="nav-actions">
          <Link to="/signin" className="landing-btn landing-btn-primary">
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="landing-label">System Manifesto v2.0</div>
        <h1 className="hero-title">Storage,<br />Evolved.</h1>
        <p className="hero-sub">
          The ultimate archival platform for discerning minds and institutions.
          Secure, accessible, permanent. Zero compromise.
        </p>
        <div className="hero-actions">
          <Link to="/signin" className="landing-btn landing-btn-primary">
            Initialize <ArrowRight size={16} />
          </Link>
          <a href="#manifesto" className="landing-btn landing-btn-outline">
            Read Logic
          </a>
        </div>
      </header>

      {/* Feature Grid */}
      <section className="features-grid">
        <div className="feature-card">
          <div className="landing-label">Core_Engine</div>
          <h3 className="feature-title">Immutable Architecture</h3>
          <p className="feature-desc">
            Data integrity guaranteed by cryptographic design. Once written, your assets are permanent and unalterable.
          </p>
        </div>
        <div className="feature-card">
          <div className="landing-label">Networking_Layer</div>
          <h3 className="feature-title">Global Instant Access</h3>
          <p className="feature-desc">
            Low-latency retrieval from anywhere. Your digital artifacts are available immediately, anytime, on any device.
          </p>
        </div>
        <div className="feature-card">
          <div className="landing-label">Protection_Suite</div>
          <h3 className="feature-title">Quantum-Ready Security</h3>
          <p className="feature-desc">
            Future-proof encryption standards. Protecting your legacy against tomorrow's computational threats.
          </p>
        </div>
        <div className="feature-card">
          <div className="landing-label">Growth_System</div>
          <h3 className="feature-title">Organic Scalability</h3>
          <p className="feature-desc">
            Adapts effortlessly to your expanding data needs. From terabytes to exabytes, without friction.
          </p>
        </div>
      </section>

      {/* Inverted Stats */}
      <section className="stats-section">
        <div className="stat-item">
          <span className="stat-value">∞</span>
          <span className="stat-label">Storage Capacity</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">$0</span>
          <span className="stat-label">Monthly Fees</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">256</span>
          <span className="stat-label">Bit Encryption</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-section" id="manifesto">
        <div className="landing-label" style={{ borderColor: 'var(--bg)' }}>Final_Directive</div>
        <h2 className="cta-headline">Own Your Data.</h2>
        <Link
          to="/signup"
          className="landing-btn"
          style={{
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid var(--bg)'
          }}
        >
          Start Archiving
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2024 Wyvern Systems</span>
        <span>Secure Protocol // AES-256</span>
        <span>Status: Online</span>
      </footer>
    </div>
  )
}
