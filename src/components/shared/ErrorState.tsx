interface ErrorStateProps {
  message: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({ message, title, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className="xwc-error">
      {title && <strong>{title}</strong>}
      <span>{message}</span>
      {actionLabel && onAction && (
        <button className="xwc-secondary-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

