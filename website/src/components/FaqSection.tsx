import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Is Spitit completely free to use?",
    answer: "Yes. Spitit is 100% free and open-source software under the MIT License. There are no subscriptions, paywalls, or gated features. You bring your own Groq API key, and Groq's generous free tier covers thousands of audio seconds per day with zero cost."
  },
  {
    question: "Do I need to create a Spitit account or log in?",
    answer: "No. Spitit has zero user accounts, zero signups, and zero REREAL servers. You download the app, paste your personal Groq key once into Windows Credential Manager, and begin dictating immediately."
  },
  {
    question: "Where does my audio go when I speak?",
    answer: "Your audio travels over encrypted TLS directly between your PC and Groq Cloud (api.groq.com) using your personal API credentials. It never routes through or touches any Spitit servers. Audio is processed under Groq's privacy terms and is not used to train models."
  },
  {
    question: "Is my Groq API key secure on my computer?",
    answer: "Yes. API keys are encrypted and persisted exclusively within native Windows Credential Manager (via the keyring crate under the 'Spitit' service target). Spitit never stores keys in plaintext, settings files, or local SQLite databases."
  },
  {
    question: "Does Spitit work offline without an internet connection?",
    answer: "No, not in v3.0. Audio is streamed to Groq's cloud LPU to keep Spitit's idle footprint under 35 MB of RAM and eliminate gigabytes of local model downloads. Fully offline, local inference via whisper.cpp / ONNX is on our public roadmap."
  },
  {
    question: "Which languages are supported?",
    answer: "Spitit supports English, Roman Hinglish, Hindi (Devanagari), and over 90+ global languages powered by the OpenAI Whisper Turbo model architecture, including Spanish, German, French, Japanese, and Mandarin."
  },
  {
    question: "Why does Windows SmartScreen display an 'Unknown Publisher' warning?",
    answer: "Spitit is an independent open-source project without an expensive corporate Extended Validation (EV) certificate. Windows SmartScreen displays this prompt for new unsigned releases. To run, click 'More info' and then 'Run anyway'. You can also inspect the source code and build it yourself."
  },
  {
    question: "Does dictation work in administrator windows or video games?",
    answer: "Windows enforces UIPI (User Interface Privilege Isolation), which prevents standard-privilege applications from capturing keyboard hooks or injecting SendInput text into elevated windows. To dictate into elevated applications (like Administrator PowerShell or Task Manager), simply run Spitit as Administrator."
  },
  {
    question: "Can I change the global hotkey and activation mode?",
    answer: "Yes. You can customize your shortcut in Settings and choose between Push-to-Talk (Hold) mode and Toggle mode. Spitit includes a 3-tier validation safety check to prevent accidental binding of normal typing keys."
  },
  {
    question: "How do I uninstall Spitit and wipe all local data?",
    answer: "In Settings -> History & Privacy, click 'Clear History Now'. Open Windows Credential Manager and remove the 'Spitit' credential. Uninstall Spitit via Windows Installed Apps, and optionally delete the %APPDATA%\\com.rereal.spitit directory."
  },
  {
    question: "Is Spitit affiliated with Groq or OpenAI?",
    answer: "No. Spitit is an independent open-source client created by Vikas Nath (REREAL). We are not affiliated with, sponsored by, or endorsed by Groq Inc., OpenAI, or Microsoft Corporation."
  },
  {
    question: "Can I use Spitit commercially or fork the code?",
    answer: "Yes! The MIT License explicitly allows commercial use and community forks. However, under our Trademark Policy, redistributed builds or products must use their own distinct name and logos rather than the 'Spitit' or 'REREAL' brand."
  }
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section-padding" style={{ position: 'relative', background: 'rgba(12, 12, 16, 0.4)' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} /> Clear Answers
          </span>
          <h2 className="section-title">
            Frequently asked{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-gold)' }}>
              questions.
            </span>
          </h2>
          <p className="section-desc">
            Direct, candid answers about privacy, mechanics, keys, and licensing.
          </p>
        </div>

        <div style={{
          maxWidth: '820px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="glass-card"
                style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  borderColor: isOpen ? 'var(--border-highlight)' : 'var(--border-subtle)',
                  transition: 'border-color 160ms ease'
                }}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 600,
                    gap: '16px'
                  }}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp size={18} color="var(--accent-yellow)" style={{ flexShrink: 0 }} />
                  ) : (
                    <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  )}
                </button>

                {isOpen && (
                  <div style={{
                    padding: '0 24px 22px 24px',
                    color: 'var(--text-muted)',
                    fontSize: '14.5px',
                    lineHeight: 1.65,
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    paddingTop: '16px'
                  }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
