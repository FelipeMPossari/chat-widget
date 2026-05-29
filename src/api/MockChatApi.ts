import type { ChatApi } from './ChatApi';
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

export class MockChatApi implements ChatApi {
  private conversations: ConversationSummary[] = [];
  private messagesByConversation = new Map<string, ChatMessage[]>();

  async bootstrap(request: BootstrapRequest): Promise<BootstrapResponse> {
    await delay(240);

    return {
      token: `mock-${request.visitorId}`,
      visitorId: request.visitorId,
      mode: request.user?.externalUserId || request.user?.token ? 'authenticated' : 'anonymous',
      settings: {
        title: 'Atendimento XChannel',
        subtitle: 'Normalmente respondemos em poucos minutos',
        themeColor: '#2688c7',
        requireIdentity: true,
        allowAttachments: true,
        allowMultipleConversations: Boolean(request.user?.externalUserId || request.user?.token),
        pollingIntervalMs: 4500,
      },
    };
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await delay(180);
    return [...this.conversations];
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    await delay(220);

    const chatGuid = crypto.randomUUID();
    const conversation: ConversationSummary = {
      chatGuid,
      title: request.subject || 'Nova conversa',
      status: 'open',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };

    this.conversations = [conversation, ...this.conversations];
    this.messagesByConversation.set(chatGuid, [
      {
        id: crypto.randomUUID(),
        chatGuid,
        authorType: 'system',
        text: 'Conversa iniciada no Chat Web.',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        chatGuid,
        authorType: 'agent',
        authorName: 'Equipe XChannel',
        text: `Ola${request.visitorName ? `, ${request.visitorName}` : ''}. Como podemos ajudar?`,
        createdAt: new Date().toISOString(),
      },
    ]);

    return conversation;
  }

  async listMessages(chatGuid: string): Promise<ChatMessage[]> {
    await delay(160);
    return [...(this.messagesByConversation.get(chatGuid) ?? [])];
  }

  async sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage> {
    await delay(180);

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      chatGuid,
      authorType: 'visitor',
      text: request.text,
      createdAt: new Date().toISOString(),
    };

    this.messagesByConversation.set(chatGuid, [
      ...(this.messagesByConversation.get(chatGuid) ?? []),
      message,
    ]);
    this.touchConversation(chatGuid, request.text);

    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        chatGuid,
        authorType: 'agent',
        authorName: 'Equipe XChannel',
        text: 'Recebemos sua mensagem. Esta resposta vem do modo demo do widget.',
        createdAt: new Date().toISOString(),
      };

      this.messagesByConversation.set(chatGuid, [
        ...(this.messagesByConversation.get(chatGuid) ?? []),
        reply,
      ]);
      this.touchConversation(chatGuid, reply.text);
    }, 1200);

    return message;
  }

  async uploadAttachment(
    chatGuid: string,
    request: UploadAttachmentRequest
  ): Promise<ChatAttachment> {
    await delay(300);

    const attachment: ChatAttachment = {
      id: crypto.randomUUID(),
      fileName: request.file.name,
      contentType: request.file.type || 'application/octet-stream',
      size: request.file.size,
      url: URL.createObjectURL(request.file),
    };

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      chatGuid,
      authorType: 'visitor',
      attachments: [attachment],
      createdAt: new Date().toISOString(),
    };

    this.messagesByConversation.set(chatGuid, [
      ...(this.messagesByConversation.get(chatGuid) ?? []),
      message,
    ]);
    this.touchConversation(chatGuid, attachment.fileName);

    return attachment;
  }

  async closeConversation(chatGuid: string): Promise<ConversationSummary> {
    await delay(180);

    this.conversations = this.conversations.map((conversation) =>
      conversation.chatGuid === chatGuid
        ? { ...conversation, status: 'closed' as const, unreadCount: 0 }
        : conversation
    );

    return this.conversations.find((conversation) => conversation.chatGuid === chatGuid)!;
  }

  private touchConversation(chatGuid: string, lastMessage?: string): void {
    this.conversations = this.conversations.map((conversation) =>
      conversation.chatGuid === chatGuid
        ? {
            ...conversation,
            lastMessage,
            lastMessageAt: new Date().toISOString(),
          }
        : conversation
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

