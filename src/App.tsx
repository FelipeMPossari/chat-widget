import { useEffect } from 'react';
import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { Launcher } from './components/Launcher/Launcher';
import { ChatProvider } from './contexts/ChatContext';
import { WidgetConfigProvider, useWidgetConfig } from './contexts/WidgetConfigContext';
import { useChat } from './hooks/useChat';
import type { ChatWidgetConfig, WidgetController } from './types';

interface AppProps {
  config: ChatWidgetConfig;
  host: HTMLElement;
  onControllerReady: (controller: WidgetController) => void;
}

export function App({ config, host, onControllerReady }: AppProps) {
  return (
    <WidgetConfigProvider config={config} host={host}>
      <ChatProvider>
        <WidgetRuntime onControllerReady={onControllerReady} />
      </ChatProvider>
    </WidgetConfigProvider>
  );
}

interface WidgetRuntimeProps {
  onControllerReady: (controller: WidgetController) => void;
}

function WidgetRuntime({ onControllerReady }: WidgetRuntimeProps) {
  const { config, host } = useWidgetConfig();
  const { initialize, isOpen, setIsOpen, settings, toggleOpen } = useChat();

  useEffect(() => {
    onControllerReady({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: toggleOpen,
      destroy: () => host.remove(),
    });
  }, [host, onControllerReady, setIsOpen, toggleOpen]);

  useEffect(() => {
    host.style.setProperty('--xwc-theme', settings.themeColor);
  }, [host, settings.themeColor]);

  useEffect(() => {
    if (isOpen) {
      void initialize();
    }
  }, [initialize, isOpen]);

  return (
    <div className="xwc-root" data-open={isOpen} data-position={config.position}>
      <ChatPanel />
      <Launcher />
    </div>
  );
}

