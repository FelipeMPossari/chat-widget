import {
  ArrowLeft,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  SquarePen,
  X,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createChatApi } from '../api/createChatApi';
import { PollingRealtimeClient } from '../realtime/RealtimeClient';
import { getOrCreateVisitorId } from '../storage';
import type {
  BootstrapResponse,
  ChatMessage,
  ChatWidgetConfig,
  ConversationSummary,
  WidgetController,
} from '../types';

interface ChatWidgetProps {
  config: ChatWidgetConfig;
  host: HTMLElement;
  onControllerReady: (controller: WidgetController) => void;
}

interface StartFormState {
  name: string;
  email: string;
  message: string;
}

export function ChatWidget({ config, host, onControllerReady }: ChatWidgetProps) {
  const api = useMemo(() => createChatApi(config), [config]);
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [startForm, setStartForm] = useState<StartFormState>({
    name: config.user?.name || '',
    email: config.user?.email || '',
    message: '',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const settings = bootstrap?.settings ?? {
    title: 'Atendimento XChannel',
    subtitle: 'Fale com nossa equipe',
    themeColor: '#2688c7',
    requireIdentity: true,
    allowAttachments: true,
    allowMultipleConversations: false,
    pollingIntervalMs: 5000,
  };
  const canUseConversationList =
    bootstrap?.mode === 'authenticated' || settings.allowMultipleConversations;

  useEffect(() => {
    onControllerReady({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((current) => !current),
      destroy: () => host.remove(),
    });
  }, [host, onControllerReady]);

  useEffect(() => {
    host.style.setProperty('--xwc-theme', settings.themeColor);
  }, [host, settings.themeColor]);

  useEffect(() => {
    if (!open || bootstrap) {
      return;
    }

    void initialize();
  }, [open, bootstrap]);

  useEffect(() => {
    if (!activeConversation || !bootstrap) {
      return;
    }

    const realtime = new PollingRealtimeClient(api, bootstrap.settings.pollingIntervalMs);
    realtime.start(activeConversation.chatGuid, setMessages);

    return () => realtime.stop();
  }, [activeConversation, api, bootstrap]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  async function initialize() {
    setLoading(true);
    setError('');

    try {
      const visitorId = getOrCreateVisitorId(config.widgetKey);
      const response = await api.bootstrap({
        widgetKey: config.widgetKey,
        visitorId,
        sourceSystem: config.sourceSystem,
        sourceUrl: config.sourceUrl,
        user: config.user,
      });

      setBootstrap(response);
      const list = await api.listConversations();
      setConversations(list);

      const openConversation = list.find((conversation) => conversation.status === 'open');
      const responseAllowsConversationList =
        response.mode === 'authenticated' || response.settings.allowMultipleConversations;

      if (!response.settings.requireIdentity && !openConversation && !responseAllowsConversationList) {
        const created = await api.createConversation({});
        setConversations([created]);
        setActiveConversation(created);
        return;
      }

      if (openConversation && !response.settings.allowMultipleConversations) {
        setActiveConversation(openConversation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar o chat.');
    } finally {
      setLoading(false);
    }
  }

  async function reloadConversations(selectChatGuid?: string) {
    const list = await api.listConversations();
    setConversations(list);

    if (selectChatGuid) {
      setActiveConversation(
        list.find((conversation) => conversation.chatGuid === selectChatGuid) ?? null
      );
    }
  }

  async function startConversation(event: FormEvent) {
    event.preventDefault();

    if (!startForm.message.trim()) {
      return;
    }

    setSending(true);
    setError('');

    try {
      const created = await api.createConversation({
        subject: 'Atendimento via Chat Web',
        visitorName: startForm.name.trim() || config.user?.name,
        visitorEmail: startForm.email.trim() || config.user?.email,
      });
      setActiveConversation(created);
      await api.sendMessage(created.chatGuid, { text: startForm.message.trim() });
      await reloadConversations(created.chatGuid);
      setStartForm((current) => ({ ...current, message: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar a conversa.');
    } finally {
      setSending(false);
    }
  }

  async function createBlankConversation() {
    setSending(true);
    setError('');

    try {
      const created = await api.createConversation({ subject: 'Nova conversa' });
      await reloadConversations(created.chatGuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conversa.');
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();

    if (!activeConversation || !text) {
      return;
    }

    setDraft('');
    setSending(true);
    setError('');

    try {
      const message = await api.sendMessage(activeConversation.chatGuid, { text });
      setMessages((current) => [...current, message]);
      await reloadConversations(activeConversation.chatGuid);
    } catch (err) {
      setDraft(text);
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function closeConversation() {
    if (!activeConversation) {
      return;
    }

    setSending(true);
    setError('');

    try {
      await api.closeConversation(activeConversation.chatGuid);
      setActiveConversation(null);
      setMessages([]);
      await reloadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel encerrar a conversa.');
    } finally {
      setSending(false);
    }
  }

  async function uploadSelectedFile(file?: File) {
    if (!activeConversation || !file) {
      return;
    }

    setSending(true);
    setError('');

    try {
      await api.uploadAttachment(activeConversation.chatGuid, { file });
      const refreshedMessages = await api.listMessages(activeConversation.chatGuid);
      setMessages(refreshedMessages);
      await reloadConversations(activeConversation.chatGuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar o anexo.');
    } finally {
      setSending(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="xwc-root" data-open={open} data-position={config.position}>
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
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <main className="xwc-body">{renderBody()}</main>
      </section>

      <button
        className="xwc-launcher"
        type="button"
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={28} /> : <MessageCircle size={30} />}
      </button>
    </div>
  );

  function renderBody() {
    if (loading) {
      return <div className="xwc-loading">Carregando atendimento...</div>;
    }

    if (error && !bootstrap) {
      return (
        <div className="xwc-error">
          <strong>Chat indisponivel</strong>
          <span>{error}</span>
          <button className="xwc-secondary-button" type="button" onClick={() => void initialize()}>
            Tentar novamente
          </button>
        </div>
      );
    }

    if (activeConversation) {
      return renderChat();
    }

    if (canUseConversationList) {
      return renderConversationList();
    }

    return renderStartForm();
  }

  function renderStartForm() {
    return (
      <form className="xwc-start" onSubmit={(event) => void startConversation(event)}>
        <p className="xwc-start-copy">
          Envie sua mensagem para iniciar uma conversa com o atendimento.
        </p>

        {settings.requireIdentity && !config.user?.externalUserId && (
          <>
            <div className="xwc-field">
              <label htmlFor="xwc-name">Nome</label>
              <input
                id="xwc-name"
                autoComplete="name"
                value={startForm.name}
                onChange={(event) =>
                  setStartForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="xwc-field">
              <label htmlFor="xwc-email">E-mail</label>
              <input
                id="xwc-email"
                type="email"
                autoComplete="email"
                value={startForm.email}
                onChange={(event) =>
                  setStartForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
          </>
        )}

        <textarea
          className="xwc-start-message"
          aria-label="Mensagem"
          placeholder="Digite sua mensagem"
          value={startForm.message}
          onChange={(event) =>
            setStartForm((current) => ({ ...current, message: event.target.value }))
          }
        />

        {error && <div className="xwc-error">{error}</div>}

        <button
          className="xwc-primary-button"
          type="submit"
          disabled={sending || !startForm.message.trim()}
        >
          <Send size={17} />
          Iniciar conversa
        </button>
      </form>
    );
  }

  function renderConversationList() {
    return (
      <div className="xwc-list">
        <div className="xwc-list-toolbar">
          <button
            className="xwc-secondary-button"
            type="button"
            disabled={sending}
            onClick={() => void createBlankConversation()}
          >
            <Plus size={17} />
            Nova conversa
          </button>
        </div>

        <div className="xwc-conversations">
          {conversations.length === 0 ? (
            <div className="xwc-empty">Nenhuma conversa aberta.</div>
          ) : (
            conversations.map((conversation) => (
              <button
                className="xwc-conversation"
                type="button"
                key={conversation.chatGuid}
                onClick={() => setActiveConversation(conversation)}
              >
                <span>
                  <span className="xwc-conversation-title">{conversation.title}</span>
                  <span className="xwc-conversation-message">
                    {conversation.lastMessage || conversation.status}
                  </span>
                </span>
                <span className="xwc-conversation-time">
                  {formatTime(conversation.lastMessageAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderChat() {
    return (
      <div className="xwc-chat">
        <div className="xwc-chat-toolbar">
          {canUseConversationList ? (
            <button
              className="xwc-icon-button"
              type="button"
              title="Voltar"
              aria-label="Voltar para conversas"
              onClick={() => {
                setActiveConversation(null);
                setMessages([]);
              }}
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span />
          )}
          <span className="xwc-chat-name">{activeConversation?.title}</span>
          <SquarePen size={17} aria-hidden="true" />
        </div>

        <div className="xwc-messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="xwc-empty">Nenhuma mensagem ainda.</div>
          ) : (
            messages.map((message) => (
              <article className="xwc-message" data-author={message.authorType} key={message.id}>
                <div className="xwc-bubble">
                  {message.text}
                  {message.attachments?.map((attachment) => (
                    <a
                      className="xwc-attachment"
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      key={attachment.id}
                    >
                      <Paperclip size={15} />
                      {attachment.fileName}
                    </a>
                  ))}
                </div>
                <div className="xwc-meta">
                  {message.authorName ? `${message.authorName} - ` : ''}
                  {formatTime(message.createdAt)}
                </div>
              </article>
            ))
          )}
        </div>

        {error && <div className="xwc-error">{error}</div>}

        <div className="xwc-message-input">
          <input
            className="xwc-hidden-file"
            type="file"
            ref={fileInputRef}
            onChange={(event) => void uploadSelectedFile(event.target.files?.[0])}
          />
          <button
            className="xwc-icon-button"
            type="button"
            title="Anexar arquivo"
            aria-label="Anexar arquivo"
            disabled={!settings.allowAttachments || sending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </button>
          <textarea
            aria-label="Mensagem"
            placeholder="Digite uma mensagem"
            value={draft}
            rows={1}
            disabled={sending}
            onKeyDown={handleDraftKeyDown}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="xwc-icon-button"
            type="button"
            title="Enviar"
            aria-label="Enviar mensagem"
            disabled={sending || !draft.trim()}
            onClick={() => void sendMessage()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  }
}

function formatTime(value?: string): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

