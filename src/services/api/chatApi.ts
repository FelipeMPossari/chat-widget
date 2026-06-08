import type {
    BootstrapResponse,
    ChatMember,
    ChatSection,
    ChatMessage,
    ChatInteractiveList,
    ContactListFilters,
    ConversationListFilters,
    ConversationSummary,
} from '../../types';
import type { ChatWidgetConfig, WidgetUserContext } from '../../types';
import type {
    BootstrapRequest,
    CreateConversationRequest,
    LoadContactsRequest,
    LoadConversationsRequest,
    SendInteractiveListRequest,
    SendMessageRequest,
    UploadAttachmentRequest,
    XChannelChatListItemDto,
    XChannelChatMemberDto,
    XChannelChatSectionDto,
    XChannelMessageStatusUpdateDto,
    XChannelMessageDto,
} from '../../types/api';
import { ApiClient } from './apiClient';
import {
    mapChatListItemDtoToConversation,
    mapMemberDtoToChatMember,
    mapSectionDtoToChatSection,
    mapMessageDtoToChatMessage,
    readDtoValue,
} from './chatMappers';
import { MockChatApi } from './mockChatApi';

export interface IChatApi {
    bootstrap(request: BootstrapRequest): Promise<BootstrapResponse>;
    listSections(): Promise<ChatSection[]>;
    listConversations(filters?: ConversationListFilters): Promise<ConversationSummary[]>;
    listContacts(filters: ContactListFilters): Promise<ConversationSummary[]>;
    createConversation(request: CreateConversationRequest): Promise<ConversationSummary>;
    listMessages(chatGuid: string, options?: ListMessagesOptions): Promise<ChatMessage[]>;
    sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage>;
    sendInteractiveList(chatGuid: string, request: SendInteractiveListRequest): Promise<ChatMessage>;
    uploadAttachment(chatGuid: string, request: UploadAttachmentRequest): Promise<ChatMessage>;
    retryMessage(chatGuid: string, messageGuid: string): Promise<XChannelMessageStatusUpdateDto>;
    closeConversation(chatGuid: string): Promise<ConversationSummary>;
}

export interface ListMessagesOptions {
    take?: number;
    beforeCreatedAt?: string;
}

export function createChatApi(config: ChatWidgetConfig): IChatApi {
    const authToken = config.authToken || config.user?.token;

    if (config.demoMode || !config.apiBaseUrl) {
        return new MockChatApi(authToken);
    }

    return new HttpChatApi(new ApiClient(config.apiBaseUrl, authToken), config.user, authToken);
}

class HttpChatApi implements IChatApi {
    private currentUserMember?: ChatMember;

    constructor(
        private readonly apiClient: ApiClient,
        private readonly currentUser?: WidgetUserContext,
        private readonly authToken?: string
    ) { }

    async bootstrap(request: BootstrapRequest): Promise<BootstrapResponse> {
        const response = await this.apiClient.post<unknown>(
            '/StartChatSession',
            request
        );
        const bootstrap = normalizeBootstrapResponse(response, request.visitorId);

        if (!this.authToken && bootstrap.token) {
            this.apiClient.setToken(bootstrap.token);
        }

        this.currentUserMember = bootstrap.currentUser;

        return bootstrap;
    }

    async listSections(): Promise<ChatSection[]> {
        const sections = await this.apiClient.post<XChannelChatSectionDto[]>(
            '/LoadSections',
            {}
        );

        return (sections ?? [])
            .map(mapSectionDtoToChatSection)
            .filter((section) => section.name);
    }

    async listConversations(filters: ConversationListFilters = {}): Promise<ConversationSummary[]> {
        const items = await this.apiClient.post<XChannelChatListItemDto[]>(
            '/LoadConversations',
            toLoadConversationsRequest(filters)
        );
        return dedupeConversations((items ?? []).map(mapChatListItemDtoToConversation));
    }

    async listContacts(filters: ContactListFilters): Promise<ConversationSummary[]> {
        const items = await this.apiClient.post<XChannelChatListItemDto[]>(
            '/LoadContacts',
            toLoadContactsRequest(filters)
        );

        return dedupeConversations(
            (items ?? []).map((item) => ({
                ...mapChatListItemDtoToConversation(item),
                isVirtual: true,
            }))
        );
    }

    async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
        const item = await this.apiClient.post<XChannelChatListItemDto>(
            '/CreateConversation',
            toCreateConversationRequest(request)
        );
        return mapChatListItemDtoToConversation(item);
    }

    async listMessages(
        chatGuid: string,
        options: ListMessagesOptions = {}
    ): Promise<ChatMessage[]> {
        const messages = await this.apiClient.post<XChannelMessageDto[]>('/LoadMessages', {
            ChatGuid: chatGuid,
            Take: options.take ?? 50,
            BeforeCreatedAt: options.beforeCreatedAt,
        });
        return (messages ?? []).map((message) => this.mapMessage(message));
    }

    async sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage> {
        const message = await this.apiClient.post<XChannelMessageDto>(
            '/SendMessage',
            {
                chatGuid,
                ...request,
            }
        );
        return this.mapMessage(message);
    }

    async sendInteractiveList(
        chatGuid: string,
        request: SendInteractiveListRequest
    ): Promise<ChatMessage> {
        const message = await this.apiClient.post<XChannelMessageDto>(
            '/SendMessage',
            {
                ChatGuid: chatGuid,
                Body: serializeInteractiveList(request.interactiveList),
            }
        );
        return this.mapMessage(message);
    }

    async uploadAttachment(
        chatGuid: string,
        request: UploadAttachmentRequest
    ): Promise<ChatMessage> {
        const message = await this.apiClient.upload<XChannelMessageDto>(
            `/UploadAttachment?chatGuid=${encodeURIComponent(chatGuid)}`,
            request.file
        );
        return this.mapMessage(message);
    }

    async retryMessage(
        chatGuid: string,
        messageGuid: string
    ): Promise<XChannelMessageStatusUpdateDto> {
        return this.apiClient.post<XChannelMessageStatusUpdateDto>('/RetryMessage', {
            ChatGuid: chatGuid,
            MessageGuid: messageGuid,
        });
    }

    async closeConversation(chatGuid: string): Promise<ConversationSummary> {
        const item = await this.apiClient.post<XChannelChatListItemDto>(
            '/CloseConversation',
            { chatGuid }
        );
        return mapChatListItemDtoToConversation(item);
    }

    private mapMessage(message: XChannelMessageDto): ChatMessage {
        return mapMessageDtoToChatMessage(message, {
            currentUser: this.currentUser,
            currentUserMember: this.currentUserMember,
            resolveAttachmentUrl: (url) => this.apiClient.resolveUrl(url),
        });
    }
}

function toLoadConversationsRequest(
    filters: ConversationListFilters
): LoadConversationsRequest {
    const section = filters.section;
    const tab = filters.tab;

    return {
        Section: section?.raw as LoadConversationsRequest['Section'],
        Tab: tab?.raw as LoadConversationsRequest['Tab'],
        SectionName: section?.name,
        TabName: tab?.name,
        SearchTerm: filters.searchTerm?.trim() || '',
        Take: 50,
    };
}

function toLoadContactsRequest(filters: ContactListFilters): LoadContactsRequest {
    return {
        ContactType: filters.contactType === 'todos' ? '' : filters.contactType,
        SearchTerm: filters.searchTerm?.trim() || '',
        Take: 100,
    };
}

function dedupeConversations(conversations: ConversationSummary[]): ConversationSummary[] {
    const byKey = new Map<string, ConversationSummary>();

    for (const conversation of conversations) {
        const key = getConversationDedupeKey(conversation);
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, conversation);
            continue;
        }

        byKey.set(key, mergeConversationSummary(existing, conversation));
    }

    return Array.from(byKey.values());
}

function getConversationDedupeKey(conversation: ConversationSummary): string {
    if (conversation.chatGuid) {
        return `chat:${conversation.chatGuid.toLowerCase()}`;
    }

    const firstMember = conversation.members[0];
    return [
        'virtual',
        conversation.title.trim().toLowerCase(),
        `${firstMember?.userChatId ?? ''}`,
        `${firstMember?.number ?? ''}`.trim().toLowerCase(),
        `${firstMember?.externalId ?? ''}`.trim().toLowerCase(),
    ].join(':');
}

function mergeConversationSummary(
    current: ConversationSummary,
    next: ConversationSummary
): ConversationSummary {
    return {
        ...current,
        ...next,
        unreadCount: Math.max(current.unreadCount, next.unreadCount),
        destinations: mergeDestinations(current.destinations, next.destinations),
        members: next.members.length ? next.members : current.members,
    };
}

function mergeDestinations(
    current: ConversationSummary['destinations'],
    next: ConversationSummary['destinations']
): ConversationSummary['destinations'] {
    const byKey = new Map<string, ConversationSummary['destinations'][number]>();

    for (const destination of [...current, ...next]) {
        byKey.set(`${destination.sectionGuid ?? ''}:${destination.tabGuid ?? ''}`, destination);
    }

    return Array.from(byKey.values());
}

export function toCreateConversationRequest(
    request: CreateConversationRequest
): Record<string, unknown> {
    return {
        Subject: request.subject,
        VisitorName: request.visitorName,
        VisitorEmail: request.visitorEmail,
        ReceiverChatUsers: request.receiverChatUsers,
    };
}

function normalizeBootstrapResponse(
    response: unknown,
    fallbackVisitorId: string
): BootstrapResponse {
    const settings = readDtoValue<Record<string, unknown>>(response, 'Settings') ?? {};
    const mode = `${readDtoValue<string>(response, 'Mode') ?? 'anonymous'}`.toLowerCase();

    return {
        token: readDtoValue<string>(response, 'Token') ?? '',
        visitorId: readDtoValue<string>(response, 'VisitorId') ?? fallbackVisitorId,
        mode: mode === 'authenticated' ? 'authenticated' : 'anonymous',
        currentUser: mapCurrentUser(response),
        settings: {
            title: readDtoValue<string>(settings, 'Title') ?? 'Atendimento XChannel',
            subtitle: readDtoValue<string>(settings, 'Subtitle') ?? 'Fale com nossa equipe',
            themeColor: readDtoValue<string>(settings, 'ThemeColor') ?? '#2688c7',
            requireIdentity: readDtoValue<boolean>(settings, 'RequireIdentity') ?? true,
            allowAttachments: readDtoValue<boolean>(settings, 'AllowAttachments') ?? true,
            allowMultipleConversations:
                readDtoValue<boolean>(settings, 'AllowMultipleConversations') ?? false,
            pollingIntervalMs: readDtoValue<number>(settings, 'PollingIntervalMs') ?? 5000,
        },
    };
}

function mapCurrentUser(response: unknown): ChatMember | undefined {
    const currentUser = readDtoValue<XChannelChatMemberDto>(response, 'CurrentUser');

    return currentUser ? mapMemberDtoToChatMember(currentUser) : undefined;
}

function serializeInteractiveList(interactiveList: ChatInteractiveList): string {
    return JSON.stringify({
        type: 'interactive_list',
        interactiveList: {
            HeaderText: interactiveList.headerText,
            BodyText: interactiveList.bodyText,
            ButtonText: interactiveList.buttonText,
            Sections: interactiveList.sections.map((section) => ({
                Title: section.title,
                Rows: section.rows.map((row) => ({
                    Id: row.id,
                    Title: row.title,
                    Description: row.description,
                })),
            })),
        },
    });
}
