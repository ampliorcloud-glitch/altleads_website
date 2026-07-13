/**
 * Top-level React error boundary (ALT-196).
 *
 * A single uncaught render error must never white-screen the whole SPA. This
 * class component catches errors thrown by its subtree and shows a calm,
 * branded fallback instead, letting the user reload or escape to the dashboard.
 *
 * Usage:
 *   // App-wide (e.g. around the router outlet):
 *   <ErrorBoundary>{children}</ErrorBoundary>
 *
 *   // Per-route, so one broken screen doesn't take down siblings:
 *   <RouteErrorBoundary name="Leads">{<LeadsPage />}</RouteErrorBoundary>
 *
 * - getDerivedStateFromError flips us into the fallback on the next render.
 * - componentDidCatch logs the error + component stack for diagnostics.
 * - In DEV (import.meta.env.DEV) the error message + stack are shown in a
 *   collapsible <details>; in production they stay hidden.
 * - Pass a custom `fallback` to fully replace the default UI.
 */
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Replaces the entire default fallback UI when provided. */
  fallback?: ReactNode;
  /** Subtly named in the fallback (e.g. "Leads") for per-route boundaries. */
  routeName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Keep the stack around for the DEV <details>, and surface it in the console.
    this.setState({ errorInfo });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, routeName } = this.props;

    if (!hasError) return children;

    // A custom fallback fully replaces the default UI.
    if (fallback !== undefined) return fallback;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        style={{
          width: '100%',
          minHeight: '100%',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          boxSizing: 'border-box',
          background: 'var(--color-page-bg)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            textAlign: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-card)',
            padding: '36px 28px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              margin: '0 auto 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(196,77,77,0.06)',
              color: 'var(--color-danger)',
            }}
          >
            <AlertTriangle size={26} />
          </div>

          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--color-gray-900)',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--color-gray-500)',
            }}
          >
            This screen hit an unexpected error. Your data is safe.
            {routeName ? (
              <>
                {' '}
                <span style={{ color: 'var(--color-gray-400)' }}>
                  ({routeName})
                </span>
              </>
            ) : null}
          </p>

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'var(--color-brand)',
                color: '#fff',
                fontWeight: 500,
                fontSize: 13,
                padding: '10px 18px',
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
              <RefreshCw size={14} />
              Reload
            </button>

            <a
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 500,
                fontSize: 13,
                padding: '10px 18px',
                borderRadius: 'var(--radius-btn)',
                border: '1px solid var(--border-color)',
                background: 'var(--color-surface)',
                color: 'var(--color-gray-900)',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
              }}
            >
              Go to dashboard
            </a>
          </div>

          {isDev && error ? (
            <details
              style={{
                marginTop: 24,
                textAlign: 'left',
                background: 'var(--color-gray-50)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-input)',
                padding: '12px 14px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-gray-500)',
                  userSelect: 'none',
                }}
              >
                Error details (development only)
              </summary>
              <pre
                style={{
                  margin: '10px 0 0',
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: 'var(--color-danger)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowX: 'auto',
                }}
              >
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
                {errorInfo?.componentStack
                  ? `\n\nComponent stack:${errorInfo.componentStack}`
                  : ''}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}

/**
 * Convenience wrapper for per-route boundaries:
 *   <RouteErrorBoundary name="Companies"><CompaniesPage /></RouteErrorBoundary>
 */
export function RouteErrorBoundary({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}): React.ReactElement {
  return <ErrorBoundary routeName={name}>{children}</ErrorBoundary>;
}

export default ErrorBoundary;
