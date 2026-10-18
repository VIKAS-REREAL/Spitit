import React from 'react';
import { Keyboard, Mic, Zap } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Simple 3-Step Flow</span>
          <h2 className="section-title">
            Push to talk,{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
              release to paste.
            </span>
          </h2>
          <p className="section-desc">
            No recording toggles to remember. No floating widgets getting in the way. Dictation is purely push-to-talk.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          maxWidth: '1060px',
          margin: '0 auto'
        }}>
          {/* Step 1 */}
          <div className="glass-card" style={{ padding: '36px 28px', position: 'relative' }}>
            <div style={{
              fontSize: '48px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: 'rgba(255, 213, 5, 0.18)',
              position: 'absolute',
              top: '20px',
              right: '24px'
            }}>
              01
            </div>

            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'var(--accent-yellow-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-yellow)',
              marginBottom: '22px'
            }}>
              <Keyboard size={22} />
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Hold the Hotkey</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6 }}>
              Press and hold <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 7px', borderRadius: '4px', color: '#fff', fontFamily: 'var(--font-mono)' }}>Alt + Left Shift</kbd> (or your custom shortcut) in any Windows application. The Win32 keyboard hook detects the modifier press within 1 millisecond.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ padding: '36px 28px', position: 'relative' }}>
            <div style={{
              fontSize: '48px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: 'rgba(77, 158, 255, 0.18)',
              position: 'absolute',
              top: '20px',
              right: '24px'
            }}>
              02
            </div>

            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(77, 158, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-blue)',
              marginBottom: '22px'
            }}>
              <Mic size={22} />
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Speak Naturally</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6 }}>
              The signature glass status pill appears with an audio waveform responding to your live voice intensity. Audio streams into a memory-only 16 kHz buffer with real-time silence trimming.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ padding: '36px 28px', position: 'relative' }}>
            <div style={{
              fontSize: '48px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: 'rgba(61, 220, 132, 0.18)',
              position: 'absolute',
              top: '20px',
              right: '24px'
            }}>
              03
            </div>

            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(61, 220, 132, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-green)',
              marginBottom: '22px'
            }}>
              <Zap size={22} />
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Release to Auto-Paste</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6 }}>
              Release the keys. Groq Whisper infers the audio in ~280 ms, writes the result to the Windows clipboard, and synthesizes an instant <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 7px', borderRadius: '4px', color: '#fff', fontFamily: 'var(--font-mono)' }}>Ctrl + V</kbd> paste into your active editor.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
