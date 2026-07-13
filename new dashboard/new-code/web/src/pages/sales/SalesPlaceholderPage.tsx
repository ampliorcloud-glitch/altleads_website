import React from 'react';
import { Construction } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';

/**
 * Generic "Coming soon" placeholder for Sales Portal nav items that are scaffolded
 * but not yet built (Meetings, Feedback). Rendered inside the sales AppShell so the
 * sales sidebar/topbar are present. Real pages arrive in later tickets.
 */
export function SalesPlaceholderPage({ title }: { title: string }) {
  return (
    <AppShell title={title}>
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ minHeight: '60vh', gap: 12 }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--color-brand-light)',
            color: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Construction size={26} strokeWidth={1.75} />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-gray-900)' }}>
          {title}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-gray-500)' }}>Coming soon</p>
      </div>
    </AppShell>
  );
}

export default SalesPlaceholderPage;
