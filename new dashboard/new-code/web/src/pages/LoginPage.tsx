import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/ui/Logo';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '../lib/zenAnimations';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // MOCK LOGIN FOR DEMO
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your credentials.');
      return;
    }

    setLoading(true);
    
    // DEMO BYPASS: Since there are no real Supabase credentials, we simulate a login.
    setTimeout(() => {
      // Force navigation to dashboard for the demo.
      localStorage.setItem('demo_session', 'true');
      window.location.href = '/dashboard';
    }, 800);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '48px',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-input)',
    padding: '0 16px',
    fontSize: 14,
    color: 'var(--color-gray-900)',
    background: 'var(--color-surface-alt)',
    transition: 'border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out), background 0.2s var(--ease-out)',
    boxSizing: 'border-box',
    letterSpacing: '0.01em',
    fontFamily: 'var(--font-body)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 500,
    fontSize: 12,
    color: 'var(--color-gray-500)',
    marginBottom: 8,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  };

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransitionConfig}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-page-bg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Warm Ambient Background Orbs */}
      <div 
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(196,149,106,0.12) 0%, transparent 60%)',
          opacity: 0.8,
          filter: 'blur(80px)',
          pointerEvents: 'none'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-5%',
          width: '40vw',
          height: '40vw',
          background: 'radial-gradient(circle, rgba(139,152,108,0.1) 0%, transparent 60%)',
          opacity: 0.7,
          filter: 'blur(80px)',
          pointerEvents: 'none'
        }}
      />
      {/* Subtle warm accent orb top-right */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '15%',
          width: '25vw',
          height: '25vw',
          background: 'radial-gradient(circle, rgba(207,176,148,0.1) 0%, transparent 60%)',
          opacity: 0.6,
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }}
      />

      {/* Decorative organic shape band — inspired by reference image */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: 800,
          height: 120,
          pointerEvents: 'none',
          opacity: 0.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Abstract organic circles */}
        {[
          { size: 60, bg: 'rgba(196,149,106,0.3)', left: '5%' },
          { size: 45, bg: 'rgba(178,131,90,0.25)', left: '20%' },
          { size: 70, bg: 'rgba(139,152,108,0.2)', left: '40%' },
          { size: 50, bg: 'rgba(207,176,148,0.3)', left: '60%' },
          { size: 55, bg: 'rgba(196,149,106,0.2)', left: '75%' },
          { size: 40, bg: 'rgba(168,123,82,0.25)', left: '90%' },
        ].map((shape, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: shape.left,
              width: shape.size,
              height: shape.size,
              borderRadius: '50%',
              background: shape.bg,
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '48px 40px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-xl), 0 0 0 1px var(--border-color)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <Logo size="lg" />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--color-gray-900)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--color-gray-500)',
              lineHeight: 1.5,
            }}
          >
            Sign in to access your AltLeads workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="input-brand-focus"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <label style={labelStyle} htmlFor="password">
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.01em' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="input-brand-focus"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 14,
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-gray-400)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                color: 'var(--color-danger)',
                background: 'rgba(196, 77, 77, 0.06)',
                border: '1px solid rgba(196, 77, 77, 0.15)',
                borderRadius: 'var(--radius-input)',
                padding: '10px 14px',
                textAlign: 'center'
              }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              background: loading ? 'var(--color-gray-300)' : 'var(--color-brand)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              padding: '0',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
              boxShadow: '0 4px 14px rgba(26, 126, 232, 0.3)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.01em',
              transition: 'background 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out)',
            }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Authenticating...' : 'Sign In'}
          </motion.button>
        </form>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-gray-400)' }}>
            <Link to="/sales/login" style={{ color: 'var(--color-gray-500)', textDecoration: 'none', transition: 'color 0.2s' }}>
              Switch to Sales Portal
            </Link>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
