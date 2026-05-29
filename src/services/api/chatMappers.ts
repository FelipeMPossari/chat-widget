import type {
  ChatAttachment,
  ChatAuthorType,
  ChatMessage,
  ConversationStatus,
  ConversationSummary,
  WidgetUserContext,
} from '../../types';
import type {
  XChannelChatAttachmentDto,
  XChannelChatListItemDto,
  XChannelChatMemberDto,
  XChannelMessageDto,
} from '../../types/api';

interface MapMessageOptions {
  currentUser?: WidgetUserContext;
  resolveAttachmentUrl?: (url: string) => string;
}

export function mapChatListItemDtoToConversation(
  item: XChannelChatListItemDto
): ConversationSummary {
  const chatGuid = readDtoValue<string>(item, 'ChatGuid') ?? createGuid();
  const title = readDtoValue<string>(item, 'Title') ?? 'Atendimento';
  const lastMessageIsDeleted =
    readDtoValue<boolean>(item, 'LastMessageIsDeleted') ?? false;
  const lastMessage = lastMessageIsDeleted
    ? 'Mensagem removida.'
    : readDtoValue<string>(item, 'LastMessage');

  return {
    chatGuid,
    title,
    status: normalizeConversationStatus(readDtoValue<string>(item, 'Status')),
    lastMessage,
    lastMessageAt: toMessageDate(
      readDtoValue<string>(item, 'DateLastMessage') ??
        readDtoValue<string>(item, 'LastMessageAt') ??
        readDtoValue<string>(item, 'CreatedAt')
    ),
    unreadCount:
      readDtoValue<number>(item, 'QuantityUnreadMessages') ??
      readDtoValue<number>(item, 'UnreadCount') ??
      0,
    raw: item,
  };
}

export function mapMessageDtoToChatMessage(
  message: XChannelMessageDto,
  options: MapMessageOptions = {}
): ChatMessage {
  const sender = readDtoValue<XChannelChatMemberDto>(message, 'SenderUser');
  const isDeleted = readDtoValue<boolean>(message, 'IsDeleted') ?? false;
  const text = isDeleted
    ? 'Mensagem removida.'
    : getInteractiveListText(message) ?? readDtoValue<string>(message, 'Body');
  const attachments = collectAttachments(message)
    .map((attachment) => mapAttachmentDtoToChatAttachment(attachment, options))
    .filter(Boolean) as ChatAttachment[];

  return {
    id: readDtoValue<string>(message, 'MessageGuid') ?? createGuid(),
    chatGuid: readDtoValue<string>(message, 'ChatGuid') ?? '',
    authorType: inferAuthorType(sender, options.currentUser),
    authorName: readDtoValue<string>(sender, 'Name'),
    text,
    attachments: attachments.length ? attachments : undefined,
    createdAt: toMessageDate(readDtoValue<string>(message, 'CreatedAt')),
    status: readDtoValue<string>(message, 'Status'),
    raw: message,
  };
}

export function mapAttachmentDtoToChatAttachment(
  attachment: XChannelChatAttachmentDto,
  options: Pick<MapMessageOptions, 'resolveAttachmentUrl'> = {}
): ChatAttachment | undefined {
  const fileName =
    readDtoValue<string>(attachment, 'FileName') ??
    readDtoValue<string>(attachment, 'Name') ??
    'arquivo';
  const url = readDtoValue<string>(attachment, 'Url') ?? '';

  return {
    id:
      readDtoValue<string>(attachment, 'Guid') ??
      readDtoValue<string>(attachment, 'AttachmentGuid') ??
      createGuid(),
    fileName,
    contentType:
      readDtoValue<string>(attachment, 'MimeType') ??
      readDtoValue<string>(attachment, 'ContentType') ??
      'application/octet-stream',
    url: url && options.resolveAttachmentUrl ? options.resolveAttachmentUrl(url) : url,
    size:
      readDtoValue<number>(attachment, 'SizeBytes') ??
      readDtoValue<number>(attachment, 'Size') ??
      0,
  };
}

export function readDtoValue<T>(value: unknown, key: string): T | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const object = value as Record<string, T | undefined>;
  const camelKey = key.charAt(0).toLowerCase() + key.slice(1);

  return object[key] ?? object[camelKey];
}

export function toMessageDate(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!value) {
    return new Date().toISOString();
  }

  const serializedDate = /\/Date\((\d+)\)\//.exec(value);

  if (serializedDate?.[1]) {
    return new Date(Number(serializedDate[1])).toISOString();
  }

  const brazilianDate =
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      value
    );

  if (brazilianDate) {
    const [
      ,
      day,
      month,
      year,
      hour = '00',
      minute = '00',
      second = '00',
    ] = brazilianDate;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).toISOString();
  }

  return value;
}

function normalizeConversationStatus(value?: string): ConversationStatus {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === 'closed' ||
    normalized === 'close' ||
    normalized === 'fechado' ||
    normalized === 'finalizado' ||
    normalized === 'encerrado'
  ) {
    return 'closed';
  }

  return 'open';
}

function inferAuthorType(
  sender?: XChannelChatMemberDto,
  currentUser?: WidgetUserContext
): ChatAuthorType {
  if (!sender) {
    return 'system';
  }

  const senderType = `${readDtoValue<string | number>(sender, 'Type') ?? ''}`.toLowerCase();
  const externalId = readDtoValue<string>(sender, 'ExternalId');
  const senderName = readDtoValue<string>(sender, 'Name');

  if (currentUser?.externalUserId && externalId === currentUser.externalUserId) {
    return 'visitor';
  }

  if (currentUser?.name && senderName === currentUser.name) {
    return 'visitor';
  }

  if (
    senderType.includes('visit') ||
    senderType.includes('pessoa') ||
    senderType.includes('cliente') ||
    senderType.includes('contato') ||
    senderType.includes('external')
  ) {
    return 'visitor';
  }

  if (senderType.includes('system') || senderType.includes('sistema')) {
    return 'system';
  }

  return 'agent';
}

function collectAttachments(message: XChannelMessageDto): XChannelChatAttachmentDto[] {
  const attachment = readDtoValue<XChannelChatAttachmentDto>(message, 'Attachment');
  const attachments = readDtoValue<XChannelChatAttachmentDto[]>(message, 'Attachments') ?? [];

  return [attachment, ...attachments].filter(Boolean) as XChannelChatAttachmentDto[];
}

function getInteractiveListText(message: XChannelMessageDto): string | undefined {
  const interactiveList = readDtoValue<Record<string, unknown>>(message, 'InteractiveList');

  if (interactiveList) {
    return (
      readDtoValue<string>(interactiveList, 'BodyText') ??
      readDtoValue<string>(interactiveList, 'Body')
    );
  }

  const body = readDtoValue<string>(message, 'Body');

  if (!body) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const type = `${parsed.type ?? parsed.Type ?? ''}`.toLowerCase();

    if (type !== 'interactive_list') {
      return undefined;
    }

    const parsedList = (parsed.interactiveList ?? parsed.InteractiveList) as
      | Record<string, unknown>
      | undefined;

    return (
      readDtoValue<string>(parsedList, 'BodyText') ??
      readDtoValue<string>(parsedList, 'Body')
    );
  } catch {
    return undefined;
  }
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
