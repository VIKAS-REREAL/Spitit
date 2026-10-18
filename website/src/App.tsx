import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { InteractiveHeroStudio } from './components/InteractiveHeroStudio';
import { HowItWorks } from './components/HowItWorks';
import { HinglishShowcase } from './components/HinglishShowcase';
import { SpeedBenchmark } from './components/SpeedBenchmark';
import { FeaturesGrid } from './components/FeaturesGrid';
import { PrivacyDiagram } from './components/PrivacyDiagram';
import { SetupGuide } from './components/SetupGuide';
import { OpenSourceStack } from './components/OpenSourceStack';
import { DownloadSection } from './components/DownloadSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { DocModal, DocId } from './components/DocModal';

export const App: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<DocId | null>(null);

  // Handle URL hash navigation for direct doc routing (e.g. #privacy, #terms)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validDocs: DocId[] = ['docs', 'privacy', 'terms', 'trademark', 'security', 'license', 'changelog', 'contributing', 'roadmap'];
      if (validDocs.includes(hash as DocId)) {
        setActiveDoc(hash as DocId);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenDoc = (id: string) => {
    setActiveDoc(id as DocId);
    window.location.hash = id;
  };

  const handleCloseDoc = () => {
    setActiveDoc(null);
    // Reset hash without scrolling
    history.pushState('', document.title, window.location.pathname + window.location.search);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onOpenDoc={handleOpenDoc} />
      
      <main style={{ flex: 1 }}>
        <InteractiveHeroStudio />
        <HowItWorks />
        <HinglishShowcase />
        <SpeedBenchmark />
        <FeaturesGrid />
        <PrivacyDiagram onOpenPrivacyDoc={() => handleOpenDoc('privacy')} />
        <SetupGuide />
        <OpenSourceStack onOpenDoc={handleOpenDoc} />
        <DownloadSection />
        <FaqSection />
      </main>

      <Footer onOpenDoc={handleOpenDoc} />

      {/* Global Document & Policy Modal */}
      <DocModal
        activeDoc={activeDoc}
        onClose={handleCloseDoc}
        onSelectDoc={(id) => handleOpenDoc(id)}
      />
    </div>
  );
};

export default App;
