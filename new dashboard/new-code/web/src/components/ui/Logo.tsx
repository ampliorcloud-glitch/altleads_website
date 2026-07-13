/**
 * AltLeads wordmark logo. "Alt" in warm terracotta accent, "Leads" in warm dark.
 * Used in the sidebar and on the login screen.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 26 : size === 'sm' ? 15 : 18;
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        fontFamily: 'var(--font-display)',
      }}
    >
      <span style={{ color: '#1A7EE8' }}>Alt</span>
      <span style={{ color: 'var(--color-gray-900)' }}>Leads</span>
    </span>
  );
}
