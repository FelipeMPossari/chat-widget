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
    ChatSection,
    ChatTab,
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
    activeConversation: ConversationSummary | null;
    messages: ChatMessage[];
    loading: boolean;
    conversationsLoading: boolean;
    sending: boolean;
    error: string;
    canUseConversationList: boolean;
    initialize: () => Promise<void>;
    selectSection: (section: ChatSection) => Promise<void>;
    selectTab: (tab: ChatTab) => Promise<void>;
    openNewConversationPicker: () => Promise<void>;
    startConversation: (input: StartConversationInput) => Promise<boolean>;
    createBlankConversation: () => Promise<void>;
    selectConversation: (conversation: ConversationSummary) => Promise<void>;
    backToConversations: () => void;
    sendMessage: (text: string) => Promise<boolean>;
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
    const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [conversationsLoading, setConversationsLoading] = useState(false);
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
    const canUseConversationList =
        bootstrap?.mode === 'authenticated' || settings.allowMultipleConversations;

    const reloadConversations = useCallback(
        async (
            selectChatGuid?: string,
            filters: ConversationListFilters = {
                section: selectedSection ?? undefined,
                tab: selectedTab ?? undefined,
            }
        ) => {
            const list = await api.listConversations(filters);
            setConversations(list);

            if (selectChatGuid) {
                setActiveConversation(
                    list.find((conversation) => conversation.chatGuid === selectChatGuid) ?? null
                );
            }
        },
        [api, selectedSection, selectedTab]
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
                response.mode === 'authenticated' || responseSettings.allowMultipleConversations;
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
                return;
            }

            if (openConversation && !responseSettings.allowMultipleConversations) {
                setActiveConversation(openConversation);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar o chat.');
        } finally {
            setLoading(false);
        }
    }, [api, bootstrap, config, loading]);

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

    const openNewConversationPicker = useCallback(async () => {
        const chatSection = findSectionByName(sections, 'Chat') ?? sections[0];
        const usersTab = findTabByName(chatSection, 'Usuarios') ?? getInitialTab(chatSection);

        if (!chatSection || !usersTab) {
            setError('Nao foi possivel carregar a lista de usuarios.');
            return;
        }

        setSelectedSection(chatSection);
        setSelectedTab(usersTab);
        setConversationsLoading(true);
        setError('');

        try {
            await reloadConversations(undefined, {
                section: chatSection,
                tab: usersTab,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os usuarios.');
        } finally {
            setConversationsLoading(false);
        }
    }, [reloadConversations, sections]);

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
                await reloadConversations();
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
            setMessages([]);
            setActiveConversation(created);
            await reloadConversations();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conversa.');
        } finally {
            setSending(false);
        }
    }, [api, reloadConversations]);

    const selectConversation = useCallback(
        async (conversation: ConversationSummary) => {
            if (!conversation.isVirtual) {
                setActiveConversation(conversation);
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
                await reloadConversations();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conversa.');
            } finally {
                setSending(false);
            }
        },
        [api, reloadConversations]
    );

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
                const preparedFile = await prepareAttachmentFile(file);
                await api.uploadAttachment(activeConversation.chatGuid, { file: preparedFile });
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
                setMessages(refreshedMessages);
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

    useRealtime({
        api,
        chatGuid: activeConversation?.chatGuid,
        intervalMs: settings.pollingIntervalMs,
        onMessages: setMessages,
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
            activeConversation,
            messages,
            loading,
            conversationsLoading,
            sending,
            error,
            canUseConversationList,
            initialize,
            selectSection,
            selectTab,
            openNewConversationPicker,
            startConversation,
            createBlankConversation,
            selectConversation,
            backToConversations,
            sendMessage,
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
            createBlankConversation,
            error,
            initialize,
            isOpen,
            loading,
            messages,
            sections,
            selectConversation,
            selectedSection,
            selectedTab,
            selectSection,
            selectTab,
            openNewConversationPicker,
            sendMessage,
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

function findSectionByName(sections: ChatSection[], name: string): ChatSection | undefined {
    const normalizedName = normalizeLabel(name);
    return sections.find((section) => normalizeLabel(section.name) === normalizedName);
}

function findTabByName(section: ChatSection | undefined, name: string): ChatTab | undefined {
    const normalizedName = normalizeLabel(name);
    return section?.tabs?.find((tab) => normalizeLabel(tab.name) === normalizedName);
}

function normalizeLabel(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
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
