import React, { useState } from 'react';
import { Download, ShieldCheck, Copy, Check, AlertTriangle, Monitor, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { useDeviceDetect } from '../utils/useDeviceDetect';
import { GithubIcon } from './GithubIcon';

export const DownloadSection: React.FC = () => {
  const device = useDeviceDetect();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState<boolean>(false);

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
          <h2 className="section-title">
            {device.isWindows || showOverride ? (
              <>
                Download Spitit{' '}
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
                  for Windows.
                </span>
              </>
            ) : (
              <>
                Spitit{' '}
                <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
                  for {device.osName}.
                </span>
              </>
            )}
          </h2>
          <p className="section-desc">
            Direct, clean downloads. No email gates, zero telemetry, and verified cryptographic SHA-256 signatures.
          </p>
        </div>

        {/* Non-Windows OS Detection Notice */}
        {!device.isWindows && !showOverride && (
          <div
            className="glass-card"
            style={{
              maxWidth: '720px',
              margin: '0 auto 48px auto',
              padding: '36px 32px',
              borderTop: '3px solid var(--accent-gold)',
              textAlign: 'center'
            }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 213, 5, 0.1)',
              border: '1px solid rgba(255, 213, 5, 0.25)',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--accent-gold)',
              marginBottom: '16px'
            }}>
              <Sparkles size={14} />
              <span>{device.osName} Build In Development</span>
            </div>

            <h3 style={{ fontSize: '24px', marginBottom: '12px', letterSpacing: '-0.02em' }}>
              Spitit is Currently Built for Windows 10 &amp; 11
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '580px', margin: '0 auto 24px auto' }}>
              Spitit relies directly on native Win32 low-level keyboard hooks (<code style={{ fontFamily: 'var(--font-mono)' }}>WH_KEYBOARD_LL</code>) and the Windows Credential Manager vault. We are actively working on cross-platform architectures for macOS and Linux.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <a
                href={APP_CONFIG.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ fontSize: '14.5px', padding: '12px 24px' }}
              >
                <GithubIcon size={16} />
                <span>Star on GitHub for {device.osName} Release</span>
              </a>

              <button
                onClick={() => setShowOverride(true)}
                className="btn-secondary"
                style={{ fontSize: '14px', padding: '12px 20px' }}
              >
                <Download size={15} />
                <span>Download Windows .exe anyway</span>
              </button>
            </div>
          </div>
        )}

        {/* Windows Download Cards Grid (Rendered for Windows or when Override is active) */}
        {(device.isWindows || showOverride) && (
          <>
            {showOverride && (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <Monitor size={13} />
                  <span>Showing Windows 10 / 11 (64-bit) packages</span>
                  <button
                    onClick={() => setShowOverride(false)}
                    style={{ color: 'var(--accent-gold)', marginLeft: '6px', textDecoration: 'underline' }}
                  >
                    Reset filter
                  </button>
                </span>
              </div>
            )}

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
                borderTop: '3px solid var(--accent-gold)',
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
                      background: 'var(--accent-gold-subtle)',
                      color: 'var(--accent-gold)'
                    }}>
                      Recommended
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Size: {APP_CONFIG.downloads.installer.size}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Setup Installer</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                    Full NSIS Windows installer. Sets up Start Menu shortcuts, system tray autostart, and clean uninstaller.
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
                        style={{ fontSize: '11px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}
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
          </>
        )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)', marginBottom: '10px' }}>
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
              Only download Spitit from this official website (<code style={{ fontFamily: 'var(--font-mono)' }}>spitit.in</code>) or directly from <a href={APP_CONFIG.releasesUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>GitHub Releases</a>. Verify checksums using <code style={{ fontFamily: 'var(--font-mono)' }}>Get-FileHash</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
