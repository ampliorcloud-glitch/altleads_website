import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Signals that the surrounding route tree is the Sales Portal (/sales/*).
 *
 * Why a context instead of a prop: the existing pages we reuse on the sales
 * side (LeadsPage, LeadDetailPage) render <AppShell> internally and hard-code
 * their title. Threading a "sales" prop through every page would be a wide,
 * invasive change. Instead the sales route subtree wraps its children in this
 * provider, and AppShell/Sidebar read it to swap in a sales-flavored nav —
 * keeping those reused pages completely untouched (additive only).
 */
const SalesShellContext = createContext<boolean>(false);

export function SalesShellProvider({ children }: { children: ReactNode }) {
  return <SalesShellContext.Provider value={true}>{children}</SalesShellContext.Provider>;
}

/** True when rendered inside the Sales Portal route tree. */
export function useIsSalesShell(): boolean {
  return useContext(SalesShellContext);
}
