import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/ui/Logo';

/**
 * Self-service password recovery — step 1 (ALT-197).
 *
 * Users who mistype their freshly-provisioned password can request a reset
 * link here. For security we ALWAYS show the same neutral confirmation after a
 * submit, never revealing whether an account exists for the entered email.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });

      // We intentionally do not surface "user not found" — only unexpected
      // failures (e.g. network / rate limit) are shown to the user.
      if (resetError) {
        setError('We could not send the reset link right now. Please try again in a moment.');
        return;
      }

      setSent(true);
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

  const backLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-brand)',
    textDecoration: 'none',
    fontWeight: 500,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-page-bg)',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-card)',
          padding: '36px 32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <Logo size="lg" />
        </div>

        {sent ? (
          <>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={22} style={{ color: '#15803D' }} />
            </div>
            <h1
              style={{
                margin: '0 0 6px',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--color-gray-900)',
              }}
            >
              Check your email
            </h1>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--color-gray-500)',
              }}
            >
              If an account exists for that email, we&rsquo;ve sent a reset link. Follow the link to
              choose a new password.
            </p>

            <Link to="/login" style={backLinkStyle}>
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1
              style={{
                margin: '0 0 4px',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--color-gray-900)',
              }}
            >
              Forgot password?
            </h1>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--color-gray-500)',
              }}
            >
              Enter your email address and we&rsquo;ll send you a link to reset your password.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
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
                  if (!loading)
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)';
                }}
                onMouseLeave={(e) => {
                  if (!loading)
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)';
                }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Mail size={14} />
                )}
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p style={{ marginTop: 28, marginBottom: 0 }}>
              <Link to="/login" style={backLinkStyle}>
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
