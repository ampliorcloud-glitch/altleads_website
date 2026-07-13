import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Sparkles, Sun, Moon, ChevronLeft, ChevronRight, Plus, Minus, LayoutGrid } from 'lucide-react';

export const THEME_PRESETS = [
  { name: 'Pearl', bg: '#101010', accent: '#E8E8E8', secondary: '#B0B0B0', grad: 'linear-gradient(135deg, #FFF 0%, #D4D4D4 100%)' },
  { name: 'Rose', bg: '#120B0D', accent: '#EAA9BA', secondary: '#C88597', grad: 'linear-gradient(135deg, #FAD6E2 0%, #D295A7 100%)' },
  { name: 'Lavender', bg: '#0D0B12', accent: '#D1ACD7', secondary: '#9B7A9F', grad: 'linear-gradient(135deg, #E6C8EA 0%, #B68DBA 100%)' },
  { name: 'Pink', bg: '#120A0B', accent: '#E88B97', secondary: '#B85863', grad: 'linear-gradient(135deg, #F8B3BD 0%, #D26C78 100%)' },
  { name: 'Salmon', bg: '#140C0A', accent: '#E28C73', secondary: '#B55D47', grad: 'linear-gradient(135deg, #F2A892 0%, #C86C52 100%)' },
  { name: 'Olive', bg: '#0E120A', accent: '#B7C263', secondary: '#8A9536', grad: 'linear-gradient(135deg, #D4DD8B 0%, #9DA843 100%)' },
  { name: 'Aqua', bg: '#081112', accent: '#62D4C3', secondary: '#33A897', grad: 'linear-gradient(135deg, #9AECE0 0%, #46BCA9 100%)' },
  { name: 'Steel', bg: '#0B0D12', accent: '#7288A2', secondary: '#4A5F75', grad: 'linear-gradient(135deg, #98B0CB 0%, #5C718A 100%)' },
];

export function ThemeEditor() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTheme, setActiveTheme] = useState(THEME_PRESETS[3]); // Pink by default
  const [roughness, setRoughness] = useState(0.8); // High default for the gritty look
  const [glowIntensity, setGlowIntensity] = useState(0.4); 
  
  const knobRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Apply CSS Variables to document root
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-bg', activeTheme.bg);
    document.documentElement.style.setProperty('--theme-accent', activeTheme.accent);
    document.documentElement.style.setProperty('--theme-secondary', activeTheme.secondary);
    document.documentElement.style.setProperty('--theme-noise', roughness.toString());
    document.documentElement.style.setProperty('--theme-glow', glowIntensity.toString());
  }, [activeTheme, roughness, glowIntensity]);

  // Handle Knob Rotation
  const handleKnobDrag = (event: any, info: any) => {
    const deltaY = -info.delta.y; 
    setRoughness(prev => Math.min(Math.max(prev + deltaY * 0.01, 0), 1));
  };

  const handleSliderDrag = (event: any, info: any) => {
    const deltaX = info.delta.x;
    setGlowIntensity(prev => Math.min(Math.max(prev + deltaX * 0.01, 0), 1));
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      dragControls={dragControls}
      dragListener={false} 
      className="fixed z-[100] left-8 top-1/4 w-[320px] rounded-3xl overflow-hidden font-sans shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      style={{ 
        background: '#151515', 
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Background Dot Grid for the whole panel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #FFF 1px, transparent 0)', backgroundSize: '16px 16px', backgroundPosition: 'center' }} />

      {/* Top Bar / Drag Handle */}
      <div 
        className="h-14 w-full flex items-center justify-between px-6 cursor-grab active:cursor-grabbing relative z-10"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex-1" />
        <div className="flex items-center gap-6 text-[#888]">
          <Sparkles size={16} className="hover:text-white transition-colors cursor-pointer" />
          <Sun size={16} className="hover:text-white transition-colors cursor-pointer" />
          <div className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center cursor-pointer">
            <Moon size={16} className="text-white" />
          </div>
        </div>
        <div className="flex-1 flex justify-end gap-1">
          <div className="w-1 h-1 rounded-full bg-[#555]" />
          <div className="w-1 h-1 rounded-full bg-[#555]" />
          <div className="w-1 h-1 rounded-full bg-[#555]" />
        </div>
      </div>

      <div className="px-6 pb-6 pt-2 flex flex-col gap-6 relative z-10">
        
        {/* Map Area */}
        <div className="w-full h-[220px] relative flex items-center justify-center">
          {/* Floating Theme Orbs */}
          <motion.div 
            className="absolute top-[20%] left-[30%] w-8 h-8 rounded-full border-[3px] border-white"
            style={{ backgroundColor: activeTheme.secondary, boxShadow: '0 0 10px rgba(0,0,0,0.3)' }}
            animate={{ y: [0, -6, 0], x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute top-[25%] right-[35%] w-7 h-7 rounded-full border-[3px] border-white"
            style={{ backgroundColor: activeTheme.accent, boxShadow: '0 0 10px rgba(0,0,0,0.3)' }}
            animate={{ y: [0, 6, 0], x: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
          />
          <motion.div 
            className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-[4px] border-white"
            style={{ backgroundColor: activeTheme.accent, boxShadow: '0 0 15px rgba(0,0,0,0.3)' }}
            animate={{ y: [0, -4, 0], scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 0.5 }}
          />

          {/* Map Controls */}
          <div className="absolute bottom-0 w-full flex justify-center gap-8 text-[#555]">
            <Plus size={16} className="hover:text-white cursor-pointer transition-colors" />
            <Minus size={16} className="hover:text-white cursor-pointer transition-colors" />
            <LayoutGrid size={16} className="hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>

        {/* Color Swatches */}
        <div className="flex items-center gap-3 w-full bg-[#111] p-3 rounded-2xl border border-white/5 shadow-inner mt-4">
          <ChevronLeft size={16} className="text-[#555] cursor-pointer hover:text-white shrink-0" />
          <div className="flex-1 flex justify-between items-center px-1">
            {THEME_PRESETS.map((theme, i) => (
              <div 
                key={i}
                onClick={() => setActiveTheme(theme)}
                className={`w-[22px] h-[22px] rounded-full cursor-pointer transition-transform ${activeTheme.name === theme.name ? 'scale-125 ring-[1.5px] ring-white ring-offset-[3px] ring-offset-[#111]' : 'hover:scale-110'}`}
                style={{ 
                  background: theme.grad,
                  boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.4)'
                }}
              />
            ))}
          </div>
          <ChevronRight size={16} className="text-[#555] cursor-pointer hover:text-white shrink-0" />
        </div>

        {/* Sliders & Knobs Row */}
        <div className="flex items-center justify-between gap-6 pt-2">
          
          {/* Wavy Slider (Glow) */}
          <div className="relative flex-1 h-14 flex items-center cursor-ew-resize group">
             {/* Straight groove track */}
             <div className="absolute w-full h-[6px] bg-[#1A1A1A] rounded-full shadow-inner border border-[#222]" />
             
             {/* Thick Wavy SVG Line */}
             <svg width="100%" height="24" viewBox="0 0 160 24" preserveAspectRatio="none" className="absolute left-0 pointer-events-none">
               <path d="M0,12 C10,0 20,24 30,12 C40,0 50,24 60,12 C70,0 80,24 90,12 C100,0 110,24 120,12 C130,0 140,24 150,12 C160,0 170,24 180,12" fill="none" stroke="#777" strokeWidth="4" strokeLinecap="round" />
             </svg>
             
             {/* Thumb */}
             <motion.div 
                drag="x"
                dragConstraints={{ left: 0, right: 160 }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={handleSliderDrag}
                className="w-5 h-10 bg-white rounded-full absolute shadow-md z-10 cursor-grab active:cursor-grabbing border border-white/90"
                style={{ left: `calc(${glowIntensity * 100}% - 10px)` }}
             />
          </div>

          {/* Roughness Knob */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center relative shrink-0">
             {/* Dotted Scale */}
             {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
               <div key={deg} className="absolute w-full h-full flex justify-center" style={{ transform: `rotate(${deg}deg)` }}>
                 <div className="w-[3px] h-[3px] bg-[#555] rounded-full -mt-1" />
               </div>
             ))}
             
             {/* Dial */}
             <motion.div 
               drag="y"
               dragConstraints={{ top: 0, bottom: 0 }}
               dragElastic={0}
               onDrag={handleKnobDrag}
               className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] relative cursor-ns-resize"
               style={{ rotate: (roughness * 270) - 135 }} // Maps 0-1 to -135deg to +135deg
             >
                {/* Dash Indicator */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-2.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
             </motion.div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
