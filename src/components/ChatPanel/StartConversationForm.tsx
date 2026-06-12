import { FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

export function StartConversationForm() {
  const { sending, error, startConversation } = useChat();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await startConversation({});
  }

  return (
    <form className="xwc-start" onSubmit={(event) => void handleSubmit(event)}>
      <h2 className="xwc-start-title">Bem-vindo ao atendimento</h2>

      {error && <div className="xwc-error">{error}</div>}

      <button
        className="xwc-primary-button"
        type="submit"
        disabled={sending}
      >
        <MessageCircle size={17} />
        Iniciar atendimento
      </button>
    </form>
  );
}
