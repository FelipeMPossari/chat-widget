import type {
  BootstrapResponse,
  ChatMessage,
  ConversationSummary,
} from '../../types';
import type { ChatWidgetConfig, WidgetUserContext } from '../../types';
import type {
  BootstrapRequest,
  CreateConversationRequest,
  SendMessageRequest,
  UploadAttachmentRequest,
  XChannelChatListItemDto,
  XChannelMessageDto,
} from '../../types/api';
import { ApiClient } from './apiClient';
import {
  mapChatListItemDtoToConversation,
  mapMessageDtoToChatMessage,
  readDtoValue,
} from './chatMappers';
import { MockChatApi } from './mockChatApi';

export interface IChatApi {
  bootstrap(request: BootstrapRequest): Promise<BootstrapResponse>;
  listConversations(): Promise<ConversationSummary[]>;
  createConversation(request: CreateConversationRequest): Promise<ConversationSummary>;
  listMessages(chatGuid: string): Promise<ChatMessage[]>;
  sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage>;
  uploadAttachment(chatGuid: string, request: UploadAttachmentRequest): Promise<ChatMessage>;
  closeConversation(chatGuid: string): Promise<ConversationSummary>;
}

export function createChatApi(config: ChatWidgetConfig): IChatApi {
  const authToken = config.authToken || config.user?.token;

  if (config.demoMode || !config.apiBaseUrl) {
    return new MockChatApi(authToken);
  }

  return new HttpChatApi(new ApiClient(config.apiBaseUrl, authToken), config.user, authToken);
}

class HttpChatApi implements IChatApi {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly currentUser?: WidgetUserContext,
    private readonly authToken?: string
  ) {}

  async bootstrap(request: BootstrapRequest): Promise<BootstrapResponse> {
    const response = await this.apiClient.post<unknown>(
      '/StartChatSession',
      request
    );
    const bootstrap = normalizeBootstrapResponse(response, request.visitorId);

    if (!this.authToken && bootstrap.token) {
      this.apiClient.setToken(bootstrap.token);
    }

    return bootstrap;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const items = await this.apiClient.post<XChannelChatListItemDto[]>(
      '/LoadConversations',
      {}
    );
    return (items ?? []).map(mapChatListItemDtoToConversation);
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    const item = await this.apiClient.post<XChannelChatListItemDto>(
      '/CreateConversation',
      request
    );
    return mapChatListItemDtoToConversation(item);
  }

  async listMessages(chatGuid: string): Promise<ChatMessage[]> {
    const messages = await this.apiClient.post<XChannelMessageDto[]>('/LoadMessages', {
      chatGuid,
      take: 50,
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
      resolveAttachmentUrl: (url) => this.apiClient.resolveUrl(url),
    });
  }
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
