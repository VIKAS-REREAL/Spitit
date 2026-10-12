import { Shield } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { APP_CONFIG } from '../config';
import { DocId } from './DocModal';

interface FooterProps {
  onOpenDoc: (docId: DocId) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenDoc }) => {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(8, 8, 12, 0.95)',
      padding: '70px 0 40px 0',
      position: 'relative',
      zIndex: 10
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
          marginBottom: '50px'
        }}>
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <img src="/favicon.svg" alt="Spitit Logo" style={{ width: '24px', height: '24px' }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                Spitit <span style={{ color: 'var(--accent-yellow)', fontSize: '12px' }}>v3</span>
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '20px' }}>
              {APP_CONFIG.subtitle}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href={APP_CONFIG.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <GithubIcon size={15} />
                <span>GitHub</span>
              </a>
              <a
                href={APP_CONFIG.discussionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <span>Discussions</span>
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: '16px' }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li><a href="#demo" style={{ transition: 'color 120ms' }}>Interactive Demo</a></li>
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#languages">Hinglish &amp; Languages</a></li>
              <li><a href="#download">Downloads (Installer &amp; Portable)</a></li>
              <li><button onClick={() => onOpenDoc('docs')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>User Guide &amp; Troubleshooting</button></li>
              <li><button onClick={() => onOpenDoc('roadmap')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Roadmap</button></li>
            </ul>
          </div>

          {/* Open Source & Community */}
          <div>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: '16px' }}>
              Community
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li><a href={APP_CONFIG.repoUrl} target="_blank" rel="noopener noreferrer">Source Code</a></li>
              <li><a href={APP_CONFIG.releasesUrl} target="_blank" rel="noopener noreferrer">Releases &amp; Checksums</a></li>
              <li><button onClick={() => onOpenDoc('contributing')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Contributing Guide (DCO)</button></li>
              <li><button onClick={() => onOpenDoc('changelog')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Changelog (Keep a Changelog)</button></li>
              <li><a href={APP_CONFIG.discussionsUrl} target="_blank" rel="noopener noreferrer">Community Q&amp;A</a></li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div>
            <h4 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', marginBottom: '16px' }}>
              Trust &amp; Legal
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <li><button onClick={() => onOpenDoc('privacy')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Privacy Policy</button></li>
              <li><button onClick={() => onOpenDoc('terms')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Terms of Use</button></li>
              <li><button onClick={() => onOpenDoc('license')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>MIT License &amp; Notices</button></li>
              <li><button onClick={() => onOpenDoc('trademark')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Trademark Guidelines</button></li>
              <li><button onClick={() => onOpenDoc('security')} style={{ color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>Security &amp; Advisories</button></li>
            </ul>
          </div>
        </div>

        {/* Disclaimers & Copyright */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-faint)',
          lineHeight: 1.6
        }}>
          <p>
            <strong>Disclaimer:</strong> Spitit is an independent open-source client software project. Spitit is not affiliated with, sponsored by, or endorsed by Groq Inc., OpenAI OpCo, LLC, or Microsoft Corporation. &ldquo;Groq&rdquo;, &ldquo;Whisper&rdquo;, &ldquo;Windows&rdquo;, and &ldquo;WebView2&rdquo; are trademarks of their respective owners.
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            color: 'var(--text-muted)',
            paddingTop: '6px'
          }}>
            <div>
              Copyright &copy; 2026 {APP_CONFIG.author}. Licensed under the <a href="#license" onClick={() => onOpenDoc('license')} style={{ color: 'var(--accent-yellow)', textDecoration: 'underline' }}>MIT License</a>.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <Shield size={13} color="var(--status-green)" />
              <span>Zero tracking cookies • Zero telemetry servers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
