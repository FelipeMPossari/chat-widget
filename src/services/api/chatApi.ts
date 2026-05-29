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
    const response = await this.apiClient.post<BootstrapResponse>('/bootstrap', request);
    if (!this.authToken && response.token) {
      this.apiClient.setToken(response.token);
    }
    return response;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const items = await this.apiClient.get<XChannelChatListItemDto[]>('/conversations');
    return (items ?? []).map(mapChatListItemDtoToConversation);
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    const item = await this.apiClient.post<XChannelChatListItemDto>('/conversations', request);
    return mapChatListItemDtoToConversation(item);
  }

  async listMessages(chatGuid: string): Promise<ChatMessage[]> {
    const messages = await this.apiClient.get<XChannelMessageDto[]>(
      `/conversations/${chatGuid}/messages`
    );
    return (messages ?? []).map((message) => this.mapMessage(message));
  }

  async sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage> {
    const message = await this.apiClient.post<XChannelMessageDto>(
      `/conversations/${chatGuid}/messages`,
      request
    );
    return this.mapMessage(message);
  }

  async uploadAttachment(
    chatGuid: string,
    request: UploadAttachmentRequest
  ): Promise<ChatMessage> {
    const message = await this.apiClient.upload<XChannelMessageDto>(
      `/conversations/${chatGuid}/attachments`,
      request.file
    );
    return this.mapMessage(message);
  }

  async closeConversation(chatGuid: string): Promise<ConversationSummary> {
    const item = await this.apiClient.post<XChannelChatListItemDto>(
      `/conversations/${chatGuid}/close`
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
