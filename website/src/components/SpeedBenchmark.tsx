import React from 'react';
import { Zap, Clock, Terminal, Cpu } from 'lucide-react';

export const SpeedBenchmark: React.FC = () => {
  return (
    <section className="section-padding" style={{ position: 'relative', background: 'rgba(12, 12, 16, 0.4)' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} /> Measured Performance
          </span>
          <h2 className="section-title">
            Engineered to feel{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
              instantaneous.
            </span>
          </h2>
          <p className="section-desc">
            No marketing exaggerations. Real architectural latency breakdown from keypress to text paste.
          </p>
        </div>

        {/* Latency Pipeline Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '20px',
          maxWidth: '1060px',
          margin: '0 auto 48px auto'
        }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-yellow)', marginBottom: '12px' }}>
              <Terminal size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Win32 Hook</span>
            </div>
            <div style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              &lt; 1 ms
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Low-level keyboard hook processes modifier key-down instantly on a dedicated thread.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-green)', marginBottom: '12px' }}>
              <Cpu size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>In-Memory WASAPI</span>
            </div>
            <div style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              0 ms disk delay
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Raw audio encoded directly into an in-memory WAV buffer. Zero temporary files on disk.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-blue)', marginBottom: '12px' }}>
              <Zap size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Groq LPU Inference</span>
            </div>
            <div style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              ~280 ms
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Whisper Turbo runs on Groq&apos;s custom LPUs, transcribing audio 10x faster than standard GPUs.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-yellow)', marginBottom: '12px' }}>
              <Clock size={18} />
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Auto-Paste Output</span>
            </div>
            <div style={{ fontSize: '32px', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              ~10 ms
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Native Win32 <code style={{ fontFamily: 'var(--font-mono)' }}>SendInput</code> pastes text into active window the instant modifiers release.
            </p>
          </div>
        </div>

        {/* Total Turnaround Callout */}
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '24px 32px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255, 213, 5, 0.06)',
          border: '1px solid rgba(255, 213, 5, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
              Total Post-Speech Turnaround: ~300 ms
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              From the millisecond you release your hotkey, your words are pasted in under a third of a second.
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent-yellow)',
            color: '#0b0b0e'
          }}>
            ~150+ WPM
          </div>
        </div>
      </div>
    </section>
  );
};
