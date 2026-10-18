import React, { useState, useEffect } from 'react';
import { ActualPill, ActualPillState } from './ActualPill';
import { Play, Pause } from 'lucide-react';

export type PillState = ActualPillState;

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      {/* The Authentic 29px Win32 Pill */}
      <ActualPill
        state={activeState}
        timerSec={seconds}
        isRecordingActive={activeState === 'recording'}
        scale={1.25}
      />

      {/* Interactive Controls & State Inspector */}
      {interactive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              gap: '3px',
            }}
          >
            {(['recording', 'transcribing', 'done', 'error'] as PillState[]).map((st) => (
              <button
                key={st}
                onClick={() => handleManualStateSelect(st)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: activeState === st ? 600 : 400,
                  color: activeState === st ? '#0b0b0e' : 'var(--text-muted)',
                  background:
                    activeState === st
                      ? st === 'recording'
                        ? 'var(--accent-gold)'
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
            style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '9999px' }}
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
