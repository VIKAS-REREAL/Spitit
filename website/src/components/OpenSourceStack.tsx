import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, ShieldAlert } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { APP_CONFIG } from '../config';

interface OpenSourceStackProps {
  onOpenDoc: (docId: string) => void;
}

export const OpenSourceStack: React.FC<OpenSourceStackProps> = ({ onOpenDoc }) => {
  const [copied, setCopied] = useState(false);

  const buildSnippet = `# 1. Clone repository
git clone https://github.com/VIKAS-REREAL/Spitit.git
cd Spitit

# 2. Install dependencies & build
npm install
npm run tauri build`;

  const handleCopy = () => {
    navigator.clipboard.writeText(buildSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="section-padding">
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Code2 size={14} /> Community & Trust
          </span>
          <h2 className="section-title">Proudly Open Source</h2>
          <p className="section-desc">
            Spitit is licensed under the permissive MIT License. Full transparency, reproducible builds, and community-driven development.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          maxWidth: '1060px',
          margin: '0 auto'
        }}>
          {/* GitHub Repository Card */}
          <div className="glass-card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <GithubIcon size={28} />
                <div>
                  <h3 style={{ fontSize: '18px' }}>VIKAS-REREAL/Spitit</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Official GitHub Repository</span>
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Every line of Rust and React code is publicly auditable. Open issues, discuss features, or submit pull requests with full Developer Certificate of Origin (DCO) support.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(255, 213, 5, 0.12)',
                  color: 'var(--accent-yellow)',
                  fontWeight: 600
                }}>
                  License: MIT
                </span>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff'
                }}>
                  Windows 10 / 11
                </span>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff'
                }}>
                  Tauri 2 + Rust
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href={APP_CONFIG.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ fontSize: '14px', padding: '10px 18px', flex: 1, minWidth: '140px' }}
              >
                <GithubIcon size={16} />
                <span>View on GitHub</span>
              </a>
              <button
                onClick={() => onOpenDoc('contributing')}
                className="btn-secondary"
                style={{ fontSize: '14px', padding: '10px 16px' }}
              >
                <span>Contributing Guide</span>
              </button>
            </div>
          </div>

          {/* Reproducible Build Box */}
          <div className="glass-card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} color="var(--accent-yellow)" />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Build From Source</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  title="Copy build commands"
                >
                  {copied ? <Check size={13} color="var(--status-green)" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <pre style={{
                background: 'rgba(10, 10, 14, 0.85)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                color: '#e4e4ed',
                fontFamily: 'var(--font-mono)',
                fontSize: '12.5px',
                lineHeight: 1.6,
                overflowX: 'auto',
                marginBottom: '20px'
              }}>
                {buildSnippet}
              </pre>
            </div>

            {/* Trademark Note */}
            <div style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>
                <ShieldAlert size={14} color="var(--accent-yellow)" />
                <span>Trademark Notice</span>
              </div>
              The code is MIT. The names &ldquo;Spitit&rdquo;, &ldquo;REREAL&rdquo; and logos are reserved to ensure release safety. Unofficial forks must use distinct branding.{' '}
              <button
                onClick={() => onOpenDoc('trademark')}
                style={{ color: 'var(--accent-yellow)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                Read Policy
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
