import type {
  BootstrapRequest,
  BootstrapResponse,
  ChatAttachment,
  ChatMessage,
  ConversationSummary,
  CreateConversationRequest,
  SendMessageRequest,
  UploadAttachmentRequest,
} from '../types';

export interface ChatApi {
  bootstrap(request: BootstrapRequest): Promise<BootstrapResponse>;
  listConversations(): Promise<ConversationSummary[]>;
  createConversation(request: CreateConversationRequest): Promise<ConversationSummary>;
  listMessages(chatGuid: string): Promise<ChatMessage[]>;
  sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage>;
  uploadAttachment(chatGuid: string, request: UploadAttachmentRequest): Promise<ChatAttachment>;
  closeConversation(chatGuid: string): Promise<ConversationSummary>;
}

