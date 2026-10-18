import React from 'react';
import { Download, Key, ExternalLink, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../config';

export const SetupGuide: React.FC = () => {
  return (
    <section className="section-padding" style={{ position: 'relative', background: 'rgba(15, 15, 20, 0.4)' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Fast Onboarding</span>
          <h2 className="section-title">
            Setup in under{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
              three minutes.
            </span>
          </h2>
          <p className="section-desc">
            Bring your own key in 3 easy steps. No subscriptions or credit cards required.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          maxWidth: '1060px',
          margin: '0 auto'
        }}>
          {/* Step 1 */}
          <div className="glass-card" style={{ padding: '32px 28px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--accent-yellow-dim)',
              color: 'var(--accent-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Download size={20} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-yellow)', marginBottom: '8px' }}>
              STEP 01
            </div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Download Spitit</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Download the Windows installer or standalone portable exe. Spitit runs cleanly without extra runtimes.
            </p>
            <a href="#download" className="btn-secondary" style={{ width: '100%', fontSize: '13px' }}>
              <span>Download for Windows</span>
            </a>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ padding: '32px 28px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(77, 158, 255, 0.15)',
              color: 'var(--status-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Key size={20} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-blue)', marginBottom: '8px' }}>
              STEP 02
            </div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Get a Free Groq Key</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Log in to the Groq Cloud Console and create a free API key. Groq provides generous free tier limits for Whisper.
            </p>
            <a
              href={APP_CONFIG.groqConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ width: '100%', fontSize: '13px', color: 'var(--status-blue)' }}
            >
              <span>Get Free Key (console.groq.com)</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ padding: '32px 28px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(61, 220, 132, 0.15)',
              color: 'var(--status-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Sparkles size={20} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-green)', marginBottom: '8px' }}>
              STEP 03
            </div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Paste Key & Dictate</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Open Spitit Settings, paste your key once, and click &ldquo;Save Key&rdquo;. Hold <kbd style={{ fontFamily: 'var(--font-mono)' }}>Alt + Left Shift</kbd> anywhere and speak!
            </p>
            <div style={{
              fontSize: '12px',
              color: 'var(--status-green)',
              background: 'rgba(61, 220, 132, 0.08)',
              padding: '10px 14px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              Encrypted in Windows Credential Manager ✓
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
