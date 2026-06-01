import type {
  BootstrapResponse,
  ChatSection,
  ChatMessage,
  ConversationListFilters,
  ConversationSummary,
} from '../../types';
import type {
  BootstrapRequest,
  CreateConversationRequest,
  SendMessageRequest,
  UploadAttachmentRequest,
  XChannelChatDestinationDto,
  XChannelChatListItemDto,
  XChannelChatMemberDto,
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
      currentUser: authenticated
        ? {
            id: 1,
            userChatId: 1,
            name: request.user?.name || 'Usuario logado',
            type: 'Usuario',
            raw: {
              Id: 1,
              UserChatId: 1,
              Name: request.user?.name || 'Usuario logado',
              Type: 'Usuario',
            },
          }
        : undefined,
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

  async listSections(): Promise<ChatSection[]> {
    await delay(120);
    return MOCK_SECTIONS;
  }

  async listConversations(filters: ConversationListFilters = {}): Promise<ConversationSummary[]> {
    await delay(180);
    return this.conversations
      .filter((conversation) => matchesConversationFilters(conversation, filters))
      .map(mapChatListItemDtoToConversation);
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    await delay(220);

    const chatGuid = createGuid();
    const createdAt = new Date().toISOString();
    const receiver = request.receiverChatUsers?.[0];
    const receiverName = readDtoValue<string>(receiver, 'Name');
    const visitorName = request.visitorName || this.currentRequest?.user?.name || 'Visitante';
    const greeting = receiverName
      ? `Conversa iniciada com ${receiverName}.`
      : `Ola${request.visitorName ? `, ${request.visitorName}` : ''}. Como podemos ajudar?`;
    const conversation: XChannelChatListItemDto = {
      ChatGuid: chatGuid,
      Title: receiverName || request.subject || 'Nova conversa',
      Channel: 'xchannel',
      Type: 'Individual',
      Status: 'open',
      LastMessage: greeting,
      DateLastMessage: createdAt,
      CreatedAt: createdAt,
      QuantityUnreadMessages: 0,
      Destinations: [{ SectionGuid: 'chat', TabGuid: 'ativos' }],
      Members: [
        {
          Name: visitorName,
          ExternalId:
            this.currentRequest?.user?.externalUserId ?? this.currentRequest?.visitorId,
          Type: 'Usuario',
        },
        ...(receiver ? [receiver] : []),
      ],
    };

    this.conversations = [
      conversation,
      ...this.conversations.filter((item) => !isSameVirtualReceiver(item, receiver)),
    ];
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
    const whatsappChatGuid = createGuid();
    const instagramChatGuid = createGuid();

    this.conversations = [
      {
        ChatGuid: activeChatGuid,
        Title: 'Suporte do portal',
        Channel: 'xchannel',
        Type: 'Individual',
        Status: 'open',
        LastMessage: 'Podemos continuar por aqui quando precisar.',
        DateLastMessage: now.toISOString(),
        CreatedAt: now.toISOString(),
        QuantityUnreadMessages: 1,
        Destinations: [{ SectionGuid: 'chat', TabGuid: 'ativos' }],
        Members: [
          {
            Name: userName,
            ExternalId: request.user?.externalUserId,
            Type: 'Visitante',
          },
        ],
      },
      {
        ChatGuid: whatsappChatGuid,
        Title: 'Cliente WhatsApp',
        Channel: 'whatsapp',
        Type: 'Individual',
        Status: 'open',
        LastMessage: 'Preciso da segunda via do boleto.',
        DateLastMessage: new Date(now.getTime() - 3600000).toISOString(),
        CreatedAt: new Date(now.getTime() - 7200000).toISOString(),
        QuantityUnreadMessages: 0,
        Destinations: [{ SectionGuid: 'whatsapp', TabGuid: 'espera' }],
        Members: [
          {
            Name: 'Cliente WhatsApp',
            Type: 'Pessoa',
          },
        ],
      },
      {
        ChatGuid: instagramChatGuid,
        Title: 'Lead Instagram',
        Channel: 'instagram',
        Type: 'Individual',
        Status: 'open',
        LastMessage: 'Vi o produto no perfil de voces.',
        DateLastMessage: new Date(now.getTime() - 5400000).toISOString(),
        CreatedAt: new Date(now.getTime() - 9200000).toISOString(),
        QuantityUnreadMessages: 0,
        Destinations: [{ SectionGuid: 'instagram', TabGuid: 'vendas' }],
        Members: [
          {
            Name: 'Lead Instagram',
            Type: 'Pessoa',
          },
        ],
      },
      createVirtualUserConversation('101', 'Ana Souza'),
      createVirtualUserConversation('102', 'Bruno Lima'),
      createVirtualUserConversation('103', 'Carla Mendes'),
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

    this.messagesByConversation.set(whatsappChatGuid, [
      createMessageDto(whatsappChatGuid, {
        senderName: 'Cliente WhatsApp',
        senderType: 'Pessoa',
        body: 'Preciso da segunda via do boleto.',
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
      }),
    ]);

    this.messagesByConversation.set(instagramChatGuid, [
      createMessageDto(instagramChatGuid, {
        senderName: 'Lead Instagram',
        senderType: 'Pessoa',
        body: 'Vi o produto no perfil de voces.',
        createdAt: new Date(now.getTime() - 5400000).toISOString(),
      }),
      createMessageDto(instagramChatGuid, {
        senderName: userName,
        senderType: 'Usuario',
        body: 'Pode me passar o melhor telefone para contato?',
        createdAt: new Date(now.getTime() - 5300000).toISOString(),
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

const MOCK_SECTIONS: ChatSection[] = [
  {
    sectionGuid: 'chat',
    name: 'Chat',
    order: 1,
    totalUnread: 1,
    tabs: [
      {
        tabGuid: 'ativos',
        name: 'Ativos',
        order: 1,
        state: 'Virtual',
        totalUnread: 1,
        raw: { TabGuid: 'ativos', Name: 'Ativos', Order: 1, State: 'Virtual', TotalUnread: 1 },
      },
    ],
    raw: { SectionGuid: 'chat', Name: 'Chat', Order: 1, TotalUnread: 1 },
  },
  {
    sectionGuid: 'whatsapp',
    name: 'Whatsapp',
    order: 2,
    totalUnread: 0,
    tabs: [
      {
        tabGuid: 'espera',
        name: 'Espera',
        order: 1,
        state: 'Virtual',
        totalUnread: 0,
        raw: { TabGuid: 'espera', Name: 'Espera', Order: 1, State: 'Virtual', TotalUnread: 0 },
      },
      {
        tabGuid: 'suporte',
        name: 'Suporte',
        order: 2,
        totalUnread: 0,
        raw: { TabGuid: 'suporte', Name: 'Suporte', Order: 2, TotalUnread: 0 },
      },
    ],
    raw: { SectionGuid: 'whatsapp', Name: 'Whatsapp', Order: 2, TotalUnread: 0 },
  },
  {
    sectionGuid: 'instagram',
    name: 'Instagram',
    order: 3,
    totalUnread: 0,
    tabs: [
      {
        tabGuid: 'espera-instagram',
        name: 'Espera',
        order: 1,
        state: 'Virtual',
        totalUnread: 0,
        raw: { TabGuid: 'espera-instagram', Name: 'Espera', Order: 1, State: 'Virtual', TotalUnread: 0 },
      },
      {
        tabGuid: 'vendas',
        name: 'Vendas',
        order: 2,
        totalUnread: 0,
        raw: { TabGuid: 'vendas', Name: 'Vendas', Order: 2, TotalUnread: 0 },
      },
    ],
    raw: { SectionGuid: 'instagram', Name: 'Instagram', Order: 3, TotalUnread: 0 },
  },
];

function matchesConversationFilters(
  conversation: XChannelChatListItemDto,
  filters: ConversationListFilters
): boolean {
  const destinations =
    readDtoValue<XChannelChatDestinationDto[]>(conversation, 'Destinations') ?? [];
  const sectionGuid = filters.section?.sectionGuid;
  const tabGuid = filters.tab?.tabGuid;
  const searchTerm = filters.searchTerm?.trim().toLowerCase();

  if (sectionGuid) {
    const hasSection = destinations.some(
      (destination) =>
        readDtoValue<string>(destination, 'SectionGuid') === sectionGuid
    );

    if (!hasSection) {
      return false;
    }
  }

  if (tabGuid) {
    const hasTab = destinations.some(
      (destination) => readDtoValue<string>(destination, 'TabGuid') === tabGuid
    );

    if (!hasTab) {
      return false;
    }
  }

  if (!searchTerm) {
    return true;
  }

  const title = readDtoValue<string>(conversation, 'Title') ?? '';
  const lastMessage = readDtoValue<string>(conversation, 'LastMessage') ?? '';

  return `${title} ${lastMessage}`.toLowerCase().includes(searchTerm);
}

function createVirtualUserConversation(id: string, name: string): XChannelChatListItemDto {
  const now = new Date().toISOString();

  return {
    ChatGuid: createGuid(),
    Title: name,
    Channel: 'xchannel',
    Type: 'Individual',
    Status: 'open',
    LastMessage: '',
    DateLastMessage: now,
    CreatedAt: now,
    QuantityUnreadMessages: 0,
    IsVirtual: true,
    Destinations: [{ SectionGuid: 'chat', TabGuid: 'usuarios' }],
    Members: [
      {
        Id: Number(id),
        Name: name,
        Type: 'Usuario',
      },
    ],
  };
}

function isSameVirtualReceiver(
  conversation: XChannelChatListItemDto,
  receiver?: XChannelChatMemberDto
): boolean {
  if (!receiver || !readDtoValue<boolean>(conversation, 'IsVirtual')) {
    return false;
  }

  const receiverId = readDtoValue<number>(receiver, 'Id');
  const receiverName = readDtoValue<string>(receiver, 'Name');
  const members = readDtoValue<XChannelChatMemberDto[]>(conversation, 'Members') ?? [];

  return members.some((member) => {
    const memberId = readDtoValue<number>(member, 'Id');
    const memberName = readDtoValue<string>(member, 'Name');

    return (
      (receiverId != null && memberId === receiverId) ||
      (!!receiverName && memberName === receiverName)
    );
  });
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
