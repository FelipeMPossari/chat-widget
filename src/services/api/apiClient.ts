export class ApiClient {
  private token: string;

  constructor(
    private readonly apiBaseUrl: string,
    token = ''
  ) {
    this.token = token;
  }

  setToken(token?: string): void {
    this.token = token ?? '';
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body == null ? undefined : JSON.stringify(body),
    });
  }

  async upload<T>(path: string, file: File): Promise<T> {
    const body = new FormData();
    body.append('file', file);

    return this.request<T>(path, {
      method: 'POST',
      body,
    });
  }

  resolveUrl(url: string): string {
    if (!url || /^(https?:|blob:|data:)/i.test(url)) {
      return url;
    }

    if (url.startsWith('/')) {
      return `${this.apiBaseUrl}${url}`;
    }

    return `${this.apiBaseUrl}/${url}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);

    if (init.body && !(init.body instanceof FormData)) {
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

    return unwrapApiResponse<T>(await response.json());
  }
}

function unwrapApiResponse<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }

  if (body && typeof body === 'object' && 'Data' in body) {
    return (body as { Data: T }).Data;
  }

  return body as T;
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
