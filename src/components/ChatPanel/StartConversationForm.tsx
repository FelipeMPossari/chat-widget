import { FormEvent, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useWidgetConfig } from '../../contexts/WidgetConfigContext';
import { useChat } from '../../hooks/useChat';

export function StartConversationForm() {
  const { config } = useWidgetConfig();
  const { settings, sending, error, startConversation } = useChat();
  const [form, setForm] = useState({
    name: config.user?.name || '',
    email: config.user?.email || '',
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await startConversation({
      visitorName: form.name,
      visitorEmail: form.email,
    });
  }

  return (
    <form className="xwc-start" onSubmit={(event) => void handleSubmit(event)}>
      <p className="xwc-start-copy">
        Informe seus dados para iniciar o atendimento.
      </p>

      {settings.requireIdentity && !config.user?.externalUserId && (
        <>
          <div className="xwc-field">
            <label htmlFor="xwc-name">Nome</label>
            <input
              id="xwc-name"
              autoComplete="name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="xwc-field">
            <label htmlFor="xwc-email">E-mail</label>
            <input
              id="xwc-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </div>
        </>
      )}

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
