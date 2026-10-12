import React, { useState } from 'react';
import { ArrowRight, Sparkles, Mic, CheckCircle2 } from 'lucide-react';

interface LanguageScenario {
  id: string;
  name: string;
  tagline: string;
  spokenAudio: string;
  rawWhisper: string;
  polishedOutput: string;
  notes: string;
}

const SCENARIOS: LanguageScenario[] = [
  {
    id: 'hinglish',
    name: 'Hinglish (Roman Transliteration)',
    tagline: 'Our Core Differentiator',
    spokenAudio: '“yaar kal production deployment kab hai please timing confirm kardo”',
    rawWhisper: 'yar kal production deployment kab he plz timing konfirm krdo',
    polishedOutput: 'Yaar, kal production deployment kab hai? Please timing confirm kar do.',
    notes: 'Normalizes informal phonetics and colloquial abbreviations into clean Roman Hinglish.'
  },
  {
    id: 'english',
    name: 'English',
    tagline: 'Standard Native Speed',
    spokenAudio: '“can you verify the low level hook latencies across windows 10 and 11”',
    rawWhisper: 'can you verify the low level hook latencies across windows 10 and 11',
    polishedOutput: 'Can you verify the low-level hook latencies across Windows 10 and 11?',
    notes: 'Direct Whisper Turbo inference with automatic punctuation and capitalization.'
  },
  {
    id: 'hindi',
    name: 'Hindi (Devanagari)',
    tagline: 'Pure Devanagari Script',
    spokenAudio: '“कृपया आज शाम की समीक्षा बैठक का समय तय करें”',
    rawWhisper: 'कृपया आज शाम की समीक्षा बैठक का समय तय करें',
    polishedOutput: 'कृपया आज शाम की समीक्षा बैठक का समय तय करें।',
    notes: 'Native Devanagari unicode transcription powered by Whisper Turbo.'
  },
  {
    id: 'mixed',
    name: 'Code-Mixed Speech',
    tagline: 'Bilingual Technical Chat',
    spokenAudio: '“main function mein mutex lock add karke run karo to avoid race conditions”',
    rawWhisper: 'main function me mutex lock add krke run kro to avoid race conditions',
    polishedOutput: 'Main function mein mutex lock add karke run karo to avoid race conditions.',
    notes: 'Keeps English programming terms intact while naturally transliterating Hindi conversational syntax.'
  }
];

export const HinglishShowcase: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<LanguageScenario>(SCENARIOS[0]);

  return (
    <section id="languages" className="section-padding" style={{ position: 'relative', background: 'rgba(14, 14, 18, 0.4)' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> Intelligent Transliteration
          </span>
          <h2 className="section-title">Built for Modern Bilingual Speech</h2>
          <p className="section-desc">
            Most voice tools mangle casual Hinglish or force it into Devanagari script. Spitit cleans messy conversational speech into polished Roman transliteration.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '40px'
        }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveScenario(s)}
              className="glass-card"
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: activeScenario.id === s.id ? 600 : 500,
                color: activeScenario.id === s.id ? '#0b0b0e' : 'var(--text-muted)',
                background: activeScenario.id === s.id ? 'var(--accent-yellow)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: activeScenario.id === s.id ? 'var(--accent-yellow)' : 'var(--border-subtle)',
                transition: 'all 140ms ease',
                cursor: 'pointer'
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Staged Pipeline Visualization Card */}
        <div
          className="glass-card"
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            padding: '36px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
            alignItems: 'stretch'
          }}>
            {/* Stage 1: Spoken Audio */}
            <div style={{
              background: 'rgba(10, 10, 14, 0.7)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'var(--accent-yellow-dim)',
                    color: 'var(--accent-yellow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Mic size={14} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Stage 1 • Spoken Voice
                  </span>
                </div>
                <p style={{ fontSize: '15px', color: '#ffffff', fontStyle: 'italic', lineHeight: 1.6 }}>
                  {activeScenario.spokenAudio}
                </p>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '20px' }}>
                WASAPI 16 kHz Mono In-Memory
              </div>
            </div>

            {/* Stage 2: Raw Phonetic Inference */}
            <div style={{
              background: 'rgba(10, 10, 14, 0.7)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(77, 158, 255, 0.15)',
                    color: 'var(--status-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ArrowRight size={14} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Stage 2 • Whisper Raw Output
                  </span>
                </div>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {activeScenario.rawWhisper}
                </p>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--status-blue)', marginTop: '20px' }}>
                Groq Whisper Turbo (~280ms)
              </div>
            </div>

            {/* Stage 3: Polished Hinglish Output */}
            <div style={{
              background: 'rgba(18, 18, 24, 0.95)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 8px 30px rgba(255, 213, 5, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(61, 220, 132, 0.15)',
                    color: 'var(--status-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={15} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--status-green)' }}>
                    Stage 3 • Final Auto-Paste
                  </span>
                </div>
                <p style={{ fontSize: '16px', color: '#ffffff', fontWeight: 600, lineHeight: 1.6 }}>
                  &ldquo;{activeScenario.polishedOutput}&rdquo;
                </p>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--accent-yellow)', marginTop: '20px', fontWeight: 500 }}>
                {activeScenario.notes}
              </div>
            </div>
          </div>
        </div>

        {/* Universal Whisper Languages Note */}
        <div style={{
          textAlign: 'center',
          marginTop: '36px',
          fontSize: '14px',
          color: 'var(--text-muted)'
        }}>
          Also supports <strong style={{ color: '#fff' }}>90+ global languages</strong> powered by Whisper (Spanish, French, German, Japanese, Mandarin, etc.) with automatic language detection.
        </div>
      </div>
    </section>
  );
};
