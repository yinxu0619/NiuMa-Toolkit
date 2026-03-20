import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadSalaryConfig, loadTimeConfig } from '@/lib/storage';
import { secondWage, secondWageWithTime } from '@/lib/salary';
import type { SalaryConfig } from '@/types';

interface SalaryContextValue {
  config: SalaryConfig | null;
  salaryPerSecond: number;
  refresh: () => Promise<void>;
  setConfig: (c: SalaryConfig) => void;
}

const SalaryContext = createContext<SalaryContextValue | null>(null);

export function SalaryProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<SalaryConfig | null>(null);
  const [timeConfig, setTimeConfig] = useState<{ workStart: string; workEnd: string; lunchStart: string; lunchEnd: string } | null>(null);

  const refresh = useCallback(async () => {
    const [c, t] = await Promise.all([loadSalaryConfig(), loadTimeConfig()]);
    setConfigState(c);
    setTimeConfig(t);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setConfig = useCallback((c: SalaryConfig) => {
    setConfigState(c);
  }, []);

  const salaryPerSecond = config ? secondWageWithTime(config, timeConfig) : 0;

  return (
    <SalaryContext.Provider value={{ config, salaryPerSecond, refresh, setConfig }}>
      {children}
    </SalaryContext.Provider>
  );
}

export function useSalary() {
  const ctx = useContext(SalaryContext);
  if (!ctx) throw new Error('useSalary must be used within SalaryProvider');
  return ctx;
}
