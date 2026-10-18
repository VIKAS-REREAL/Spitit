import React, { useState } from 'react';
import { APP_CONFIG } from '../config';
import { Download, Menu, X, ArrowUpRight } from 'lucide-react';
import { useDeviceDetect } from '../utils/useDeviceDetect';
import { GithubIcon } from './GithubIcon';

interface NavbarProps {
  onOpenDoc: (docId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenDoc }) => {
  const device = useDeviceDetect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Floating Island Capsule Navbar (Supaste Style) */}
      <header style={{
        position: 'fixed',
        top: '16px',
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 16px'
      }}>
        <div
          className="floating-navbar-pill"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '940px',
            width: '100%',
            height: '52px',
            background: 'rgba(12, 12, 16, 0.78)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '9999px',
            padding: '5px 7px 5px 16px',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            transition: 'all 200ms ease'
          }}
        >
          {/* Brand Logo & Version Tag */}
          <a
            href="#"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              textDecoration: 'none'
            }}
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #1c1c24 0%, #0d0d11 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}>
              <img src="/favicon.svg" alt="Spitit Logo" style={{ width: '16px', height: '16px' }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}>
              Spitit
              <span style={{
                color: 'var(--accent-gold)',
                fontSize: '10px',
                fontWeight: 600,
                padding: '1.5px 6px',
                borderRadius: '9999px',
                background: 'rgba(255, 213, 5, 0.12)',
                border: '1px solid rgba(255, 213, 5, 0.25)',
                letterSpacing: '0.04em',
                lineHeight: 1.2
              }}>
                v3.0
              </span>
            </span>
          </a>

          {/* Center Navigation Links (Desktop) */}
          <nav
            className="navbar-desktop-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <a href="#demo" className="nav-pill-link">Demo</a>
            <a href="#how-it-works" className="nav-pill-link">How It Works</a>
            <a href="#languages" className="nav-pill-link">Hinglish</a>
            <a href="#privacy" className="nav-pill-link">Privacy</a>
            <a href="#features" className="nav-pill-link">Features</a>
            <button
              onClick={() => onOpenDoc('docs')}
              className="nav-pill-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
            >
              Docs
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={APP_CONFIG.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-action-secondary"
              title="View Source on GitHub"
            >
              <GithubIcon size={15} />
              <span className="hide-mobile">GitHub</span>
              <ArrowUpRight size={12} style={{ opacity: 0.6 }} className="hide-mobile" />
            </a>

            <a
              href="#download"
              className="nav-action-primary"
            >
              <Download size={14} />
              <span>{device.isWindows ? 'Download' : 'Get for Windows'}</span>
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="nav-mobile-toggle"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Floating Mobile Drawer (Anchored below floating pill) */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '76px',
          left: '16px',
          right: '16px',
          zIndex: 999,
          background: 'rgba(14, 14, 20, 0.94)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '20px 24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'fadeInDown 180ms ease'
        }}>
          <a
            href="#demo"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', color: '#fff', textDecoration: 'none', fontWeight: 500 }}
          >
            Interactive Studio Demo
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', color: '#B0B0BB', textDecoration: 'none' }}
          >
            How It Works (3 Steps)
          </a>
          <a
            href="#languages"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', color: '#B0B0BB', textDecoration: 'none' }}
          >
            Hinglish &amp; Languages
          </a>
          <a
            href="#privacy"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', color: '#B0B0BB', textDecoration: 'none' }}
          >
            Radical Privacy Architecture
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', color: '#B0B0BB', textDecoration: 'none' }}
          >
            Core Native Features
          </a>
          <button
            onClick={() => { setMobileMenuOpen(false); onOpenDoc('docs'); }}
            style={{ textAlign: 'left', fontSize: '15px', color: '#B0B0BB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Docs &amp; Troubleshooting
          </button>
          
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

          <a
            href="#download"
            onClick={() => setMobileMenuOpen(false)}
            className="btn-primary"
            style={{ width: '100%', borderRadius: '9999px', fontSize: '14px', padding: '10px 18px' }}
          >
            <Download size={15} />
            <span>{device.isWindows ? 'Download Spitit for Windows' : 'Download Windows .exe'}</span>
          </a>
        </div>
      )}

      {/* Scoped CSS for Navbar Pills */}
      <style>{`
        .nav-pill-link {
          font-size: 13.5px;
          color: #9A9AA6;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 9999px;
          transition: all 120ms ease;
          font-weight: 500;
        }
        .nav-pill-link:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.07);
        }
        .nav-action-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 500;
          color: #EDEDF0;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 6px 13px;
          border-radius: 9999px;
          text-decoration: none;
          transition: all 120ms ease;
        }
        .nav-action-secondary:hover {
          background: rgba(255, 255, 255, 0.11);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .nav-action-primary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: var(--accent-gold);
          color: #0b0b0e;
          font-size: 13px;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 9999px;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(255, 213, 5, 0.25);
          transition: all 120ms ease;
        }
        .nav-action-primary:hover {
          background: #ffe033;
          box-shadow: 0 6px 18px rgba(255, 213, 5, 0.4);
          transform: translateY(-0.5px);
        }
        .nav-mobile-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          cursor: pointer;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 860px) {
          .navbar-desktop-links { display: none !important; }
          .nav-mobile-toggle { display: inline-flex !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
};
