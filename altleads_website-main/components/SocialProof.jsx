'use client';
import { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function SocialProof() {
  const logos = ['Stripe', 'Linear', 'Vercel', 'Notion', 'Figma', 'Rippling', 'Ramp', 'Brex', 'Deel', 'Gusto'];
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Create a dramatic pinning effect for the text
      ScrollTrigger.create({
        trigger: ".dramatic-text-container",
        start: "top center",
        end: "bottom top",
        scrub: 1,
        animation: gsap.to('.dramatic-line', {
          backgroundPositionX: '100%',
          ease: "none",
          stagger: 0.1
        })
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -50]);

  return (
    <div ref={containerRef} data-section="social" className="w-full bg-transparent py-32 md:py-48 relative overflow-hidden flex flex-col justify-center border-t border-black/5">
      
      {/* Massive Dramatic Background Text */}
      <motion.div 
        style={{ scale, y }} 
        className="w-full max-w-7xl mx-auto px-6 mb-24 text-center dramatic-text-container relative z-10"
      >
        <h2 className="text-[4rem] md:text-[7rem] lg:text-[8rem] font-black uppercase tracking-tighter leading-[0.85] text-slate-900 dark:text-white">
          <span className="dramatic-line block text-slate-300 dark:text-slate-600">Built for</span>
          <span className="dramatic-line block text-slate-900 dark:text-white">the way <span className="text-blue-600 italic">India</span></span>
          <span className="dramatic-line block text-slate-400 dark:text-slate-500">&amp; <span className="text-slate-900 dark:text-white">APAC</span> sell.</span>
        </h2>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F5F5F7]/30 to-[#F5F5F7] dark:via-[#050505]/30 dark:to-[#050505] pointer-events-none mt-[20%]" />
      </motion.div>

      {/* Infinite Marquee Layer */}
      <div className="relative w-full z-20 pb-10">
        {/* Edge Gradients for smooth fade out */}
        <div className="absolute top-0 left-0 w-40 h-full bg-gradient-to-r from-[#F5F5F7] dark:from-[#050505] to-transparent z-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-40 h-full bg-gradient-to-l from-[#F5F5F7] dark:from-[#050505] to-transparent z-30 pointer-events-none" />
        
        <div className="flex w-full items-center justify-center">
          <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs shrink-0 pl-10 pr-6 border-r border-black/10 dark:border-white/10 hidden md:block bg-[#F5F5F7]/80 dark:bg-[#050505]/80 backdrop-blur-sm py-2 relative z-40">
            Trusted by high-velocity teams
          </p>
          
          <div className="flex flex-1 overflow-hidden group">
            <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap">
              {[...logos, ...logos, ...logos].map((name, i) => (
                <span 
                  key={`${name}-${i}`} 
                  className="logo-item mx-10 text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-300 uppercase tracking-tighter hover:text-blue-600 transition-colors duration-300 cursor-default drop-shadow-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
          width: max-content;
        }
        .dramatic-line {
          background: linear-gradient(90deg, currentColor 50%, transparent 50%);
          background-size: 200% 100%;
          background-position-x: 0%;
          -webkit-background-clip: text;
          color: transparent;
        }
      `}</style>
    </div>
  )
}
