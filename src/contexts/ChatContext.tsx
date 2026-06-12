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
    ChatInteractiveList,
    ChatMessage,
    ChatSection,
    ChatTab,
    ContactListFilters,
    ConversationListFilters,
    ConversationSummary,
    WidgetUserContext,
    WidgetSettings,
} from '../types';
import type { CreateConversationRequest } from '../types/api';
import { prepareAttachmentFile } from '../utils/attachments';
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
    sections: ChatSection[];
    selectedSection: ChatSection | null;
    selectedTab: ChatTab | null;
    conversations: ConversationSummary[];
    contacts: ConversationSummary[];
    activeConversation: ConversationSummary | null;
    messages: ChatMessage[];
    loading: boolean;
    conversationsLoading: boolean;
    contactsLoading: boolean;
    messagesLoading: boolean;
    contactPickerOpen: boolean;
    olderMessagesLoading: boolean;
    hasMoreOlderMessages: boolean;
    sending: boolean;
    error: string;
    canUseConversationList: boolean;
    initialize: () => Promise<void>;
    selectSection: (section: ChatSection) => Promise<void>;
    selectTab: (tab: ChatTab) => Promise<void>;
    openNewConversationPicker: () => Promise<void>;
    closeNewConversationPicker: () => void;
    loadContacts: (filters: ContactListFilters) => Promise<void>;
    startConversation: (input: StartConversationInput) => Promise<boolean>;
    createBlankConversation: () => Promise<void>;
    selectConversation: (conversation: ConversationSummary) => Promise<void>;
    backToConversations: () => void;
    loadOlderMessages: () => Promise<void>;
    sendMessage: (text: string) => Promise<boolean>;
    sendInteractiveList: (interactiveList: ChatInteractiveList) => Promise<boolean>;
    uploadAttachment: (file?: File) => Promise<void>;
    retryMessage: (message: ChatMessage) => Promise<boolean>;
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
const MESSAGE_PAGE_SIZE = 50;

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
    children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
    const { config } = useWidgetConfig();
    const api = useMemo(() => createChatApi(config), [config]);
    const [isOpen, setIsOpen] = useState(false);
    const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
    const [sections, setSections] = useState<ChatSection[]>([]);
    const [selectedSection, setSelectedSection] = useState<ChatSection | null>(null);
    const [selectedTab, setSelectedTab] = useState<ChatTab | null>(null);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [contacts, setContacts] = useState<ConversationSummary[]>([]);
    const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [contactsLoading, setContactsLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [contactPickerOpen, setContactPickerOpen] = useState(false);
    const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
    const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const toggleOpen = useCallback(() => setIsOpen((current) => !current), []);

    const settings = useMemo<WidgetSettings>(
        () => ({
            ...DEFAULT_SETTINGS,
            ...(bootstrap?.settings ?? {}),
        }),
        [bootstrap?.settings]
    );
    const isAnonymousAccess = !config.authToken && !config.user?.token;
    const canUseConversationList = !isAnonymousAccess && bootstrap?.mode === 'authenticated';

    const reloadConversations = useCallback(
        async (
            selectChatGuid?: string,
            filters: ConversationListFilters = {
                section: selectedSection ?? undefined,
                tab: selectedTab ?? undefined,
            }
        ) => {
            if (isAnonymousAccess || bootstrap?.mode !== 'authenticated') {
                return;
            }

            const list = await api.listConversations(filters);
            setConversations(list);

            if (selectChatGuid) {
                setActiveConversation(
                    list.find((conversation) => conversation.chatGuid === selectChatGuid) ?? null
                );
            }
        },
        [api, bootstrap?.mode, isAnonymousAccess, selectedSection, selectedTab]
    );

    const loadInitialMessages = useCallback(
        async (chatGuid: string) => {
            setMessagesLoading(true);

            try {
                const loadedMessages = await api.listMessages(chatGuid, {
                    take: MESSAGE_PAGE_SIZE,
                });

                setMessages(loadedMessages);
                setHasMoreOlderMessages(loadedMessages.length === MESSAGE_PAGE_SIZE);
            } finally {
                setMessagesLoading(false);
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
            const responseSettings = {
                ...DEFAULT_SETTINGS,
                ...(response.settings ?? {}),
            };
            const responseAllowsConversationList =
                !isAnonymousAccess && response.mode === 'authenticated';
            let list: ConversationSummary[] = [];

            if (responseAllowsConversationList) {
                const loadedSections = await api.listSections();
                const initialSection = loadedSections[0] ?? null;
                const initialTab = getInitialTab(initialSection);

                setSections(loadedSections);
                setSelectedSection(initialSection);
                setSelectedTab(initialTab);

                list = await api.listConversations({
                    section: initialSection ?? undefined,
                    tab: initialTab ?? undefined,
                });
                setConversations(list);
            } else {
                setSections([]);
                setSelectedSection(null);
                setSelectedTab(null);
                setConversations([]);
            }

            const openConversation = list.find((conversation) => conversation.status === 'open');

            if (!responseSettings.requireIdentity && !openConversation && !responseAllowsConversationList) {
                const created = await api.createConversation({});
                setConversations([created]);
                setActiveConversation(created);
                await loadInitialMessages(created.chatGuid);
                return;
            }

            if (openConversation && !responseSettings.allowMultipleConversations) {
                setActiveConversation(openConversation);
                await loadInitialMessages(openConversation.chatGuid);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar o chat.');
        } finally {
            setLoading(false);
        }
    }, [api, bootstrap, config, isAnonymousAccess, loadInitialMessages, loading]);

    const selectSection = useCallback(
        async (section: ChatSection) => {
            const tab = getInitialTab(section);

            setSelectedSection(section);
            setSelectedTab(tab);
            setConversationsLoading(true);
            setError('');

            try {
                await reloadConversations(undefined, {
                    section,
                    tab: tab ?? undefined,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as conversas.');
            } finally {
                setConversationsLoading(false);
            }
        },
        [reloadConversations]
    );

    const selectTab = useCallback(
        async (tab: ChatTab) => {
            setSelectedTab(tab);
            setConversationsLoading(true);
            setError('');

            try {
                await reloadConversations(undefined, {
                    section: selectedSection ?? undefined,
                    tab,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as conversas.');
            } finally {
                setConversationsLoading(false);
            }
        },
        [reloadConversations, selectedSection]
    );

    const loadContacts = useCallback(
        async (filters: ContactListFilters) => {
            setContactsLoading(true);
            setError('');

            try {
                const loadedContacts = await api.listContacts(filters);
                setContacts(loadedContacts);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os contatos.');
            } finally {
                setContactsLoading(false);
            }
        },
        [api]
    );

    const openNewConversationPicker = useCallback(async () => {
        setContactPickerOpen(true);
        setContacts([]);
        setError('');
    }, []);

    const closeNewConversationPicker = useCallback(() => {
        setContactPickerOpen(false);
        setContacts([]);
        setError('');
    }, []);

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
                await loadInitialMessages(created.chatGuid);
                await reloadConversations();
                return true;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar a conversa.');
                return false;
            } finally {
                setSending(false);
            }
        },
        [api, config.user?.email, config.user?.name, loadInitialMessages, reloadConversations]
    );

    const createBlankConversation = useCallback(async () => {
        setSending(true);
        setError('');

        try {
            const created = await api.createConversation({ subject: 'Nova conversa' });
            setMessages([]);
            setActiveConversation(created);
            await loadInitialMessages(created.chatGuid);
            await reloadConversations();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conversa.');
        } finally {
            setSending(false);
        }
    }, [api, loadInitialMessages, reloadConversations]);

    const selectConversation = useCallback(
        async (conversation: ConversationSummary) => {
            if (!conversation.isVirtual) {
                setContactPickerOpen(false);
                setActiveConversation(conversation);
                setMessages([]);
                setHasMoreOlderMessages(false);
                await loadInitialMessages(conversation.chatGuid);
                return;
            }

            const receiverChatUsers = conversation.members
                .map((member) => member.raw)
                .filter(Boolean) as CreateConversationRequest['receiverChatUsers'];

            if (!receiverChatUsers?.length) {
                setError('Usuario da conversa nao identificado.');
                return;
            }

            setSending(true);
            setError('');

            try {
                const created = await api.createConversation({
                    subject: conversation.title,
                    receiverChatUsers,
                });

                setMessages([]);
                setActiveConversation(created);
                setContactPickerOpen(false);
                setContacts([]);
                setHasMoreOlderMessages(false);
                await loadInitialMessages(created.chatGuid);
                await reloadConversations();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conversa.');
            } finally {
                setSending(false);
            }
        },
        [api, loadInitialMessages, reloadConversations]
    );

    const backToConversations = useCallback(() => {
        setActiveConversation(null);
        setMessages([]);
        setHasMoreOlderMessages(false);
    }, []);

    const loadOlderMessages = useCallback(async () => {
        if (
            !activeConversation ||
            olderMessagesLoading ||
            !hasMoreOlderMessages ||
            messages.length === 0
        ) {
            return;
        }

        const oldestMessage = messages.reduce((oldest, message) =>
            new Date(message.createdAt).getTime() < new Date(oldest.createdAt).getTime()
                ? message
                : oldest
        );

        setOlderMessagesLoading(true);
        setError('');

        try {
            const olderMessages = await api.listMessages(activeConversation.chatGuid, {
                take: MESSAGE_PAGE_SIZE,
                beforeCreatedAt: oldestMessage.createdAt,
            });

            setMessages((current) => mergeMessages(olderMessages, current));
            setHasMoreOlderMessages(olderMessages.length === MESSAGE_PAGE_SIZE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel carregar mensagens antigas.');
        } finally {
            setOlderMessagesLoading(false);
        }
    }, [
        activeConversation,
        api,
        hasMoreOlderMessages,
        messages,
        olderMessagesLoading,
    ]);

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

    const sendInteractiveList = useCallback(
        async (interactiveList: ChatInteractiveList) => {
            if (!activeConversation) {
                return false;
            }

            setSending(true);
            setError('');

            try {
                const message = await api.sendInteractiveList(activeConversation.chatGuid, {
                    interactiveList,
                });
                setMessages((current) => [...current, message]);
                await reloadConversations(activeConversation.chatGuid);
                return true;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel enviar a lista.');
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
                const preparedFile = await prepareAttachmentFile(file);
                await api.uploadAttachment(activeConversation.chatGuid, { file: preparedFile });
                const refreshedMessages = await api.listMessages(activeConversation.chatGuid);
                setMessages((current) => mergeMessages(current, refreshedMessages));
                await reloadConversations(activeConversation.chatGuid);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel enviar o anexo.');
            } finally {
                setSending(false);
            }
        },
        [activeConversation, api, reloadConversations]
    );

    const retryMessage = useCallback(
        async (message: ChatMessage) => {
            if (!activeConversation || message.status?.toLowerCase() !== 'failed') {
                return false;
            }

            setSending(true);
            setError('');

            try {
                if (!message.id) {
                    setError('Nao foi possivel reenviar esta mensagem.');
                    return false;
                }

                await api.retryMessage(activeConversation.chatGuid, message.id);
                const refreshedMessages = await api.listMessages(activeConversation.chatGuid);
                setMessages((current) => mergeMessages(current, refreshedMessages));
                await reloadConversations(activeConversation.chatGuid);
                return true;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel reenviar a mensagem.');
                return false;
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

    const handleRealtimeMessages = useCallback((realtimeMessages: ChatMessage[]) => {
        setMessages((current) => {
            if (current.length === 0) {
                setHasMoreOlderMessages(realtimeMessages.length === MESSAGE_PAGE_SIZE);
                return realtimeMessages;
            }

            return mergeMessages(current, realtimeMessages);
        });
    }, []);

    useRealtime({
        api,
        chatGuid: activeConversation?.chatGuid,
        intervalMs: settings.pollingIntervalMs,
        onMessages: handleRealtimeMessages,
    });

    const value = useMemo<ChatContextValue>(
        () => ({
            isOpen,
            setIsOpen,
            toggleOpen,
            bootstrap,
            settings,
            sections,
            selectedSection,
            selectedTab,
            conversations,
            contacts,
            activeConversation,
            messages,
            loading,
            conversationsLoading,
            contactsLoading,
            messagesLoading,
            contactPickerOpen,
            olderMessagesLoading,
            hasMoreOlderMessages,
            sending,
            error,
            canUseConversationList,
            initialize,
            selectSection,
            selectTab,
            openNewConversationPicker,
            closeNewConversationPicker,
            loadContacts,
            startConversation,
            createBlankConversation,
            selectConversation,
            backToConversations,
            loadOlderMessages,
            sendMessage,
            sendInteractiveList,
            uploadAttachment,
            retryMessage,
            closeConversation,
        }),
        [
            activeConversation,
            backToConversations,
            bootstrap,
            canUseConversationList,
            closeConversation,
            conversations,
            conversationsLoading,
            contacts,
            contactsLoading,
            contactPickerOpen,
            closeNewConversationPicker,
            createBlankConversation,
            error,
            hasMoreOlderMessages,
            initialize,
            isOpen,
            loadOlderMessages,
            loadContacts,
            loading,
            messages,
            messagesLoading,
            olderMessagesLoading,
            sections,
            selectConversation,
            selectedSection,
            selectedTab,
            selectSection,
            selectTab,
            openNewConversationPicker,
            sendMessage,
            sendInteractiveList,
            sending,
            settings,
            startConversation,
            toggleOpen,
            uploadAttachment,
            retryMessage,
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

function getInitialTab(section?: ChatSection | null): ChatTab | null {
    return section?.tabs?.[0] ?? null;
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

function mergeMessages(
    currentMessages: ChatMessage[],
    nextMessages: ChatMessage[]
): ChatMessage[] {
    const messagesById = new Map<string, ChatMessage>();

    for (const message of currentMessages) {
        messagesById.set(message.id, message);
    }

    for (const message of nextMessages) {
        messagesById.set(message.id, {
            ...(messagesById.get(message.id) ?? {}),
            ...message,
        });
    }

    return Array.from(messagesById.values()).sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();

        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }

        return left.id.localeCompare(right.id);
    });
}
