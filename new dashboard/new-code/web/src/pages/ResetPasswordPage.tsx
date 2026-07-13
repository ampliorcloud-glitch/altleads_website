import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/ui/Logo';

/**
 * Self-service password recovery — step 2 (ALT-197).
 *
 * This is the landing page the reset-link points at. Supabase establishes a
 * temporary recovery session from the link, so the user can set a new password
 * here without re-entering their old one. We validate non-empty / min-8 / match
 * before calling updateUser.
 */
export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirm) {
      setError('Please fill in both password fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const msg = updateError.message.toLowerCase();
        if (msg.includes('session') || msg.includes('expired') || msg.includes('jwt')) {
          setError(
            'Your reset link has expired or is invalid. Please request a new one from the sign-in page.',
          );
        } else if (msg.includes('should be different') || msg.includes('same as')) {
          setError('Please choose a password different from your current one.');
        } else {
          setError('We could not update your password. Please try again.');
        }
        return;
      }

      setDone(true);
      // Sign out the temporary recovery session so the user lands cleanly on login.
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-input)',
    padding: '10px 40px 10px 12px',
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

  const toggleStyle: React.CSSProperties = {
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

        {done ? (
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
              Password updated
            </h1>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--color-gray-500)',
              }}
            >
              Your password has been changed. You can now sign in with your new password.
            </p>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              style={{
                width: '100%',
                background: 'var(--color-brand)',
                color: '#fff',
                fontWeight: 500,
                fontSize: 14,
                padding: '11px 0',
                borderRadius: 'var(--radius-btn)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)';
              }}
            >
              Go to sign in
            </button>

            <p style={{ marginTop: 20, marginBottom: 0, textAlign: 'center' }}>
              <Link to="/login" style={backLinkStyle}>
                Sign in
              </Link>
            </p>
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
              Set a new password
            </h1>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--color-gray-500)',
              }}
            >
              Choose a new password for your account. It must be at least 8 characters.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <label style={labelStyle} htmlFor="new-password">
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="input-brand-focus"
                    style={inputStyle}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'reset-error' : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    style={toggleStyle}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="confirm-password">
                  Confirm new password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="input-brand-focus"
                    style={inputStyle}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'reset-error' : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm((v) => !v)}
                    style={toggleStyle}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  id="reset-error"
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
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Updating...' : 'Update password'}
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
