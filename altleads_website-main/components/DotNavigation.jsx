'use client';

import { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'hero', label: 'Start' },
  { id: 'social', label: 'Trust' },
  { id: 'reality', label: 'The Problem' },
  { id: 'os', label: 'OS Overview' },
  { id: 'modules', label: 'Modules' },
  { id: 'differentiator', label: 'Why Us' },
  { id: 'target', label: 'For You' },
  { id: 'friction', label: 'Zero Friction' },
  { id: 'faq', label: 'FAQ' },
  { id: 'demo', label: 'Book Demo' }
];

export default function DotNavigation() {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const sections = document.querySelectorAll('[data-section]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const handleDotClick = (id) => {
    const sectionElement = document.querySelector(`[data-section="${id}"]`);
    if (sectionElement) {
      const container = document.querySelector('.page-content');
      if (container) {
        const top = sectionElement.offsetTop;
        container.scrollTo({ top, behavior: 'smooth' });
      } else {
        sectionElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-4">
      {SECTIONS.map((sec) => {
        const isActive = activeSection === sec.id;
        return (
          <div key={sec.id} className="relative group flex items-center justify-end">
            <span className="absolute right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs font-semibold text-blue-400 bg-black/80 px-2 py-1 rounded whitespace-nowrap backdrop-blur-sm border border-blue-900/30">
              {sec.label}
            </span>
            
            <button
              onClick={() => handleDotClick(sec.id)}
              aria-label={`Scroll to ${sec.label}`}
              className={`w-3 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-center ${
                isActive 
                  ? 'bg-blue-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' 
                  : 'bg-slate-700 hover:bg-slate-500 hover:scale-110'
              }`}
            >
              {isActive && (
                <span className="absolute w-full h-full rounded-full bg-blue-400 animate-ping opacity-40"></span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
