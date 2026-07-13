import { createContext, useContext } from 'react';
import { PortalUser } from '../types/portal';

export const PortalContext = createContext<PortalUser | null>(null);

export function usePortalContext(): PortalUser | null {
  return useContext(PortalContext);
}
