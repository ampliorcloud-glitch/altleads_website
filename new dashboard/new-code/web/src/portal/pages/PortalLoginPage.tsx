/**
 * Client Portal — LOGIN PAGE.
 *
 * Branded email/password sign-in via supabase.auth.signInWithPassword. On success
 * we navigate to /portal; the guard then confirms the session is an enabled portal
 * user (a non-portal login lands at the guard which bounces back here). This is the
 * portal's OWN login — separate from the CRM LoginPage.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useBrand } from '../brand';

export function PortalLoginPage() {
  const brand = useBrand();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message || 'Sign-in failed. Please check your details.');
      return;
    }

    navigate('/portal', { replace: true });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-page-bg)',
        padding: '24px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: brand.accent, marginBottom: 4 }}>
          {brand.logoText}
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280' }}>
          Sign in to your {brand.name} portal.
        </p>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: 20 }}
        />

        {error ? (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: '8px 12px',
              fontSize: 13,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '11px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: brand.accent,
            border: 'none',
            borderRadius: 8,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
