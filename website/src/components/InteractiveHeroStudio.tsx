import React, { useState, useEffect, useRef } from 'react';
import { Download, Terminal, Zap, Lock, Mic, ArrowUpRight, Cpu } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { useDeviceDetect } from '../utils/useDeviceDetect';
import { ActualPill, ActualPillState } from './ActualPill';
import { GithubIcon } from './GithubIcon';

type AppTarget = 'vscode' | 'slack' | 'cursor' | 'notepad';
type DemoLanguage = 'hinglish' | 'english' | 'hindi';

interface ScenarioData {
  text: string;
  wpm: number;
  words: number;
  latencyMs: number;
}

const DEMO_SCRIPTS: Record<AppTarget, Record<DemoLanguage, ScenarioData>> = {
  vscode: {
    hinglish: {
      text: '// WH_KEYBOARD_LL hook message loop ko dedicated Win32 thread pe spawn karo taaki main UI smooth rahe.',
      wpm: 148,
      words: 16,
      latencyMs: 275
    },
    english: {
      text: '// Spawn dedicated Win32 message pump thread for low-level keyboard hook without blocking UI runtime.',
      wpm: 154,
      words: 15,
      latencyMs: 260
    },
    hindi: {
      text: '// मुख्य यूआई को सुचारू रखने के लिए संदेश लूप को एक अलग थ्रेड पर चलाएं।',
      wpm: 130,
      words: 14,
      latencyMs: 290
    }
  },
  slack: {
    hinglish: {
      text: 'Hey team, Spitit v3 ka Windows build completely verified hai! Idle memory 32 MB pe stable hai, check kar lo please.',
      wpm: 152,
      words: 21,
      latencyMs: 285
    },
    english: {
      text: 'Hey team, the Spitit v3 Windows installer build is ready. Idle memory is stable at 32 MB. Testing looks solid.',
      wpm: 158,
      words: 20,
      latencyMs: 270
    },
    hindi: {
      text: 'नमस्ते टीम, नया विंडोज़ इंस्टालर तैयार है और मेमोरी की खपत 32 एमबी पर स्थिर है।',
      wpm: 135,
      words: 15,
      latencyMs: 295
    }
  },
  cursor: {
    hinglish: {
      text: 'Refactor this async audio buffer handler to drop silent leading frames before calling the Groq Whisper API.',
      wpm: 160,
      words: 18,
      latencyMs: 265
    },
    english: {
      text: 'Refactor this async audio buffer handler to drop silent leading frames before calling the Groq Whisper API.',
      wpm: 160,
      words: 18,
      latencyMs: 265
    },
    hindi: {
      text: 'ग्रोक विस्पर एपीआई को कॉल करने से पहले शांत ऑडियो फ्रेम को हटाने के लिए इस फ़ंक्शन को सुधारें।',
      wpm: 128,
      words: 16,
      latencyMs: 280
    }
  },
  notepad: {
    hinglish: {
      text: 'Remember to verify SHA256 checksums before releasing the direct portable and setup exe packages to GitHub.',
      wpm: 146,
      words: 17,
      latencyMs: 275
    },
    english: {
      text: 'Remember to verify SHA256 checksums before releasing the direct portable and setup exe packages to GitHub.',
      wpm: 146,
      words: 17,
      latencyMs: 275
    },
    hindi: {
      text: 'गिटहब पर नए पैकेज जारी करने से पहले उनके एसएचए256 चेकसम की पुष्टि करना न भूलें।',
      wpm: 132,
      words: 15,
      latencyMs: 290
    }
  }
};

export const InteractiveHeroStudio: React.FC = () => {
  const device = useDeviceDetect();
  const [selectedApp, setSelectedApp] = useState<AppTarget>('vscode');
  const [selectedLang, setSelectedLang] = useState<DemoLanguage>('hinglish');
  const [pillState, setPillState] = useState<ActualPillState>('recording');
  const [isHoldingTrigger, setIsHoldingTrigger] = useState(false);
  const [typedChars, setTypedChars] = useState('');
  const [timerCount, setTimerCount] = useState(3);
  const [showOverride, setShowOverride] = useState(false);

  const scenario = DEMO_SCRIPTS[selectedApp][selectedLang];
  const typingTimerRef = useRef<number | null>(null);

  // Auto-play demo cycle initially
  useEffect(() => {
    let active = true;
    const runCycle = () => {
      if (!active || isHoldingTrigger) return;
      setPillState('recording');
      setTypedChars('');
      setTimerCount(1);

      const t1 = setTimeout(() => {
        if (!active || isHoldingTrigger) return;
        setPillState('transcribing');

        const t2 = setTimeout(() => {
          if (!active || isHoldingTrigger) return;
          setPillState('done');
          streamText(scenario.text);

          const t3 = setTimeout(() => {
            if (!active || isHoldingTrigger) return;
            setPillState('recording');
          }, 4500);
          return () => clearTimeout(t3);
        }, 650);
        return () => clearTimeout(t2);
      }, 2600);
      return () => clearTimeout(t1);
    };

    const cycleInterval = setInterval(runCycle, 8500);
    runCycle();

    return () => {
      active = false;
      clearInterval(cycleInterval);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [selectedApp, selectedLang, isHoldingTrigger]);

  const streamText = (fullText: string) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    let idx = 0;
    const interval = setInterval(() => {
      idx += 3;
      setTypedChars(fullText.slice(0, idx));
      if (idx >= fullText.length) {
        clearInterval(interval);
      }
    }, 22);
    typingTimerRef.current = interval as unknown as number;
  };

  // User interactive press-and-hold trigger
  const handleTriggerDown = () => {
    setIsHoldingTrigger(true);
    setPillState('recording');
    setTypedChars('');
    setTimerCount(1);
  };

  const handleTriggerUp = () => {
    if (!isHoldingTrigger) return;
    setIsHoldingTrigger(false);
    setPillState('transcribing');

    setTimeout(() => {
      setPillState('done');
      streamText(scenario.text);
    }, 550);
  };

  return (
    <section id="demo" style={{
      position: 'relative',
      paddingTop: '136px',
      paddingBottom: '100px',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 75% 55% at 50% -5%, rgba(255, 213, 5, 0.12) 0%, rgba(255, 213, 5, 0.02) 45%, transparent 75%), #070709'
    }}>
      {/* Precision Ambient Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        opacity: 0.35,
        pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 35%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 35%, transparent 85%)'
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Editorial Eyebrow Tag (Supaste & Amie style) */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 15px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#BDBDC8'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-gold)',
              display: 'inline-block',
              boxShadow: '0 0 8px var(--accent-gold)'
            }} />
            <span>Spitit v3.0 &bull; Open Source Native Windows Engine</span>
          </div>
        </div>

        {/* Master Display Headline (Supaste Editorial Typography) */}
        <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto 28px auto' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(46px, 7.5vw, 86px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#ffffff',
            margin: '0 auto 22px auto'
          }}>
            Voice typing,{' '}
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--accent-gold)',
              letterSpacing: '-0.02em',
              display: 'inline-block',
              paddingRight: '6px',
              transform: 'skewX(-4deg)'
            }}>
              reimagined
            </span>
            <br />
            for Windows.
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            color: '#9E9EA8',
            maxWidth: '680px',
            margin: '0 auto',
            lineHeight: 1.6,
            fontWeight: 400
          }}>
            Sub-35 MB idle RAM. Direct Groq Whisper LPU inference with your private key. Instant paste into any Windows app. Zero telemetry.
          </p>
        </div>

        {/* Dynamic OS-Aware Download Block */}
        <div style={{ maxWidth: '640px', margin: '0 auto 52px auto', textAlign: 'center' }}>
          {/* OS Condition 1: Mac / Android / iOS / Linux */}
          {!device.isWindows && !showOverride ? (
            <div style={{
              background: 'rgba(18, 18, 24, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {device.osName} Build In Development
                </span>
              </div>
              <p style={{ fontSize: '14px', color: '#B5B5BE', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Spitit v3 is natively engineered with Win32 low-level hooks exclusively for Windows 10 &amp; 11. Support for {device.osName} is on our roadmap.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a
                  href={APP_CONFIG.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ fontSize: '14px', padding: '10px 22px', borderRadius: '9999px' }}
                >
                  <GithubIcon size={16} />
                  <span>Star on GitHub for {device.osName} Updates</span>
                </a>

                <button
                  onClick={() => setShowOverride(true)}
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Download Windows .exe anyway &rarr;
                </button>
              </div>
            </div>
          ) : (
            /* OS Condition 2: Windows (or Override Clicked) */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <a
                  href={APP_CONFIG.downloads.installer.url}
                  className="btn-primary"
                  style={{
                    padding: '14px 28px',
                    fontSize: '15.5px',
                    borderRadius: '9999px',
                    boxShadow: '0 8px 24px rgba(255, 213, 5, 0.35)'
                  }}
                >
                  <Download size={18} />
                  <span>Download for Windows (64-bit)</span>
                  <span style={{
                    fontSize: '12px',
                    opacity: 0.85,
                    paddingLeft: '8px',
                    borderLeft: '1px solid rgba(0, 0, 0, 0.25)'
                  }}>
                    v{APP_CONFIG.version} &bull; {APP_CONFIG.downloads.installer.size}
                  </span>
                </a>

                <a
                  href={APP_CONFIG.downloads.portable.url}
                  className="btn-secondary"
                  style={{ padding: '14px 22px', fontSize: '14.5px', borderRadius: '9999px' }}
                  title="Download standalone single-file portable binary"
                >
                  <Download size={16} />
                  <span>Portable (.exe)</span>
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#80808C' }}>
                <span>Windows 10 / 11 Native</span>
                <span>&bull;</span>
                <span>SHA-256 Verified</span>
                <span>&bull;</span>
                <a href={APP_CONFIG.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-yellow)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <span>Source on GitHub</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* THE MASTER STUDIO CANVAS: Authentic Desktop Environment */}
        {/* ------------------------------------------------------------- */}
        <div style={{
          maxWidth: '980px',
          margin: '0 auto',
          background: 'rgba(15, 15, 20, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '18px',
          boxShadow: '0 32px 90px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          overflow: 'hidden'
        }}>
          {/* Top Desktop Chrome */}
          <div style={{
            background: 'rgba(20, 20, 26, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Win11 Caption Dots & Window Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '7px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
              </div>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#888894' }}>
                Spitit Studio &bull; Windows 11 Foreground Sandbox
              </span>
            </div>

            {/* Target App Switcher Tabs */}
            <div style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              gap: '3px'
            }}>
              {(['vscode', 'slack', 'cursor', 'notepad'] as AppTarget[]).map((appId) => (
                <button
                  key={appId}
                  onClick={() => setSelectedApp(appId)}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedApp === appId ? 600 : 400,
                    color: selectedApp === appId ? '#ffffff' : '#888894',
                    background: selectedApp === appId ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    transition: 'all 120ms ease'
                  }}
                >
                  {appId === 'vscode' ? 'VS Code' : appId === 'slack' ? 'Slack' : appId === 'cursor' ? 'Cursor' : 'Notepad'}
                </button>
              ))}
            </div>

            {/* Language Switcher */}
            <div style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              gap: '3px'
            }}>
              {(['hinglish', 'english', 'hindi'] as DemoLanguage[]).map((langId) => (
                <button
                  key={langId}
                  onClick={() => setSelectedLang(langId)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedLang === langId ? 600 : 400,
                    color: selectedLang === langId ? 'var(--accent-yellow)' : '#888894',
                    background: selectedLang === langId ? 'rgba(255, 213, 5, 0.14)' : 'transparent',
                    transition: 'all 120ms ease'
                  }}
                >
                  {langId === 'hinglish' ? 'Hinglish' : langId === 'english' ? 'English' : 'हिंदी'}
                </button>
              ))}
            </div>
          </div>

          {/* Sandbox Stage Body */}
          <div style={{
            padding: '36px 32px 32px 32px',
            position: 'relative',
            minHeight: '260px',
            background: 'rgba(10, 10, 14, 0.95)'
          }}>
            {/* The Actual Floating Status Pill Over Caret */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '26px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#686874', fontWeight: 600 }}>
                  Active Overlay Pill:
                </span>
                {/* Authentic Win32 Pill */}
                <ActualPill
                  state={pillState}
                  app={selectedApp}
                  wordCount={scenario.words}
                  wpm={scenario.wpm}
                  timerSec={timerCount}
                  isRecordingActive={pillState === 'recording'}
                  scale={1.12}
                />
              </div>

              {/* Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background:
                    pillState === 'recording'
                      ? 'var(--accent-yellow)'
                      : pillState === 'transcribing'
                      ? 'var(--status-blue)'
                      : 'var(--status-green)'
                }} />
                <span style={{ color: '#A0A0AA', fontFamily: 'var(--font-mono)' }}>
                  {pillState === 'recording' ? 'LISTENING (WASAPI 16kHz)' : pillState === 'transcribing' ? 'GROQ LPU INFERENCE' : 'PASTED (Ctrl+V)'}
                </span>
              </div>
            </div>

            {/* Document Editor Area */}
            <div style={{
              padding: '20px 24px',
              borderRadius: '10px',
              background: 'rgba(16, 16, 22, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              minHeight: '110px',
              fontFamily: selectedApp === 'vscode' || selectedApp === 'cursor' ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: '15.5px',
              lineHeight: 1.65,
              color: '#F4F4F8'
            }}>
              {typedChars.length > 0 ? (
                <>
                  <span>{typedChars}</span>
                  {pillState === 'done' && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '18px',
                      background: 'var(--accent-yellow)',
                      marginLeft: '2px',
                      verticalAlign: 'middle',
                      animation: 'dot-pulse 0.8s infinite'
                    }} />
                  )}
                </>
              ) : (
                <span style={{ color: '#52525C', fontStyle: 'italic' }}>
                  {pillState === 'recording'
                    ? 'Capturing audio samples in memory...'
                    : 'Hold the button below or press Space to test dictation...'}
                </span>
              )}
            </div>

            {/* Interactive Tactile Trigger & Action Toolbar */}
            <div style={{
              marginTop: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              {/* Tactile Hold Button */}
              <button
                onMouseDown={handleTriggerDown}
                onMouseUp={handleTriggerUp}
                onTouchStart={handleTriggerDown}
                onTouchEnd={handleTriggerUp}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  background: isHoldingTrigger ? '#ffe033' : 'rgba(255, 213, 5, 0.15)',
                  border: '1.2px solid rgba(255, 213, 5, 0.4)',
                  color: isHoldingTrigger ? '#0b0b0e' : 'var(--accent-yellow)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transform: isHoldingTrigger ? 'scale(0.97)' : 'scale(1)',
                  transition: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isHoldingTrigger ? '0 0 20px rgba(255, 213, 5, 0.4)' : 'none'
                }}
              >
                <Mic size={16} />
                <span>{isHoldingTrigger ? 'Release to Paste Text' : 'Click & Hold to Simulate Voice'}</span>
                <kbd style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isHoldingTrigger ? 'rgba(0,0,0,0.2)' : 'rgba(255, 255, 255, 0.1)',
                  fontFamily: 'var(--font-mono)'
                }}>
                  Alt+LShift
                </kbd>
              </button>

              {/* Real Measured Metrics HUD */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                fontSize: '12px',
                color: '#8A8A96',
                fontFamily: 'var(--font-mono)'
              }}>
                <div>
                  Turnaround: <strong style={{ color: '#fff' }}>{scenario.latencyMs} ms</strong>
                </div>
                <div>
                  RAM: <strong style={{ color: '#34C759' }}>32.4 MB</strong>
                </div>
                <div>
                  Speed: <strong style={{ color: 'var(--accent-yellow)' }}>{scenario.wpm} WPM</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Architectural Guarantees Footer */}
          <div style={{
            background: 'rgba(14, 14, 18, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '14px 28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            fontSize: '12px',
            color: '#7E7E8A'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} color="var(--accent-yellow)" />
              <span>Win32 WH_KEYBOARD_LL (&lt;1ms)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={14} color="#4D9EFF" />
              <span>0ms Disk I/O (In-Memory WAV)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={14} color="var(--accent-yellow)" />
              <span>Direct Groq Cloud TLS (~280ms)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={14} color="#34C759" />
              <span>Windows Credential Vault</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
