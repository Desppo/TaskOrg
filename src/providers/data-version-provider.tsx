import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface DataVersionContextValue {
  version: number;
  refresh: () => void;
}

const DataVersionContext = createContext<DataVersionContextValue | null>(null);

export function DataVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const value = useMemo(() => ({ version, refresh }), [refresh, version]);
  return <DataVersionContext.Provider value={value}>{children}</DataVersionContext.Provider>;
}

export function useDataVersion(): DataVersionContextValue {
  const value = useContext(DataVersionContext);
  if (!value) throw new Error('useDataVersion must be used within DataVersionProvider');
  return value;
}
