import React, { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/ui/Logo';

/**
 * Sales Portal sign-in. Same Supabase password auth as the internal LoginPage,
 * but branded "Sales Login" and routes to /sales on success. Visually consistent
 * with LoginPage (shared markup/styles); only copy + the success route differ.
 */
export function SalesLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Hide the branded panel and center the form on narrow screens (<= 880px).
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 880px)').matches : true,
  );
  const navigate = useNavigate();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 880px)');
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    setWide(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (
          signInError.message.toLowerCase().includes('invalid login credentials') ||
          signInError.message.toLowerCase().includes('invalid credentials')
        ) {
          setError('Incorrect email or password. Please try again.');
        } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setError('Your email address has not been confirmed yet.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      // Auth state change triggers AuthProvider update; navigate to the sales home.
      navigate('/sales', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-input)',
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--color-gray-900)',
    background: 'var(--color-surface)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 500,
    fontSize: 12,
    color: 'var(--color-gray-500)',
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--color-page-bg)',
      }}
    >
      {/* LEFT — sign-in form */}
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Wordmark */}
          <div style={{ marginBottom: 36 }}>
            <Logo size="lg" />
          </div>

          <h1
            style={{
              margin: '0 0 4px',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--color-gray-900)',
            }}
          >
            Sales Login
          </h1>
          <p
            style={{
              margin: '0 0 28px',
              fontSize: 13,
              color: 'var(--color-gray-500)',
            }}
          >
            Sign in to the Sales Portal to manage your leads and meetings.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  style={{ fontSize: 12, color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 500 }}
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
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 10,
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-gray-400)',
                    padding: 0,
                    lineHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--color-danger)',
                  background: 'rgba(196,77,77,0.06)',
                  border: '1px solid rgba(196,77,77,0.15)',
                  borderRadius: 'var(--radius-input)',
                  padding: '8px 12px',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'var(--color-gray-300)' : 'var(--color-brand)',
                color: '#fff',
                fontWeight: 500,
                fontSize: 14,
                padding: '11px 0',
                borderRadius: 'var(--radius-btn)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)';
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Submit'}
            </button>
          </form>

          {/* Footer: link across to the internal login */}
          <p
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: 'var(--color-gray-400)',
              marginTop: 28,
            }}
          >
            <Link to="/login" style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>
              Internal staff login
            </Link>
            <span>Altleads Help desk</span>
          </p>
        </div>
      </div>

      {/* RIGHT — branded blue panel (hidden on narrow screens) */}
      {wide && (
        <div
          style={{
            flex: '1 1 50%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px',
            color: '#fff',
            background: 'linear-gradient(135deg, #1A7EE8 0%, #1463B8 55%, #0F4C97 100%)',
          }}
        >
          {/* Subtle decorative shapes */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -120,
              right: -100,
              width: 360,
              height: 360,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -140,
              left: -80,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: '40%',
              right: 120,
              width: 140,
              height: 140,
              borderRadius: 28,
              transform: 'rotate(18deg)',
              background: 'rgba(255,255,255,0.05)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
            {/* White wordmark */}
            <div
              style={{
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                color: '#fff',
                marginBottom: 28,
              }}
            >
              AltLeads
            </div>

            <h2
              style={{
                margin: '0 0 14px',
                fontSize: 30,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              Your leads, meetings, and feedback in one place
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.82)',
              }}
            >
              The Sales Portal gives your field team a focused workspace to work
              their pipeline and report back from the ground.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesLoginPage;
