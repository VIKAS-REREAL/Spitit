import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Check } from 'lucide-react';
import { LivePillDemo, PillState } from './LivePillDemo';

interface DemoTarget {
  id: string;
  name: string;
  filename: string;
  samplePrompt: string;
  transcription: string;
}

const TARGETS: DemoTarget[] = [
  {
    id: 'slack',
    name: 'Slack',
    filename: '#dev-announcements',
    samplePrompt: 'Speaking into Slack...',
    transcription: 'Hey team, the Spitit v3 release is now compiled and ready for testing! The low-level Win32 keyboard hook is running smoothly.'
  },
  {
    id: 'vscode',
    name: 'VS Code',
    filename: 'main.rs',
    samplePrompt: 'Dictating code comment...',
    transcription: '// Spawn dedicated Win32 message pump thread for low-level keyboard hook without blocking UI runtime.'
  },
  {
    id: 'notepad',
    name: 'Notepad',
    filename: 'quick_notes.txt',
    samplePrompt: 'Taking quick thought...',
    transcription: 'Remember to verify the SHA256 checksums before deploying the new installer build to the release page.'
  }
];

export const InteractiveDictationDemo: React.FC = () => {
  const [selectedTarget, setSelectedTarget] = useState<DemoTarget>(TARGETS[0]);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [displayText, setDisplayText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<number | null>(null);

  const startSimulation = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setDisplayText('');
    setPhase('recording');

    // Simulate 2.5s speaking
    setTimeout(() => {
      setPhase('processing');

      // Simulate 350ms Groq Whisper inference
      setTimeout(() => {
        setPhase('done');
        typeOutText(selectedTarget.transcription);
      }, 500);
    }, 2400);
  };

  const typeOutText = (fullText: string) => {
    setIsTyping(true);
    let index = 0;
    const interval = setInterval(() => {
      index += 2;
      setDisplayText(fullText.slice(0, index));
      if (index >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 20);
    typingTimerRef.current = interval as unknown as number;
  };

  const handleReset = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setPhase('idle');
    setDisplayText('');
  };

  useEffect(() => {
    // Initial run
    startSimulation();
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [selectedTarget]);

  const pillState: PillState =
    phase === 'recording'
      ? 'recording'
      : phase === 'processing'
      ? 'transcribing'
      : phase === 'done'
      ? 'done'
      : 'recording';

  return (
    <section id="demo" className="section-padding" style={{ position: 'relative' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Live System Integration</span>
          <h2 className="section-title">Dictate Directly into Any Windows App</h2>
          <p className="section-desc">
            No copying and pasting. No switching tabs. Hold your hotkey, speak naturally, and release. Text lands instantly at your cursor.
          </p>
        </div>

        {/* Mock Application Window */}
        <div
          className="glass-card"
          style={{
            maxWidth: '820px',
            margin: '0 auto',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)'
          }}
        >
          {/* Mock Window Title Bar */}
          <div style={{
            background: 'rgba(16, 16, 20, 0.95)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28c840' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>
                {selectedTarget.name} — {selectedTarget.filename}
              </span>
            </div>

            {/* Target App Switcher Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTarget(t); handleReset(); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedTarget.id === t.id ? 600 : 400,
                    background: selectedTarget.id === t.id ? 'rgba(255, 213, 5, 0.15)' : 'transparent',
                    color: selectedTarget.id === t.id ? 'var(--accent-yellow)' : 'var(--text-faint)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Window Body & Mock Editor */}
          <div style={{ padding: '36px 30px', minHeight: '260px', position: 'relative', background: 'rgba(12, 12, 16, 0.85)' }}>
            {/* Overlay Simulated Pill during active recording/processing */}
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '28px',
              zIndex: 10,
              transform: 'scale(0.95)'
            }}>
              <LivePillDemo externalState={pillState} interactive={false} />
            </div>

            {/* Editor Content Area */}
            <div style={{
              fontFamily: selectedTarget.id === 'vscode' ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#f0f0f5',
              maxWidth: '660px'
            }}>
              {phase === 'idle' && (
                <span style={{ color: 'var(--text-faint)' }}>
                  Click &quot;Simulate Dictation&quot; or select an app above to watch text paste in real time...
                </span>
              )}

              {phase === 'recording' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-yellow)' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-yellow)', animation: 'barPulse 0.8s infinite' }} />
                  <span>Listening to speech: &quot;{selectedTarget.transcription.slice(0, 38)}...&quot;</span>
                </div>
              )}

              {phase === 'processing' && (
                <span style={{ color: 'var(--status-blue)' }}>Streaming audio to Groq Whisper LPU...</span>
              )}

              {phase === 'done' && (
                <div>
                  <span>{displayText}</span>
                  {isTyping && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '18px',
                      background: 'var(--accent-yellow)',
                      marginLeft: '2px',
                      verticalAlign: 'middle',
                      animation: 'barPulse 0.5s infinite'
                    }} />
                  )}
                </div>
              )}
            </div>

            {/* Simulation Telemetry Bar */}
            {phase === 'done' && !isTyping && (
              <div style={{
                marginTop: '36px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--status-green)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                    <Check size={14} /> Synthetic Auto-Paste (Ctrl+V)
                  </span>
                  <span>Latency: <strong style={{ color: '#fff' }}>280 ms</strong></span>
                  <span>WPM: <strong style={{ color: '#fff' }}>148 WPM</strong></span>
                </div>

                <button
                  onClick={startSimulation}
                  className="btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                >
                  <RotateCcw size={13} />
                  <span>Replay Demo</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div style={{
            background: 'rgba(18, 18, 24, 0.95)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Shortcut: <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 7px', borderRadius: '4px', color: '#fff', fontFamily: 'var(--font-mono)' }}>Alt + Left Shift</kbd> (Hold mode)
            </div>

            <button
              onClick={startSimulation}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px' }}
              disabled={phase === 'recording' || phase === 'processing'}
            >
              <Play size={14} />
              <span>{phase === 'recording' ? 'Recording Voice...' : phase === 'processing' ? 'Processing...' : 'Simulate Dictation'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
