import { createContext, ReactNode, useContext } from 'react';
import type { ChatWidgetConfig } from '../types';

interface WidgetConfigContextValue {
  config: ChatWidgetConfig;
  host: HTMLElement;
}

const WidgetConfigContext = createContext<WidgetConfigContextValue | null>(null);

interface WidgetConfigProviderProps {
  children: ReactNode;
  config: ChatWidgetConfig;
  host: HTMLElement;
}

export function WidgetConfigProvider({
  children,
  config,
  host,
}: WidgetConfigProviderProps) {
  return (
    <WidgetConfigContext.Provider value={{ config, host }}>
      {children}
    </WidgetConfigContext.Provider>
  );
}

export function useWidgetConfig() {
  const context = useContext(WidgetConfigContext);

  if (!context) {
    throw new Error('useWidgetConfig deve ser usado dentro de WidgetConfigProvider.');
  }

  return context;
}

