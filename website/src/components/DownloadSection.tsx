import React, { useState } from 'react';
import { Download, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react';
import { APP_CONFIG } from '../config';

export const DownloadSection: React.FC = () => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <section id="download" className="section-padding" style={{ position: 'relative' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Official Releases
          </span>
          <h2 className="section-title">Download Spitit for Windows</h2>
          <p className="section-desc">
            Direct, clean downloads. No email gates, no bundled adware, no installer telemetry.
          </p>
        </div>

        {/* Download Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          maxWidth: '960px',
          margin: '0 auto 48px auto'
        }}>
          {/* Card 1: Setup Installer */}
          <div className="glass-card" style={{
            padding: '36px 30px',
            borderTop: '3px solid var(--accent-yellow)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--accent-yellow-dim)',
                  color: 'var(--accent-yellow)'
                }}>
                  Recommended
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Size: {APP_CONFIG.downloads.installer.size}
                </span>
              </div>

              <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Setup Installer</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Full NSIS Windows installer. Sets up Start Menu shortcuts, system tray autostart, and standard uninstaller.
              </p>

              <div style={{
                background: 'rgba(10, 10, 14, 0.7)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    SHA-256 Checksum:
                  </span>
                  <button
                    onClick={() => handleCopyHash(APP_CONFIG.downloads.installer.sha256, 'installer')}
                    style={{ fontSize: '11px', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedHash === 'installer' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHash === 'installer' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div style={{
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#aaa',
                  wordBreak: 'break-all',
                  lineHeight: 1.4
                }}>
                  {APP_CONFIG.downloads.installer.sha256}
                </div>
              </div>
            </div>

            <a
              href={APP_CONFIG.downloads.installer.url}
              className="btn-primary"
              style={{ width: '100%', fontSize: '15px', padding: '12px' }}
            >
              <Download size={18} />
              <span>Download Installer (.exe)</span>
            </a>
          </div>

          {/* Card 2: Standalone Portable */}
          <div className="glass-card" style={{
            padding: '36px 30px',
            borderTop: '3px solid var(--status-blue)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(77, 158, 255, 0.15)',
                  color: 'var(--status-blue)'
                }}>
                  Zero Install
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Size: {APP_CONFIG.downloads.portable.size}
                </span>
              </div>

              <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Standalone Portable</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Single standalone binary. Run from anywhere or carry on a USB drive. Zero registry entries or installer footprint.
              </p>

              <div style={{
                background: 'rgba(10, 10, 14, 0.7)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    SHA-256 Checksum:
                  </span>
                  <button
                    onClick={() => handleCopyHash(APP_CONFIG.downloads.portable.sha256, 'portable')}
                    style={{ fontSize: '11px', color: 'var(--status-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedHash === 'portable' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHash === 'portable' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div style={{
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)',
                  color: '#aaa',
                  wordBreak: 'break-all',
                  lineHeight: 1.4
                }}>
                  {APP_CONFIG.downloads.portable.sha256}
                </div>
              </div>
            </div>

            <a
              href={APP_CONFIG.downloads.portable.url}
              className="btn-secondary"
              style={{ width: '100%', fontSize: '15px', padding: '12px' }}
            >
              <Download size={18} />
              <span>Download Portable (.exe)</span>
            </a>
          </div>
        </div>

        {/* Verification & SmartScreen Explainer Alert */}
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {/* SmartScreen Explainer */}
          <div className="glass-card" style={{ padding: '24px', background: 'rgba(18, 18, 24, 0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-yellow)', marginBottom: '10px' }}>
              <AlertTriangle size={18} />
              <h4 style={{ fontSize: '15px' }}>Windows SmartScreen (&ldquo;Unknown Publisher&rdquo;)</h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Because Spitit is an independent open-source release without an expensive corporate EV certificate, Windows SmartScreen may show a prompt on first run. Click <strong>&ldquo;More info&rdquo;</strong> &rarr; <strong>&ldquo;Run anyway&rdquo;</strong>.
            </p>
          </div>

          {/* Official Downloads Only Warning */}
          <div className="glass-card" style={{ padding: '24px', background: 'rgba(18, 18, 24, 0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-green)', marginBottom: '10px' }}>
              <ShieldCheck size={18} />
              <h4 style={{ fontSize: '15px' }}>Official Downloads Security</h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Only download Spitit from this official website (<code style={{ fontFamily: 'var(--font-mono)' }}>spitit.in</code>) or directly from <a href={APP_CONFIG.releasesUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-yellow)', textDecoration: 'underline' }}>GitHub Releases</a>. Verify checksums using <code style={{ fontFamily: 'var(--font-mono)' }}>Get-FileHash</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
