import React from 'react';
import { X, BookOpen, Shield, FileText, Scale, Lock, History, HeartHandshake, MapPin } from 'lucide-react';
import { APP_CONFIG } from '../config';

export type DocId = 'docs' | 'privacy' | 'terms' | 'trademark' | 'security' | 'license' | 'changelog' | 'contributing' | 'roadmap';

interface DocModalProps {
  activeDoc: DocId | null;
  onClose: () => void;
  onSelectDoc: (id: DocId) => void;
}

export const DocModal: React.FC<DocModalProps> = ({ activeDoc, onClose, onSelectDoc }) => {
  if (!activeDoc) return null;

  const docsNav = [
    { id: 'docs', label: 'User Guide & Troubleshooting', icon: <BookOpen size={16} /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <Shield size={16} /> },
    { id: 'terms', label: 'Terms of Use', icon: <FileText size={16} /> },
    { id: 'trademark', label: 'Trademark Policy', icon: <Scale size={16} /> },
    { id: 'security', label: 'Security Policy', icon: <Lock size={16} /> },
    { id: 'license', label: 'License & Third-Party', icon: <FileText size={16} /> },
    { id: 'changelog', label: 'Changelog', icon: <History size={16} /> },
    { id: 'roadmap', label: 'Roadmap', icon: <MapPin size={16} /> },
    { id: 'contributing', label: 'Contributing Guide', icon: <HeartHandshake size={16} /> },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(5, 5, 8, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '88vh',
        background: 'rgba(16, 16, 22, 0.96)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(20, 20, 28, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--accent-yellow)' }}>Spitit Project Documentation</span>
            <span style={{ color: 'var(--text-faint)' }}>•</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>v{APP_CONFIG.version}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex'
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Layout: Sidebar + Document Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} className="modal-content-wrap">
          {/* Left Navigation */}
          <div style={{
            width: '240px',
            borderRight: '1px solid var(--border-subtle)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            background: 'rgba(12, 12, 16, 0.7)',
            overflowY: 'auto'
          }} className="modal-sidebar">
            {docsNav.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectDoc(item.id as DocId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  textAlign: 'left',
                  fontWeight: activeDoc === item.id ? 600 : 400,
                  color: activeDoc === item.id ? '#0b0b0e' : 'var(--text-muted)',
                  background: activeDoc === item.id ? 'var(--accent-yellow)' : 'transparent',
                  transition: 'all 120ms ease'
                }}
              >
                {item.icon}
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Document Content View */}
          <div style={{
            flex: 1,
            padding: '36px 40px',
            overflowY: 'auto',
            color: '#e4e4ed',
            fontSize: '14.5px',
            lineHeight: 1.7
          }} className="modal-scroll-pane">

            {/* DOC 1: USER GUIDE & TROUBLESHOOTING */}
            {activeDoc === 'docs' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>User Guide & Troubleshooting</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Essential guide to hotkeys, microphone setup, and Windows optimizations.</p>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '10px', color: 'var(--accent-yellow)' }}>1. Hotkeys & Safe Combinations</h3>
                <p>Spitit supports both <strong>Push-to-Talk (Hold)</strong> mode and <strong>Toggle</strong> mode:</p>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li><strong>Hold Mode (Default):</strong> Press and hold <kbd>Alt + Left Shift</kbd>, speak, and release to paste. Perfect for uninterrupted dictation without mode confusion.</li>
                  <li><strong>Toggle Mode:</strong> Press <kbd>Alt + Left Shift</kbd> once to start recording; press again to stop and auto-paste.</li>
                  <li><strong>Safe Combination Rules:</strong> Spitit blocks accidental bindings of single typing keys (A-Z, Space, Enter) to avoid intercepting normal typing. Chords must include at least one modifier key (Alt, Ctrl, Shift, or Win).</li>
                </ul>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '10px', color: 'var(--accent-yellow)' }}>2. Microphone Troubleshooting</h3>
                <p>If the status pill indicates an audio error, check these Windows settings:</p>
                <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Open <strong>Windows Settings</strong> &rarr; <strong>Privacy & Security</strong> &rarr; <strong>Microphone</strong>.</li>
                  <li>Ensure <strong>Microphone access</strong> is toggled <strong>ON</strong>.</li>
                  <li>Ensure <strong>Let desktop apps access your microphone</strong> is toggled <strong>ON</strong>.</li>
                  <li>In <strong>Sound Settings</strong>, ensure your default recording device is not muted and the input volume is set to 80% or higher.</li>
                </ol>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '10px', color: 'var(--accent-yellow)' }}>3. Windows Clipboard History Tip (<kbd>Win + V</kbd>)</h3>
                <p>Because Spitit copies each completed transcription to the system clipboard before auto-pasting, you can press <kbd>Win + V</kbd> at any time in Windows 10 & 11 to view your past voice clips and paste them again.</p>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '10px', color: 'var(--accent-yellow)' }}>4. Dictating into Administrator Windows</h3>
                <p>Windows enforces UIPI (User Interface Privilege Isolation). Standard apps cannot simulate keystrokes into windows running with elevated privileges (such as Administrator Command Prompt). To dictate into elevated windows, launch Spitit by right-clicking its icon and selecting <strong>Run as administrator</strong>.</p>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '10px', color: 'var(--accent-yellow)' }}>5. Complete Uninstall & Data Removal</h3>
                <p>To wipe all traces of Spitit:</p>
                <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>In Settings &rarr; History, click <strong>Clear History Now</strong>.</li>
                  <li>Open Windows Credential Manager (<code style={{ fontFamily: 'var(--font-mono)' }}>control keymgr.dll</code>) and remove the <strong>Spitit</strong> entry.</li>
                  <li>Uninstall via Windows Installed Apps.</li>
                  <li>Delete folder: <code style={{ fontFamily: 'var(--font-mono)' }}>%APPDATA%\com.rereal.spitit</code>.</li>
                </ol>
              </div>
            )}

            {/* DOC 2: PRIVACY POLICY */}
            {activeDoc === 'privacy' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Privacy Policy</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Last updated: October 12, 2026 • Local-first, zero-telemetry architecture.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px', color: 'var(--status-green)' }}>What Leaves Your Computer</h3>
                <p>Audio is captured strictly during active hotkey recording and streamed directly to <strong>Groq Cloud API</strong> (api.groq.com) over TLS using your personal API key under <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-yellow)' }}>Groq&apos;s Privacy Policy</a>. <strong>Zero audio ever touches REREAL or Spitit servers.</strong></p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px', color: 'var(--status-green)' }}>What Stays On Your Computer</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li><strong>API Key:</strong> Encrypted in native Windows Credential Manager.</li>
                  <li><strong>In-Memory Audio:</strong> 16 kHz WASAPI samples stored in RAM; zero audio saved to disk.</li>
                  <li><strong>History:</strong> Stored locally in SQLite (%APPDATA%\com.rereal.spitit\spitit.db) with instant disable toggle.</li>
                  <li><strong>Foreground App Info:</strong> Queries active window title and process icon to show in status pill and local statistics. Does NOT read document text.</li>
                </ul>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px', color: 'var(--status-green)' }}>Zero Telemetry Guarantee</h3>
                <p>Spitit contains zero analytics SDKs, zero crash trackers, zero remote databases, and zero accounts.</p>
              </div>
            )}

            {/* DOC 3: TERMS OF USE */}
            {activeDoc === 'terms' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Terms of Use</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Open-source software terms and responsible use guidelines.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>1. MIT Software License</h3>
                <p>The source code and downloadable binaries of Spitit are licensed under the MIT License. You are free to inspect, compile, modify, and redistribute the software for personal or commercial purposes without restrictions against reverse engineering.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>2. Responsible Use & Consent</h3>
                <p>You agree not to use Spitit to record third parties without appropriate legal consent under applicable local recording laws. You agree to comply with Groq&apos;s Acceptable Use Policy when transmitting audio to Groq endpoints.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>3. Disclaimer of Warranties</h3>
                <p>The software is provided &ldquo;as is&rdquo;, without warranty of any kind, express or implied. In no event shall the authors or copyright holders be liable for any claim or damages arising from the use of the software.</p>
              </div>
            )}

            {/* DOC 4: TRADEMARK POLICY */}
            {activeDoc === 'trademark' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Brand & Trademark Guidelines</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Protecting the community from malicious distribution under our name.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px', color: 'var(--accent-yellow)' }}>Protected Marks</h3>
                <p>The software name <strong>Spitit</strong>, the brand name <strong>REREAL</strong>, and the official logos and icons are reserved marks of Vikas Nath and REREAL. While the source code is MIT, the trademark is not.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>What Forks May Do</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Fork the repository and modify the source code under the MIT License.</li>
                  <li>State factually that your software is &ldquo;Based on Spitit&rdquo; or &ldquo;A fork of Spitit&rdquo;.</li>
                  <li>Link back to the official GitHub repository (github.com/VIKAS-REREAL/Spitit).</li>
                </ul>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>What Forks May NOT Do</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Ship or distribute compiled binaries or installer packages under the Spitit or REREAL name.</li>
                  <li>Use the official Spitit logos or icons as application icons for third-party builds.</li>
                  <li>Imply official endorsement or affiliation with REREAL.</li>
                </ul>
              </div>
            )}

            {/* DOC 5: SECURITY POLICY */}
            {activeDoc === 'security' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Security Policy</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Responsible disclosure and security triage commitments.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>Reporting Vulnerabilities</h3>
                <p>Please report security vulnerabilities privately via <strong>GitHub Private Vulnerability Reporting</strong> on the official repository: <a href={APP_CONFIG.securityUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-yellow)' }}>github.com/VIKAS-REREAL/Spitit/security/advisories</a>. Do not post active vulnerabilities in public issues or discussions.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>In-Scope Areas</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Windows Credential Manager integration and API key isolation.</li>
                  <li>Low-level keyboard hook safety and injection mitigation.</li>
                  <li>In-memory audio buffer isolation (ensuring no plaintext audio leaks to disk).</li>
                  <li>Clipboard and SendInput auto-paste synchronization.</li>
                </ul>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>Response SLA</h3>
                <p>As an independent solo-maintained open-source project, initial confirmation is provided within <strong>48 to 72 hours</strong>, with triage completed within <strong>7 days</strong>.</p>
              </div>
            )}

            {/* DOC 6: LICENSE & THIRD-PARTY */}
            {activeDoc === 'license' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>License & Third-Party Notices</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>MIT License and third-party software attribution.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>Spitit MIT License</h3>
                <pre style={{ background: 'rgba(10, 10, 14, 0.8)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
{`MIT License

Copyright (c) 2026 Vikas Nath (REREAL)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND...`}
                </pre>

                <h3 style={{ fontSize: '18px', marginTop: '24px', marginBottom: '8px' }}>Third-Party Attribution</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li><strong>Tauri 2:</strong> MIT / Apache-2.0 (The Tauri Programme)</li>
                  <li><strong>Windows Crate:</strong> MIT / Apache-2.0 (Microsoft Corporation)</li>
                  <li><strong>cpal (Audio):</strong> Apache-2.0 (Pierre Krieger)</li>
                  <li><strong>rusqlite:</strong> MIT (John Gallagher)</li>
                  <li><strong>keyring:</strong> MIT / Apache-2.0 (Brocode)</li>
                  <li><strong>cssparser / selectors:</strong> Mozilla Public License 2.0 (MPL-2.0)</li>
                </ul>
              </div>
            )}

            {/* DOC 7: CHANGELOG */}
            {activeDoc === 'changelog' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Changelog</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Semantic release notes for Spitit.</p>

                <h3 style={{ fontSize: '18px', color: 'var(--accent-yellow)' }}>Version 3.0.0 (October 2026)</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Complete architectural rewrite from legacy Python to native Tauri 2 and Rust core.</li>
                  <li>Idle RAM footprint reduced from ~150 MB to &lt; 35 MB.</li>
                  <li>Signature glass status pill with live 5-bar voice waveform responding to WASAPI audio RMS.</li>
                  <li>Win32 low-level keyboard hook (WH_KEYBOARD_LL) with watchdog thread.</li>
                  <li>Direct Groq Cloud Whisper Turbo and Roman Hinglish transliteration pipeline.</li>
                  <li>API keys encrypted and stored in Windows Credential Manager.</li>
                  <li>Embedded SQLite text history with instant privacy disable toggle.</li>
                  <li>Legacy Python implementation (REREAL-Spitit) officially retired.</li>
                </ul>
              </div>
            )}

            {/* DOC 8: ROADMAP */}
            {activeDoc === 'roadmap' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Development Roadmap</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Public roadmap and non-goals.</p>

                <h3 style={{ fontSize: '18px', color: 'var(--accent-yellow)' }}>v3.1 (Near-Term)</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Open-source code signing through SignPath Foundation OSS program.</li>
                  <li>Microsoft Store certified MSIX packaging.</li>
                  <li>In-app microphone selector with live input level testing.</li>
                  <li>Custom pill positioning options (dock near caret vs screen top).</li>
                </ul>

                <h3 style={{ fontSize: '18px', color: 'var(--status-blue)', marginTop: '20px' }}>v3.2+ (Future)</h3>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li>Local offline transcription option via whisper.cpp / ONNX Runtime.</li>
                  <li>Per-application language auto-switching rules.</li>
                  <li>Custom pill accent color themes.</li>
                </ul>

                <h3 style={{ fontSize: '18px', color: 'var(--status-red)', marginTop: '20px' }}>Explicit Non-Goals</h3>
                <p>Spitit will never add cloud user accounts, remote telemetry, AI chatbot rewriting clutter, or subscription paywalls.</p>
              </div>
            )}

            {/* DOC 9: CONTRIBUTING */}
            {activeDoc === 'contributing' && (
              <div>
                <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Contributing Guide</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>How to set up, build, and contribute under Developer Certificate of Origin (DCO).</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>Prerequisites</h3>
                <p>Windows 10/11 (64-bit), Node.js 18+, Rust &amp; Cargo (stable), Microsoft C++ Build Tools (MSVC), and Microsoft Edge WebView2.</p>

                <h3 style={{ fontSize: '18px', marginTop: '20px', marginBottom: '8px' }}>Developer Certificate of Origin (DCO)</h3>
                <p>Spitit uses DCO rather than a CLA. Simply sign off on your commits with git:</p>
                <pre style={{ background: 'rgba(10, 10, 14, 0.8)', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
git commit -s -m &quot;feat: your commit message&quot;
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .modal-content-wrap { flex-direction: column !important; }
          .modal-sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--border-subtle) !important; max-height: 140px; }
          .modal-scroll-pane { padding: 20px !important; }
        }
      `}</style>
    </div>
  );
};
