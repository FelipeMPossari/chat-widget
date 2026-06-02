import type {
  ChatAttachment,
  ChatAuthorType,
  ChatDestination,
  ChatInteractiveList,
  ChatMember,
  ChatMessage,
  ChatSection,
  ChatTab,
  ConversationStatus,
  ConversationSummary,
  WidgetUserContext,
} from '../../types';
import type {
  XChannelChatAttachmentDto,
  XChannelChatDestinationDto,
  XChannelChatListItemDto,
  XChannelChatMemberDto,
  XChannelChatSectionDto,
  XChannelChatTabDto,
  XChannelChatInteractiveListDto,
  XChannelMessageDto,
} from '../../types/api';

interface MapMessageOptions {
  currentUser?: WidgetUserContext;
  currentUserMember?: ChatMember;
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
  const members = readDtoValue<XChannelChatMemberDto[]>(item, 'Members') ?? [];
  const destinations =
    readDtoValue<XChannelChatDestinationDto[]>(item, 'Destinations') ?? [];

  return {
    chatGuid,
    title,
    channel: readDtoValue<string>(item, 'Channel') ?? readDtoValue<string>(item, 'System'),
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
    isVirtual: readDtoValue<boolean>(item, 'IsVirtual') ?? false,
    members: members.map(mapMemberDtoToChatMember),
    destinations: destinations.map(mapDestinationDtoToChatDestination),
    raw: item,
  };
}

export function mapMemberDtoToChatMember(member: XChannelChatMemberDto): ChatMember {
  return {
    id: readDtoValue<number>(member, 'Id'),
    userChatId: readDtoValue<number>(member, 'UserChatId'),
    name: readDtoValue<string>(member, 'Name'),
    type: readDtoValue<string | number>(member, 'Type'),
    number: readDtoValue<string>(member, 'Number'),
    externalId: readDtoValue<string>(member, 'ExternalId'),
    raw: member,
  };
}

export function mapDestinationDtoToChatDestination(
  destination: XChannelChatDestinationDto
): ChatDestination {
  return {
    sectionGuid: readDtoValue<string>(destination, 'SectionGuid'),
    tabGuid: readDtoValue<string>(destination, 'TabGuid'),
    raw: destination,
  };
}

export function mapSectionDtoToChatSection(
  section: XChannelChatSectionDto
): ChatSection {
  const tabs = readDtoValue<XChannelChatTabDto[]>(section, 'Tabs') ?? [];

  return {
    sectionGuid: readDtoValue<string>(section, 'SectionGuid') ?? '',
    name: readDtoValue<string>(section, 'Name') ?? '',
    order: readDtoValue<number>(section, 'Order') ?? 0,
    icon: readDtoValue<string>(section, 'Icon'),
    totalUnread: readDtoValue<number>(section, 'TotalUnread') ?? 0,
    tabs: tabs.map(mapTabDtoToChatTab),
    raw: section,
  };
}

export function mapTabDtoToChatTab(tab: XChannelChatTabDto): ChatTab {
  return {
    tabGuid: readDtoValue<string>(tab, 'TabGuid') ?? '',
    name: readDtoValue<string>(tab, 'Name') ?? '',
    order: readDtoValue<number>(tab, 'Order') ?? 0,
    state: readDtoValue<string>(tab, 'State'),
    totalUnread: readDtoValue<number>(tab, 'TotalUnread') ?? 0,
    raw: tab,
  };
}

export function mapMessageDtoToChatMessage(
  message: XChannelMessageDto,
  options: MapMessageOptions = {}
): ChatMessage {
  const sender = readDtoValue<XChannelChatMemberDto>(message, 'SenderUser');
  const isDeleted = readDtoValue<boolean>(message, 'IsDeleted') ?? false;
  const interactiveList = isDeleted ? undefined : parseInteractiveList(message);
  const text = isDeleted
    ? 'Mensagem removida.'
    : interactiveList?.bodyText ?? readDtoValue<string>(message, 'Body');
  const attachments = collectAttachments(message)
    .map((attachment) => mapAttachmentDtoToChatAttachment(attachment, options))
    .filter(Boolean) as ChatAttachment[];

  return {
    id: readDtoValue<string>(message, 'MessageGuid') ?? createGuid(),
    chatGuid: readDtoValue<string>(message, 'ChatGuid') ?? '',
    authorType: inferAuthorType(sender, options.currentUser, options.currentUserMember),
    authorName: readDtoValue<string>(sender, 'Name'),
    text,
    attachments: attachments.length ? attachments : undefined,
    interactiveList,
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
  currentUser?: WidgetUserContext,
  currentUserMember?: ChatMember
): ChatAuthorType {
  if (!sender) {
    return 'system';
  }

  if (isCurrentUserSender(sender, currentUserMember)) {
    return 'visitor';
  }

  const senderType = `${readDtoValue<string | number>(sender, 'Type') ?? ''}`.toLowerCase();
  const externalId = readDtoValue<string>(sender, 'ExternalId');
  const senderName = readDtoValue<string>(sender, 'Name');

  if (senderType.includes('system') || senderType.includes('sistema')) {
    return 'system';
  }

  if (currentUserMember) {
    if (currentUser?.name && senderName === currentUser.name) {
      return 'visitor';
    }

    return 'agent';
  }

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

  return 'agent';
}

function isCurrentUserSender(
  sender: XChannelChatMemberDto,
  currentUserMember?: ChatMember
): boolean {
  if (!currentUserMember) {
    return false;
  }

  const senderUserChatId = readDtoValue<number>(sender, 'UserChatId');
  const senderId = readDtoValue<number>(sender, 'Id');
  const senderType = `${readDtoValue<string | number>(sender, 'Type') ?? ''}`.toLowerCase();
  const currentType = `${currentUserMember.type ?? ''}`.toLowerCase();

  if (
    currentUserMember.userChatId != null &&
    senderUserChatId != null &&
    currentUserMember.userChatId === senderUserChatId
  ) {
    return true;
  }

  if (
    currentUserMember.id != null &&
    senderId != null &&
    currentUserMember.id === senderId &&
    senderType === currentType
  ) {
    return true;
  }

  return false;
}

function collectAttachments(message: XChannelMessageDto): XChannelChatAttachmentDto[] {
  const attachment = readDtoValue<XChannelChatAttachmentDto>(message, 'Attachment');
  const attachments = readDtoValue<XChannelChatAttachmentDto[]>(message, 'Attachments') ?? [];

  return [attachment, ...attachments].filter(Boolean) as XChannelChatAttachmentDto[];
}

function parseInteractiveList(message: XChannelMessageDto): ChatInteractiveList | undefined {
  const interactiveList = readDtoValue<XChannelChatInteractiveListDto>(message, 'InteractiveList');

  if (interactiveList) {
    return normalizeInteractiveList(interactiveList);
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
      | XChannelChatInteractiveListDto
      | undefined;

    return normalizeInteractiveList(parsedList);
  } catch {
    return undefined;
  }
}

function normalizeInteractiveList(
  list?: XChannelChatInteractiveListDto
): ChatInteractiveList | undefined {
  if (!list) {
    return undefined;
  }

  const sections = readDtoValue<XChannelChatInteractiveListDto['Sections']>(list, 'Sections') ?? [];
  const bodyText =
    readDtoValue<string>(list, 'BodyText') ??
    readDtoValue<string>(list, 'Body') ??
    '';
  const buttonText = readDtoValue<string>(list, 'ButtonText') ?? 'Ver opções';

  if (!bodyText.trim()) {
    return undefined;
  }

  return {
    headerText:
      readDtoValue<string>(list, 'HeaderText') ??
      readDtoValue<string>(list, 'Title'),
    bodyText,
    buttonText,
    sections: sections.map((section) => {
      const rows =
        readDtoValue<NonNullable<XChannelChatInteractiveListDto['Sections']>[number]['Rows']>(
          section,
          'Rows'
        ) ??
        readDtoValue<NonNullable<XChannelChatInteractiveListDto['Sections']>[number]['Items']>(
          section,
          'Items'
        ) ??
        [];

      return {
        title: readDtoValue<string>(section, 'Title'),
        rows: rows.map((row) => ({
          id: readDtoValue<string>(row, 'Id'),
          title: readDtoValue<string>(row, 'Title'),
          description: readDtoValue<string>(row, 'Description'),
        })),
      };
    }),
  };
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
