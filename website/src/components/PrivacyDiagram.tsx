import React from 'react';
import { Shield, Lock, Laptop, Cloud, XCircle, FileCode, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface PrivacyDiagramProps {
  onOpenPrivacyDoc: () => void;
}

export const PrivacyDiagram: React.FC<PrivacyDiagramProps> = ({ onOpenPrivacyDoc }) => {
  return (
    <section id="privacy" className="section-padding" style={{ position: 'relative' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} /> Radical Transparency
          </span>
          <h2 className="section-title">What Goes Where (And What Doesn&apos;t)</h2>
          <p className="section-desc">
            We don&apos;t claim &ldquo;100% offline&rdquo; while secretly streaming audio to our servers. Here is the honest, architectural truth of every byte in Spitit.
          </p>
        </div>

        {/* The 3-Node Architecture Diagram */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          maxWidth: '1060px',
          margin: '0 auto 48px auto'
        }}>
          {/* Node 1: Local PC */}
          <div className="glass-card" style={{ padding: '30px', borderTop: '3px solid var(--status-green)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(61, 220, 132, 0.15)',
                color: 'var(--status-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Laptop size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px' }}>Your Local PC</h3>
                <span style={{ fontSize: '12px', color: 'var(--status-green)', fontWeight: 600 }}>Stays 100% On-Device</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>API Key Vault:</strong> Stored securely in Windows Credential Manager. Never in plaintext.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>In-Memory Audio:</strong> 16 kHz WASAPI samples stored in RAM. Zero audio files written to disk.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Local SQLite DB:</strong> Text history (optional, with instant disable toggle) and local 90-day usage metrics.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Foreground App Tracking:</strong> Only queries active window title and process icon to show in status pill. Does NOT read document text.</span>
              </li>
            </ul>
          </div>

          {/* Node 2: Groq Cloud (BYOK) */}
          <div className="glass-card" style={{ padding: '30px', borderTop: '3px solid var(--status-blue)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(77, 158, 255, 0.15)',
                color: 'var(--status-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Cloud size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px' }}>Groq Cloud API</h3>
                <span style={{ fontSize: '12px', color: 'var(--status-blue)', fontWeight: 600 }}>Direct Encrypted TLS</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Direct Connection:</strong> Audio bytes travel straight from your computer to Groq&apos;s TLS endpoint.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Your Personal Key (BYOK):</strong> Authenticated via your own Groq API key under Groq&apos;s privacy terms.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Whisper Turbo Inference:</strong> High-speed transcription returned in ~280 ms.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="var(--status-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Hinglish Cleanup:</strong> Single LLM pass in Hinglish mode via Groq Llama 3.1 8B.</span>
              </li>
            </ul>
          </div>

          {/* Node 3: Spitit / REREAL Servers */}
          <div className="glass-card" style={{ padding: '30px', borderTop: '3px solid var(--status-red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 95, 95, 0.15)',
                color: 'var(--status-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px' }}>Spitit / REREAL</h3>
                <span style={{ fontSize: '12px', color: 'var(--status-red)', fontWeight: 600 }}>Zero Servers Exist</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <XCircle size={16} color="var(--status-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Zero Backend Servers:</strong> There are no Spitit databases, proxies, or cloud relays.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <XCircle size={16} color="var(--status-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Zero Remote Telemetry:</strong> No tracking SDKs, no analytics pings, no crash log uploads.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <XCircle size={16} color="var(--status-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Zero User Accounts:</strong> No signups, no passwords, no email collection, no subscriptions.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <XCircle size={16} color="var(--status-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Zero Middleman Margins:</strong> You pay zero markups on tokens.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* The Keyboard Hook Explainer Card */}
        <div
          className="glass-card"
          style={{
            maxWidth: '1060px',
            margin: '0 auto',
            padding: '32px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 16, 22, 0.85)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ maxWidth: '720px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <FileCode size={18} color="var(--accent-yellow)" />
                <h3 style={{ fontSize: '18px' }}>What the Win32 Keyboard Hook Does (and Does NOT Do)</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
                Spitit installs a low-level global keyboard hook (<code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-yellow)' }}>WH_KEYBOARD_LL</code>) so hotkeys work inside every window. Because unsigned keyboard hooks are sometimes flagged by antivirus tools, our guarantees are concrete:
              </p>
              <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                <li>It only monitors state transitions for designated modifier keys (e.g. Alt, Left Shift).</li>
                <li><strong>It never records, stores, or logs keystrokes you type.</strong></li>
                <li><strong>It never sends typed text over the network.</strong></li>
                <li>Normal typing passes directly through untouched with zero input lag.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={`${APP_CONFIG.repoUrl}/blob/main/src-tauri/src/hotkey.rs`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                <span>Inspect Hook Source Code ↗</span>
              </a>
              <button
                onClick={onOpenPrivacyDoc}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px', color: 'var(--accent-yellow)' }}
              >
                <span>Read Full Privacy Policy</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
