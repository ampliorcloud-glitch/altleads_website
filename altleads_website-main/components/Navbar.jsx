'use client';
import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Simple auth check simulation - checks if token exists
    if (localStorage.getItem('auth_token')) {
      setIsLoggedIn(true);
    }
  }, []);

  const logoSrc = mounted && resolvedTheme === 'dark' ? '/logo.png' : '/logo-white.png';

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <Link href="/" className="navbar-logo" aria-label="AltLeads Home" style={{ display: 'flex', alignItems: 'center' }}>
        <Image src={logoSrc} alt="AltLeads" width={120} height={32} className="object-contain" priority />
      </Link>

      <div className="navbar-nav" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
        <Link href="/#how-it-works">How It Works</Link>
        <Link href="/#usecases">Use Cases</Link>
        <Link href="/#faq">FAQ</Link>
        <Link href="/contact">Contact</Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: '1rem' }}>
          <ThemeToggle />
          {!isLoggedIn && (
            <Link href="/login" style={{ color: 'var(--color-text)', fontWeight: 500, fontSize: '0.875rem' }}>Login</Link>
          )}
          <Link href={isLoggedIn ? "/dashboard" : "/contact"} style={{ 
            background: 'var(--color-text)', 
            color: 'var(--color-bg)', 
            padding: '8px 20px', 
            borderRadius: '9999px', 
            fontWeight: 600,
            fontSize: '0.8125rem',
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {isLoggedIn ? "Dashboard" : "Book a Demo"}
          </Link>
        </div>
      </div>

      <button className="nav-toggle" aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>
    </nav>
  )
}
