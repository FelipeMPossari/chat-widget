interface LoadingStateProps {
  message?: string;
  variant?: 'page' | 'overlay';
}

export function LoadingState({
  message = 'Carregando atendimento...',
  variant = 'page',
}: LoadingStateProps) {
  return (
    <div className={`xwc-loading xwc-loading-${variant}`} role="status" aria-live="polite">
      <span className="xwc-loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
