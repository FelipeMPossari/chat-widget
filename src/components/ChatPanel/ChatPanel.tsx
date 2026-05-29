import { X } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { ActiveChat } from './ActiveChat';
import { ConversationList } from './ConversationList';
import { StartConversationForm } from './StartConversationForm';
import { ErrorState } from '../shared/ErrorState';
import { LoadingState } from '../shared/LoadingState';

export function ChatPanel() {
  const {
    activeConversation,
    bootstrap,
    canUseConversationList,
    closeConversation,
    error,
    initialize,
    loading,
    sending,
    setIsOpen,
    settings,
  } = useChat();

  return (
    <section className="xwc-panel" aria-label={settings.title}>
      <header className="xwc-header">
        <div>
          <h2 className="xwc-title">{settings.title}</h2>
          <p className="xwc-subtitle">{settings.subtitle}</p>
        </div>

        <div className="xwc-header-actions">
          {activeConversation && (
            <button
              className="xwc-icon-button"
              type="button"
              title="Encerrar conversa"
              aria-label="Encerrar conversa"
              disabled={sending}
              onClick={() => void closeConversation()}
            >
              <X size={17} />
            </button>
          )}
          <button
            className="xwc-icon-button"
            type="button"
            title="Fechar"
            aria-label="Fechar chat"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <main className="xwc-body">{renderBody()}</main>
    </section>
  );

  function renderBody() {
    if (loading) {
      return <LoadingState />;
    }

    if (error && !bootstrap) {
      return (
        <ErrorState
          title="Chat indisponivel"
          message={error}
          actionLabel="Tentar novamente"
          onAction={() => void initialize()}
        />
      );
    }

    if (activeConversation) {
      return <ActiveChat />;
    }

    if (canUseConversationList) {
      return <ConversationList />;
    }

    return <StartConversationForm />;
  }
}

