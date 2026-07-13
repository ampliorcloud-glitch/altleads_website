/**
 * EmptyState — reusable, actionable empty-state block with Zen animations.
 *
 * A small presentational component for "nothing to show" moments: optional icon,
 * a title, a friendly message, and an optional next-action button. Styled to match
 * the app's Zen design system with larger icon container and more whitespace.
 *
 * Purely presentational — it renders what it's given and calls `action.onClick`.
 * Drop it inside an existing empty container (e.g. a table cell's content).
 *
 *   <EmptyState
 *     title="No leads match these filters"
 *     message="Try widening or clearing the filters above."
 *     action={{ label: 'Clear filters', onClick: clearFilters }}
 *   />
 */
import React from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { staggerItem } from '../../lib/zenAnimations';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Optional leading icon (e.g. a lucide-react <Icon size={24} />). */
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <motion.div
      variants={staggerItem}
      initial="initial"
      animate="animate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-card, 12px)',
            background: 'var(--color-surface-alt, #F5F5F3)',
            color: 'var(--color-gray-400, #717784)',
            marginBottom: 4,
          }}
        >
          {icon}
        </span>
      )}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-gray-900, #1f1f1f)',
        }}
      >
        {title}
      </div>
      {message && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted, #6B7280)',
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}
      {action && (
        <motion.button
          type="button"
          onClick={action.onClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-brand)',
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-btn, 10px)',
            padding: '8px 18px',
            cursor: 'pointer',
            transition: 'border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(26, 126, 232, 0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}

export default EmptyState;
