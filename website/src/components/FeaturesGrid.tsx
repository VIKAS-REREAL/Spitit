import React from 'react';
import { Keyboard, Shield, HardDrive, BarChart3, AlertCircle, Cpu } from 'lucide-react';

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      icon: <Keyboard size={24} color="var(--accent-yellow)" />,
      title: "Win32 Low-Level Hook Engine",
      desc: "Built with WH_KEYBOARD_LL on a dedicated Win32 message pump thread. Supports modifier-only chords (Alt + Left Shift) in Push-to-Talk (Hold) and Toggle modes with self-healing watchdog."
    },
    {
      icon: <Cpu size={24} color="var(--status-blue)" />,
      title: "Sub-35 MB Idle RAM Budget",
      desc: "Rebuilt from legacy Python to native Rust and Tauri 2. When idle in the system tray, Spitit consumes under 35 MB of RAM and 0% CPU with instant wake-up."
    },
    {
      icon: <Shield size={24} color="var(--status-green)" />,
      title: "Windows Credential Manager",
      desc: "Your Groq API key is encrypted and stored in the native Windows Credential Manager vault via keyring. Zero plaintext keys are ever saved to configuration files or SQLite."
    },
    {
      icon: <HardDrive size={24} color="var(--accent-yellow)" />,
      title: "Local SQLite History & Privacy Toggle",
      desc: "Transcriptions are stored locally in an embedded SQLite database (capped at 500 records). You can toggle history saving off at any time, leaving zero text on disk."
    },
    {
      icon: <BarChart3 size={24} color="var(--status-blue)" />,
      title: "Foreground App Tracking & Stats",
      desc: "Detects the foreground window process name and icon locally to display in the status pill and calculate genuine productivity statistics (speaking duration, WPM, and time saved)."
    },
    {
      icon: <AlertCircle size={24} color="var(--status-red)" />,
      title: "11 Plain-Language Diagnostics",
      desc: "Never displays vague error codes. Identifies 11 distinct microphone and system issues (privacy blocked, device muted, rate limits) with one-click deep links to Windows Settings."
    }
  ];

  return (
    <section id="features" className="section-padding">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Crafted for Windows</span>
          <h2 className="section-title">
            Engineered without{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
              unnecessary clutter.
            </span>
          </h2>
          <p className="section-desc">
            No conversational AI chatbots. No meeting summaries. Just native, reliable, ultra-fast speech-to-text.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          maxWidth: '1100px',
          margin: '0 auto'
        }}>
          {features.map((f, idx) => (
            <div key={idx} className="glass-card" style={{ padding: '32px 28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
