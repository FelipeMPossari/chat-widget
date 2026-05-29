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

export class HttpChatApi implements ChatApi {
  private token = '';

  constructor(private readonly apiBaseUrl: string) {}

  async bootstrap(request: BootstrapRequest): Promise<BootstrapResponse> {
    const response = await this.request<BootstrapResponse>('/bootstrap', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    this.token = response.token;
    return response;
  }

  listConversations(): Promise<ConversationSummary[]> {
    return this.request<ConversationSummary[]>('/conversations');
  }

  createConversation(request: CreateConversationRequest): Promise<ConversationSummary> {
    return this.request<ConversationSummary>('/conversations', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  listMessages(chatGuid: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/conversations/${chatGuid}/messages`);
  }

  sendMessage(chatGuid: string, request: SendMessageRequest): Promise<ChatMessage> {
    return this.request<ChatMessage>(`/conversations/${chatGuid}/messages`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async uploadAttachment(
    chatGuid: string,
    request: UploadAttachmentRequest
  ): Promise<ChatAttachment> {
    const body = new FormData();
    body.append('file', request.file);

    return this.request<ChatAttachment>(`/conversations/${chatGuid}/attachments`, {
      method: 'POST',
      body,
    });
  }

  closeConversation(chatGuid: string): Promise<ConversationSummary> {
    return this.request<ConversationSummary>(`/conversations/${chatGuid}/close`, {
      method: 'POST',
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);

    if (!(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${this.apiBaseUrl}/api/ChatWidget${path}`, {
      ...init,
      headers,
      credentials: 'omit',
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message || `Falha na API do ChatWidget (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    const body = (await response.json().catch(() => undefined)) as
      | { message?: string; error?: string }
      | undefined;

    return body?.message || body?.error || '';
  }

  return response.text().catch(() => '');
}

