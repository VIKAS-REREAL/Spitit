import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export type ActualPillState = 'recording' | 'transcribing' | 'done' | 'error';

interface ActualPillProps {
  state: ActualPillState;
  app?: 'vscode' | 'slack' | 'notepad' | 'cursor';
  wordCount?: number;
  wpm?: number;
  timerSec?: number;
  isRecordingActive?: boolean;
  scale?: number;
  onClick?: () => void;
}

export const ActualPill: React.FC<ActualPillProps> = ({
  state,
  app = 'vscode',
  wordCount = 18,
  wpm = 142,
  timerSec = 3,
  isRecordingActive = true,
  scale = 1,
  onClick,
}) => {
  const [waveHeights, setWaveHeights] = useState<number[]>([4, 7, 12, 6, 4]);

  // Audio wave oscillation physics simulating live voice RMS
  useEffect(() => {
    if (state !== 'recording' || !isRecordingActive) return;

    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setWaveHeights([
        3.5 + Math.abs(Math.sin(frame * 0.45)) * 9,
        4.0 + Math.abs(Math.sin(frame * 0.55 + 1.2)) * 13,
        5.0 + Math.abs(Math.sin(frame * 0.35 + 2.1)) * 15,
        4.0 + Math.abs(Math.sin(frame * 0.65 + 0.8)) * 12,
        3.5 + Math.abs(Math.sin(frame * 0.40 + 1.8)) * 8,
      ]);
    }, 60);

    return () => clearInterval(interval);
  }, [state, isRecordingActive]);

  const renderAppIcon = () => {
    if (app === 'vscode') {
      return (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          background: '#007acc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0
        }}>
          VS
        </div>
      );
    }
    if (app === 'slack') {
      return (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          background: '#4a154b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          color: '#e01e5a',
          flexShrink: 0
        }}>
          #
        </div>
      );
    }
    if (app === 'cursor') {
      return (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          background: '#1e1e1e',
          border: '1px solid #444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0
        }}>
          &gt;_
        </div>
      );
    }
    return (
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '4px',
        background: '#2b2b36',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: 'var(--accent-yellow)',
        flexShrink: 0
      }}>
        txt
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        className={`actual-pill-capsule ${state}`}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: '#111114',
          borderRadius: '9999px',
          padding: '4px 11px',
          boxShadow:
            state === 'done'
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 4px 16px rgba(52, 199, 89, 0.28)'
              : state === 'error'
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 16px rgba(255, 69, 58, 0.28)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 16px rgba(0, 0, 0, 0.55)',
          border:
            state === 'recording'
              ? '1.2px solid rgba(255, 213, 5, 0.35)'
              : state === 'done'
              ? '1.2px solid #34C759'
              : state === 'error'
              ? '1.2px solid #FF453A'
              : '1.2px solid rgba(255, 255, 255, 0.18)',
          height: '29px',
          minWidth: '96px',
          boxSizing: 'border-box',
          transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Actual Conic Edge Beam Layer (When recording) */}
        {state === 'recording' && (
          <div className="actual-pill-edge-beam" />
        )}

        {/* Content Items */}
        {state === 'recording' && (
          <>
            {renderAppIcon()}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5px', height: '16px' }}>
              {waveHeights.map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: '2.5px',
                    height: `${h}px`,
                    background: '#FFD505',
                    borderRadius: '1px',
                    transition: 'height 60ms linear',
                  }}
                />
              ))}
            </div>
            <span style={{
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: '#A0A0A5',
              letterSpacing: '-0.02em',
              lineHeight: 1
            }}>
              0:0{timerSec}
            </span>
          </>
        )}

        {state === 'transcribing' && (
          <>
            {renderAppIcon()}
            <Loader2 size={12} className="spin-icon" color="#4D9EFF" />
            <span style={{ fontSize: '11px', color: '#4D9EFF', fontWeight: 500, letterSpacing: '-0.01em' }}>
              Transcribing
            </span>
          </>
        )}

        {state === 'done' && (
          <>
            <Check size={12} color="#34C759" strokeWidth={3} />
            <span style={{ fontSize: '11px', color: '#E5E5EA', fontWeight: 600 }}>
              {wordCount} words
            </span>
            <span style={{ fontSize: '10px', color: '#8E8E93', fontFamily: 'var(--font-mono)' }}>
              {wpm} WPM
            </span>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle size={12} color="#FF453A" strokeWidth={2.5} />
            <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 600 }}>
              Mic blocked
            </span>
          </>
        )}
      </div>

      <style>{`
        @property --actual-beam-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        @keyframes actual-rotate-beam {
          0% { --actual-beam-angle: 0deg; }
          100% { --actual-beam-angle: 360deg; }
        }

        .actual-pill-edge-beam {
          position: absolute;
          inset: -1.6px;
          border-radius: 9999px;
          pointer-events: none;
          z-index: 0;
          padding: 1.6px;
          background: conic-gradient(
            from var(--actual-beam-angle, 0deg),
            transparent 50%,
            rgba(255, 213, 5, 0.2) 72%,
            rgba(255, 213, 5, 0.95) 92%,
            #ffffff 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          animation: actual-rotate-beam 2.2s linear infinite;
        }

        .spin-icon {
          animation: spin 0.8s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .actual-pill-edge-beam {
            display: none !important;
          }
          .spin-icon {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
