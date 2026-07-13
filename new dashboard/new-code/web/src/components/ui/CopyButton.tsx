/**
 * CopyButton — one-click copy-to-clipboard for emails, phones, lead numbers, etc.
 * (UX-AUDIT quick-win #7). Shows a transient check + a toast on success.
 */
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

export function CopyButton({
  value,
  label,
  size = 13,
}: {
  value: string | null | undefined;
  /** Human label for the toast/aria, e.g. "Email". */
  label?: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  if (!value) return null;

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label ?? 'Value'} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label ?? value}`}
      title={`Copy ${label ?? ''}`.trim()}
      style={{
        background: 'none', border: 'none', padding: 2, cursor: 'pointer',
        color: copied ? '#16A34A' : '#9CA3AF', display: 'inline-flex',
        alignItems: 'center', flexShrink: 0, lineHeight: 0,
      }}
      onMouseEnter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.color = '#4B5563'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = copied ? '#16A34A' : '#9CA3AF'; }}
    >
      {copied ? <Check size={size} strokeWidth={2.5} /> : <Copy size={size} />}
    </button>
  );
}
