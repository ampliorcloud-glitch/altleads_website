import { useEffect, useRef } from 'react';

/**
 * Adds the 'visible' class to elements with 'zen-reveal' when they
 * scroll into view. Uses IntersectionObserver for performance.
 *
 * Usage:
 *   const containerRef = useScrollReveal();
 *   <div ref={containerRef}> <div className="zen-reveal">...</div> </div>
 *
 * Or for a single element:
 *   const elRef = useScrollReveal<HTMLDivElement>();
 *   <div ref={elRef} className="zen-reveal">...</div>
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Only animate once
        }
      });
    }, options);

    // If the ref element itself has zen-reveal, observe it
    if (el.classList.contains('zen-reveal')) {
      observer.observe(el);
    }

    // Also observe all zen-reveal children
    const children = el.querySelectorAll('.zen-reveal');
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return ref;
}
