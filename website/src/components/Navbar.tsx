import React, { useState } from 'react';
import { APP_CONFIG } from '../config';
import { Download, Menu, X } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

interface NavbarProps {
  onOpenDoc: (docId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenDoc }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(10, 10, 13, 0.82)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
      padding: '14px 0'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.svg" alt="Spitit Logo" style={{ width: '28px', height: '28px' }} />
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff'
          }}>
            Spitit <span style={{ color: 'var(--accent-yellow)', fontSize: '13px', fontWeight: 600 }}>v3</span>
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="desktop-links">
          <a href="#demo" style={{ fontSize: '14px', color: 'var(--text-muted)', transition: 'color 120ms' }}>Demo</a>
          <a href="#how-it-works" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>How It Works</a>
          <a href="#languages" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Hinglish</a>
          <a href="#privacy" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Privacy</a>
          <a href="#features" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Features</a>
          <a href="#faq" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>FAQ</a>
          <button
            onClick={() => onOpenDoc('docs')}
            style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Docs
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href={APP_CONFIG.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
            title="View Source on GitHub"
          >
            <GithubIcon size={16} />
            <span className="hide-mobile">GitHub</span>
          </a>
          <a
            href="#download"
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <Download size={15} />
            <span>Download</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              color: 'var(--text-main)',
              padding: '6px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px'
            }}
            className="mobile-toggle"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          padding: '16px 24px',
          background: 'rgba(14, 14, 18, 0.98)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <a href="#demo" onClick={() => setMobileMenuOpen(false)}>Demo</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#languages" onClick={() => setMobileMenuOpen(false)}>Hinglish & Languages</a>
          <a href="#privacy" onClick={() => setMobileMenuOpen(false)}>Privacy Architecture</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
          <button
            onClick={() => { setMobileMenuOpen(false); onOpenDoc('docs'); }}
            style={{ textAlign: 'left', color: 'var(--text-main)', fontSize: '15px' }}
          >
            Docs & Troubleshooting
          </button>
          <a
            href="#download"
            onClick={() => setMobileMenuOpen(false)}
            style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}
          >
            Download v3.0.0 for Windows
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 820px) {
          .desktop-links { display: none !important; }
          .mobile-toggle { display: block !important; }
          .hide-mobile { display: none; }
        }
      `}</style>
    </nav>
  );
};
