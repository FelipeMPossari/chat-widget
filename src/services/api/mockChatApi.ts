import type {
  BootstrapResponse,
  ChatMessage,
  ConversationSummary,
} from '../../types';
import type {
  BootstrapRequest,
  CreateConversationRequest,
  SendMessageRequest,
  UploadAttachmentRequest,
  XChannelChatListItemDto,
  XChannelMessageDto,
} from '../../types/api';
import type { IChatApi } from './chatApi';
import {
  mapChatListItemDtoToConversation,
  mapMessageDtoToChatMessage,
  readDtoValue,
} from './chatMappers';

export class MockChatApi implements IChatApi {
  private conversations: XChannelChatListItemDto[] = [];
  private messagesByConversation = new Map<string, XChannelMessageDto[]>();
  private currentRequest?: BootstrapRequest;

  constructor(private readonly authToken?: string) {}

  async bootstrap(request: BootstrapRequest): Promise<BootstrapResponse> {
    await delay(240);

    this.currentRequest = request;
    const authenticated = this.isAuthenticatedSession(request);

    if (authenticated && this.conversations.length === 0) {
      this.seedAuthenticatedConversations(request);
    }

    return {
      token: `mock-${request.visitorId}`,
      visitorId: request.visitorId,
      mode: authenticated ? 'authenticated' : 'anonymous',
      settings: {
        title: 'Atendimento XChannel',
        subtitle: authenticated
          ? `${request.user?.name || 'Usuario logado'} - ${request.sourceSystem || 'Sistema externo'}`
          : 'Normalmente respondemos em poucos minutos',
        themeColor: '#2688c7',
        requireIdentity: !authenticated,
        allowAttachments: true,
        allowMultipleConversations: authenticated,
        pollingIntervalMs: 4500,
      },
    };
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await delay(180);
    return this.conversations.map(mapChatListItemDtoToConversation);
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    await delay(220);

    const chatGuid = createGuid();
    const createdAt = new Date().toISOString();
    const greeting = `Ola${request.visitorName ? `, ${request.visitorName}` : ''}. Como podemos ajudar?`;
    const conversation: XChannelChatListItemDto = {
      ChatGuid: chatGuid,
      Title: request.subject || 'Nova conversa',
      Channel: 'webwidget',
      Type: 'Widget',
      Status: 'open',
      LastMessage: greeting,
      DateLastMessage: createdAt,
      CreatedAt: createdAt,
      QuantityUnreadMessages: 0,
      Members: [
        {
          Name: request.visitorName || this.currentRequest?.user?.name || 'Visitante',
          ExternalId:
            this.currentRequest?.user?.externalUserId ?? this.currentRequest?.visitorId,
          Type: 'Visitante',
        },
      ],
    };

    this.conversations = [conversation, ...this.conversations];
    this.messagesByConversation.set(chatGuid, [
      createMessageDto(chatGuid, {
        senderName: 'Sistema',
        senderType: 'Sistema',
        body: 'Conversa iniciada no Chat Web.',
        createdAt,
      }),
      createMessageDto(chatGuid, {
        senderName: 'Equipe XChannel',
        senderType: 'Usuario',
        body: greeting,
        createdAt,
      }),
    ]);

    return mapChatListItemDtoToConversation(conversation);
  }

  async listMessages(chatGuid: string): Promise<ChatMessage[]> {
    await delay(160);
    return (this.messagesByConversation.get(chatGuid) ?? []).map((message) =>
      this.mapMessage(message)
    );
  }

  async sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage> {
    await delay(180);

    const message = createMessageDto(chatGuid, {
      senderName: this.currentRequest?.user?.name || 'Visitante',
      senderType: 'Visitante',
      externalId:
        this.currentRequest?.user?.externalUserId ?? this.currentRequest?.visitorId,
      body: request.text,
      status: 'sent',
    });

    this.appendMessage(chatGuid, message);
    this.touchConversation(chatGuid, request.text);

    window.setTimeout(() => {
      const reply = createMessageDto(chatGuid, {
        senderName: 'Equipe XChannel',
        senderType: 'Usuario',
        body: 'Recebemos sua mensagem. Esta resposta vem do modo demo do widget.',
        status: 'sent',
      });

      this.appendMessage(chatGuid, reply);
      this.touchConversation(chatGuid, readDtoValue<string>(reply, 'Body'));
    }, 1200);

    return this.mapMessage(message);
  }

  async uploadAttachment(
    chatGuid: string,
    request: UploadAttachmentRequest
  ): Promise<ChatMessage> {
    await delay(300);

    const message = createMessageDto(chatGuid, {
      senderName: this.currentRequest?.user?.name || 'Visitante',
      senderType: 'Visitante',
      externalId:
        this.currentRequest?.user?.externalUserId ?? this.currentRequest?.visitorId,
      body: request.file.name,
      status: 'sent',
      attachment: {
        Guid: createGuid(),
        FileName: request.file.name,
        MimeType: request.file.type || 'application/octet-stream',
        SizeBytes: request.file.size,
        Url: URL.createObjectURL(request.file),
      },
    });

    this.appendMessage(chatGuid, message);
    this.touchConversation(chatGuid, request.file.name);

    return this.mapMessage(message);
  }

  async closeConversation(chatGuid: string): Promise<ConversationSummary> {
    await delay(180);

    this.conversations = this.conversations.map((conversation) =>
      readDtoValue<string>(conversation, 'ChatGuid') === chatGuid
        ? { ...conversation, Status: 'closed', QuantityUnreadMessages: 0 }
        : conversation
    );

    const conversation = this.conversations.find(
      (item) => readDtoValue<string>(item, 'ChatGuid') === chatGuid
    );

    if (!conversation) {
      throw new Error('Conversa nao encontrada.');
    }

    return mapChatListItemDtoToConversation(conversation);
  }

  private mapMessage(message: XChannelMessageDto): ChatMessage {
    return mapMessageDtoToChatMessage(message, {
      currentUser: this.currentRequest?.user,
    });
  }

  private appendMessage(chatGuid: string, message: XChannelMessageDto): void {
    this.messagesByConversation.set(chatGuid, [
      ...(this.messagesByConversation.get(chatGuid) ?? []),
      message,
    ]);
  }

  private touchConversation(chatGuid: string, lastMessage?: string): void {
    this.conversations = this.conversations.map((conversation) =>
      readDtoValue<string>(conversation, 'ChatGuid') === chatGuid
        ? {
            ...conversation,
            LastMessage: lastMessage,
            DateLastMessage: new Date().toISOString(),
          }
        : conversation
    );
  }

  private seedAuthenticatedConversations(request: BootstrapRequest): void {
    const now = new Date();
    const userName = request.user?.name || 'Usuario logado';
    const activeChatGuid = createGuid();
    const closedChatGuid = createGuid();

    this.conversations = [
      {
        ChatGuid: activeChatGuid,
        Title: 'Suporte do portal',
        Channel: 'webwidget',
        Type: 'Widget',
        Status: 'open',
        LastMessage: 'Podemos continuar por aqui quando precisar.',
        DateLastMessage: now.toISOString(),
        CreatedAt: now.toISOString(),
        QuantityUnreadMessages: 1,
        Members: [
          {
            Name: userName,
            ExternalId: request.user?.externalUserId,
            Type: 'Visitante',
          },
        ],
      },
      {
        ChatGuid: closedChatGuid,
        Title: 'Duvida sobre contrato XC-1042',
        Channel: 'webwidget',
        Type: 'Widget',
        Status: 'closed',
        LastMessage: 'Atendimento encerrado.',
        DateLastMessage: new Date(now.getTime() - 86400000).toISOString(),
        CreatedAt: new Date(now.getTime() - 90000000).toISOString(),
        QuantityUnreadMessages: 0,
        Members: [
          {
            Name: userName,
            ExternalId: request.user?.externalUserId,
            Type: 'Visitante',
          },
        ],
      },
    ];

    this.messagesByConversation.set(activeChatGuid, [
      createMessageDto(activeChatGuid, {
        senderName: 'Sistema',
        senderType: 'Sistema',
        body: `Sessao autenticada recebida de ${request.sourceSystem || 'sistema externo'}.`,
        createdAt: now.toISOString(),
      }),
      createMessageDto(activeChatGuid, {
        senderName: 'Equipe XChannel',
        senderType: 'Usuario',
        body: `Ola, ${userName}. Encontramos seu cadastro e suas conversas recentes.`,
        createdAt: now.toISOString(),
      }),
      createMessageDto(activeChatGuid, {
        senderName: 'Equipe XChannel',
        senderType: 'Usuario',
        body: 'Podemos continuar por aqui quando precisar.',
        createdAt: now.toISOString(),
      }),
    ]);

    this.messagesByConversation.set(closedChatGuid, [
      createMessageDto(closedChatGuid, {
        senderName: userName,
        senderType: 'Visitante',
        externalId: request.user?.externalUserId,
        body: 'Preciso consultar informacoes do contrato XC-1042.',
        createdAt: new Date(now.getTime() - 90000000).toISOString(),
      }),
      createMessageDto(closedChatGuid, {
        senderName: 'Equipe XChannel',
        senderType: 'Usuario',
        body: 'Contrato localizado. Enviamos o resumo para seu e-mail.',
        createdAt: new Date(now.getTime() - 89900000).toISOString(),
      }),
      createMessageDto(closedChatGuid, {
        senderName: 'Sistema',
        senderType: 'Sistema',
        body: 'Atendimento encerrado.',
        createdAt: new Date(now.getTime() - 89800000).toISOString(),
      }),
    ]);
  }

  private isAuthenticatedSession(request: BootstrapRequest): boolean {
    if (request.user?.externalUserId || request.user?.name || request.user?.email) {
      return true;
    }

    if (!this.authToken) {
      return false;
    }

    return !/anon|anonymous|landing/i.test(this.authToken);
  }
}

interface CreateMessageDtoParams {
  senderName: string;
  senderType: string;
  externalId?: string;
  body?: string;
  createdAt?: string;
  status?: string;
  attachment?: XChannelMessageDto['Attachment'];
}

function createMessageDto(
  chatGuid: string,
  params: CreateMessageDtoParams
): XChannelMessageDto {
  return {
    MessageGuid: createGuid(),
    ChatGuid: chatGuid,
    SenderUser: {
      Name: params.senderName,
      Type: params.senderType,
      ExternalId: params.externalId,
    },
    Body: params.body,
    CreatedAt: params.createdAt ?? new Date().toISOString(),
    Status: params.status,
    Attachment: params.attachment,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createGuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
