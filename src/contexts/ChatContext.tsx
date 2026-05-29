import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { createChatApi } from '../services/api/chatApi';
import type { IChatApi } from '../services/api/chatApi';
import type {
  BootstrapResponse,
  ChatMessage,
  ConversationSummary,
  WidgetUserContext,
  WidgetSettings,
} from '../types';
import type { CreateConversationRequest } from '../types/api';
import { getOrCreateVisitorId } from '../utils/storage';
import { useWidgetConfig } from './WidgetConfigContext';
import { useRealtime } from '../hooks/useRealtime';

export interface StartConversationInput {
  visitorName?: string;
  visitorEmail?: string;
}

interface ChatContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  bootstrap: BootstrapResponse | null;
  settings: WidgetSettings;
  conversations: ConversationSummary[];
  activeConversation: ConversationSummary | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string;
  canUseConversationList: boolean;
  initialize: () => Promise<void>;
  startConversation: (input: StartConversationInput) => Promise<boolean>;
  createBlankConversation: () => Promise<void>;
  selectConversation: (conversation: ConversationSummary) => void;
  backToConversations: () => void;
  sendMessage: (text: string) => Promise<boolean>;
  uploadAttachment: (file?: File) => Promise<void>;
  closeConversation: () => Promise<void>;
}

const DEFAULT_SETTINGS: WidgetSettings = {
  title: 'Atendimento XChannel',
  subtitle: 'Fale com nossa equipe',
  themeColor: '#2688c7',
  requireIdentity: true,
  allowAttachments: true,
  allowMultipleConversations: false,
  pollingIntervalMs: 5000,
};

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useWidgetConfig();
  const api = useMemo(() => createChatApi(config), [config]);
  const [isOpen, setIsOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const toggleOpen = useCallback(() => setIsOpen((current) => !current), []);

  const settings = bootstrap?.settings ?? DEFAULT_SETTINGS;
  const canUseConversationList =
    bootstrap?.mode === 'authenticated' || settings.allowMultipleConversations;

  const reloadConversations = useCallback(
    async (selectChatGuid?: string) => {
      const list = await api.listConversations();
      setConversations(list);

      if (selectChatGuid) {
        setActiveConversation(
          list.find((conversation) => conversation.chatGuid === selectChatGuid) ?? null
        );
      }
    },
    [api]
  );

  const initialize = useCallback(async () => {
    if (bootstrap || loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const visitorId = getOrCreateVisitorId(config.widgetKey);
      const response = await api.bootstrap({
        widgetKey: config.widgetKey,
        visitorId,
        sourceSystem: config.sourceSystem,
        sourceUrl: config.sourceUrl,
        user: toBootstrapUserContext(config.user),
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
  }, [api, bootstrap, config, loading]);

  const startConversation = useCallback(
    async (input: StartConversationInput) => {
      setSending(true);
      setError('');

      try {
        const request: CreateConversationRequest = {
          subject: 'Atendimento via Chat Web',
          visitorName: input.visitorName?.trim() || config.user?.name,
          visitorEmail: input.visitorEmail?.trim() || config.user?.email,
        };
        const created = await api.createConversation(request);
        setMessages([]);
        setActiveConversation(created);
        await reloadConversations(created.chatGuid);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar a conversa.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [api, config.user?.email, config.user?.name, reloadConversations]
  );

  const createBlankConversation = useCallback(async () => {
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
  }, [api, reloadConversations]);

  const selectConversation = useCallback((conversation: ConversationSummary) => {
    setActiveConversation(conversation);
  }, []);

  const backToConversations = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const messageText = text.trim();

      if (!activeConversation || !messageText) {
        return false;
      }

      setSending(true);
      setError('');

      try {
        const message = await api.sendMessage(activeConversation.chatGuid, { text: messageText });
        setMessages((current) => [...current, message]);
        await reloadConversations(activeConversation.chatGuid);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a mensagem.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [activeConversation, api, reloadConversations]
  );

  const uploadAttachment = useCallback(
    async (file?: File) => {
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
      }
    },
    [activeConversation, api, reloadConversations]
  );

  const closeConversation = useCallback(async () => {
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
  }, [activeConversation, api, reloadConversations]);

  useRealtime({
    api,
    chatGuid: activeConversation?.chatGuid,
    intervalMs: bootstrap?.settings.pollingIntervalMs,
    onMessages: setMessages,
  });

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      setIsOpen,
      toggleOpen,
      bootstrap,
      settings,
      conversations,
      activeConversation,
      messages,
      loading,
      sending,
      error,
      canUseConversationList,
      initialize,
      startConversation,
      createBlankConversation,
      selectConversation,
      backToConversations,
      sendMessage,
      uploadAttachment,
      closeConversation,
    }),
    [
      activeConversation,
      backToConversations,
      bootstrap,
      canUseConversationList,
      closeConversation,
      conversations,
      createBlankConversation,
      error,
      initialize,
      isOpen,
      loading,
      messages,
      selectConversation,
      sendMessage,
      sending,
      settings,
      startConversation,
      toggleOpen,
      uploadAttachment,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChatContext deve ser usado dentro de ChatProvider.');
  }

  return context;
}

function toBootstrapUserContext(user?: WidgetUserContext): WidgetUserContext | undefined {
  if (!user) {
    return undefined;
  }

  const context: WidgetUserContext = {
    externalUserId: user.externalUserId,
    name: user.name,
    email: user.email,
  };

  return context.externalUserId || context.name || context.email ? context : undefined;
}
