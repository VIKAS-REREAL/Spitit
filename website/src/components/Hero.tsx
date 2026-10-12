import React from 'react';
import { APP_CONFIG } from '../config';
import { Download, Shield, Cpu, Zap, Lock } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { LivePillDemo } from './LivePillDemo';

export const Hero: React.FC = () => {
  return (
    <header style={{ position: 'relative', paddingTop: '70px', paddingBottom: '90px', overflow: 'hidden' }}>
      <div className="hero-glow" />
      <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Top Announcement Tag */}
        <div style={{ display: 'inline-flex', marginBottom: '22px' }}>
          <div className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-yellow)' }} />
            <span>Spitit v3.0 Fresh Release • Native Tauri 2 + Rust Core</span>
          </div>
        </div>

        {/* Main Title */}
        <h1 style={{
          fontSize: 'clamp(36px, 5.5vw, 62px)',
          maxWidth: '920px',
          margin: '0 auto 20px auto',
          letterSpacing: '-0.03em',
          fontWeight: 700
        }}>
          Voice-First Typing for Windows.<br />
          <span style={{
            background: 'linear-gradient(135deg, #ffffff 40%, var(--accent-yellow) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Powered by Your Own Groq Key.
          </span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--text-muted)',
          maxWidth: '680px',
          margin: '0 auto 36px auto',
          lineHeight: 1.6
        }}>
          Hold down your hotkey, speak naturally, and release. Instant speech-to-text with signature glass status pill, zero telemetry, and sub-35 MB idle RAM.
        </p>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '50px'
        }}>
          <a href="#download" className="btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
            <Download size={19} />
            <span>Download for Windows (v3.0.0)</span>
          </a>

          <a
            href={APP_CONFIG.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '14px 24px', fontSize: '16px' }}
          >
            <GithubIcon size={18} />
            <span>View Source on GitHub</span>
          </a>
        </div>

        {/* Centerpiece: Live Status Pill Interactive Simulator */}
        <div style={{
          margin: '0 auto 56px auto',
          maxWidth: '480px',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(17, 17, 22, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Live Signature Status Pill (Hardware-Accelerated)
          </div>
          <LivePillDemo interactive={true} />
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '16px', marginInline: 'auto', maxWidth: '360px' }}>
            Non-activating overlay window with live WASAPI audio waveform. Never steals keyboard focus.
          </p>
        </div>

        {/* Trust Points Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          margin: '0 auto',
          textAlign: 'left'
        }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={20} color="var(--accent-yellow)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>100% MIT Open Source</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inspect, fork & compile freely</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Lock size={20} color="var(--status-green)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Zero REREAL Servers</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No telemetry or accounts</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cpu size={20} color="var(--status-blue)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>&lt; 35 MB Idle Footprint</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Native Rust Win32 core</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={20} color="var(--accent-yellow)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>~280 ms Groq Latency</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Whisper LPU cloud inference</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
