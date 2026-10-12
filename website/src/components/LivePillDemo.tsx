import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Play, Pause, ExternalLink } from 'lucide-react';

export type PillState = 'recording' | 'transcribing' | 'done' | 'error';

interface LivePillDemoProps {
  externalState?: PillState;
  onStateChange?: (state: PillState) => void;
  interactive?: boolean;
}

export const LivePillDemo: React.FC<LivePillDemoProps> = ({
  externalState,
  onStateChange,
  interactive = true,
}) => {
  const [internalState, setInternalState] = useState<PillState>('recording');
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [seconds, setSeconds] = useState<number>(3);

  const activeState = externalState || internalState;

  // Auto-cycle through states if enabled
  useEffect(() => {
    if (!isAutoCycling || externalState !== undefined) return;

    const timer = setInterval(() => {
      setInternalState((prev) => {
        if (prev === 'recording') return 'transcribing';
        if (prev === 'transcribing') return 'done';
        if (prev === 'done') return 'recording';
        return 'recording';
      });
    }, 3200);

    return () => clearInterval(timer);
  }, [isAutoCycling, externalState]);

  // Seconds counter simulation during recording
  useEffect(() => {
    if (activeState !== 'recording') return;
    const interval = setInterval(() => {
      setSeconds((s) => (s >= 8 ? 1 : s + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeState]);

  const handleManualStateSelect = (state: PillState) => {
    setIsAutoCycling(false);
    setInternalState(state);
    if (onStateChange) onStateChange(state);
  };

  return (
    <div className="live-pill-wrap" style={{ textAlign: 'center' }}>
      {/* Visual Container */}
      <div
        className="pill-container"
        style={{
          borderColor:
            activeState === 'recording'
              ? 'transparent'
              : activeState === 'transcribing'
              ? 'rgba(77, 158, 255, 0.4)'
              : activeState === 'done'
              ? 'rgba(61, 220, 132, 0.4)'
              : 'rgba(255, 95, 95, 0.4)',
        }}
        title={`Spitit Status Pill: ${activeState}`}
      >
        {/* Conic Edge Beam (Active during Recording) */}
        {activeState === 'recording' && <div className="pill-beam" />}
        <div className="pill-beam-inner" />

        {/* Pill Content */}
        <div className="pill-content">
          {/* Left App Icon Indicator */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {activeState === 'error' ? (
              <AlertCircle size={15} color="var(--status-red)" />
            ) : activeState === 'done' ? (
              <Check size={16} color="var(--status-green)" strokeWidth={3} />
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--accent-yellow)' }}>VS</span>
            )}
          </div>

          {/* Middle Section: Waveform or Status */}
          {activeState === 'recording' && (
            <div className="waveform-bars">
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
            </div>
          )}

          {activeState === 'transcribing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="pill-spinner" />
              <span style={{ fontSize: '12px', color: 'var(--status-blue)', fontWeight: 500 }}>
                Transcribing...
              </span>
            </div>
          )}

          {activeState === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                18 words
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1 }}>
                142 WPM
              </span>
            </div>
          )}

          {activeState === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--status-red)', fontWeight: 600 }}>
                Mic Privacy Blocked
              </span>
              <ExternalLink size={11} color="var(--status-red)" />
            </div>
          )}

          {/* Right Section: Timer or Mode Tag */}
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {activeState === 'recording' && `0:0${seconds}`}
            {activeState === 'transcribing' && 'Groq'}
            {activeState === 'done' && (
              <span style={{ color: 'var(--status-green)', fontSize: '11px', fontWeight: 600 }}>
                Pasted ✓
              </span>
            )}
            {activeState === 'error' && 'Fix'}
          </div>
        </div>
      </div>

      {/* Interactive Controls & State Inspector */}
      {interactive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              gap: '4px',
            }}
          >
            {(['recording', 'transcribing', 'done', 'error'] as PillState[]).map((st) => (
              <button
                key={st}
                onClick={() => handleManualStateSelect(st)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: activeState === st ? 600 : 400,
                  color: activeState === st ? '#0b0b0e' : 'var(--text-muted)',
                  background:
                    activeState === st
                      ? st === 'recording'
                        ? 'var(--accent-yellow)'
                        : st === 'transcribing'
                        ? 'var(--status-blue)'
                        : st === 'done'
                        ? 'var(--status-green)'
                        : 'var(--status-red)'
                      : 'transparent',
                  transition: 'all 120ms ease',
                }}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAutoCycling(!isAutoCycling)}
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '11px', borderRadius: 'var(--radius-pill)' }}
            title={isAutoCycling ? 'Pause auto-cycle' : 'Resume auto-cycle'}
          >
            {isAutoCycling ? <Pause size={12} /> : <Play size={12} />}
            <span>{isAutoCycling ? 'Auto-cycling' : 'Paused'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
