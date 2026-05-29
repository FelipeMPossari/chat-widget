interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando atendimento...' }: LoadingStateProps) {
  return <div className="xwc-loading">{message}</div>;
}

