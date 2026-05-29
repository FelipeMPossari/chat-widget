import type { ChatWidgetConfig, WidgetPosition, WidgetUserContext } from '../types';

const DEFAULT_LOCALE = 'pt-BR';

export function normalizeBaseUrl(value?: string): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/+$/, '');
}

export function normalizePosition(value?: string): WidgetPosition {
  return value === 'left' ? 'left' : 'right';
}

export function readBoolean(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null || value === '') {
    return fallback;
  }

  return value === 'true' || value === '1' || value === 'yes';
}

export function readScriptConfig(script: HTMLScriptElement | null): ChatWidgetConfig {
  const dataset = script?.dataset ?? {};
  const apiBaseUrl = normalizeBaseUrl(dataset.apiBaseUrl);
  const authToken = dataset.authToken || dataset.token || dataset.userToken;
  const user = readUserContext(dataset);

  return {
    widgetKey: dataset.widgetKey || '',
    authToken,
    apiBaseUrl,
    demoMode: readBoolean(dataset.demoMode, !apiBaseUrl),
    locale: dataset.locale || DEFAULT_LOCALE,
    position: normalizePosition(dataset.position),
    sourceSystem: dataset.sourceSystem,
    sourceUrl: dataset.sourceUrl || window.location.href,
    user,
  };
}

export function readElementConfig(element: HTMLElement): ChatWidgetConfig {
  const apiBaseUrl = normalizeBaseUrl(element.getAttribute('api-base-url') ?? undefined);
  const authToken = attr(element, 'auth-token') || attr(element, 'token') || attr(element, 'user-token');
  const user: WidgetUserContext = {
    externalUserId: attr(element, 'external-user-id'),
    name: attr(element, 'user-name'),
    email: attr(element, 'user-email'),
    token: attr(element, 'user-token'),
  };

  return {
    widgetKey: attr(element, 'widget-key') || '',
    authToken,
    apiBaseUrl,
    demoMode: readBoolean(element.getAttribute('demo-mode'), !apiBaseUrl),
    locale: attr(element, 'locale') || DEFAULT_LOCALE,
    position: normalizePosition(attr(element, 'position')),
    sourceSystem: attr(element, 'source-system'),
    sourceUrl: attr(element, 'source-url') || window.location.href,
    user: hasUserContext(user) ? user : undefined,
  };
}

export function applyConfigToElement(
  element: HTMLElement,
  config: Partial<ChatWidgetConfig>
): void {
  setAttr(element, 'widget-key', config.widgetKey);
  setAttr(element, 'auth-token', config.authToken ?? config.user?.token);
  setAttr(element, 'api-base-url', config.apiBaseUrl);
  setAttr(element, 'demo-mode', String(config.demoMode ?? false));
  setAttr(element, 'locale', config.locale);
  setAttr(element, 'position', config.position);
  setAttr(element, 'source-system', config.sourceSystem);
  setAttr(element, 'source-url', config.sourceUrl);
  setAttr(element, 'external-user-id', config.user?.externalUserId);
  setAttr(element, 'user-name', config.user?.name);
  setAttr(element, 'user-email', config.user?.email);
  setAttr(element, 'user-token', config.user?.token);
}

export function copyScriptDatasetToElement(
  script: HTMLScriptElement,
  element: HTMLElement
): void {
  const mappings: Array<[string, string]> = [
    ['widgetKey', 'widget-key'],
    ['token', 'auth-token'],
    ['authToken', 'auth-token'],
    ['apiBaseUrl', 'api-base-url'],
    ['demoMode', 'demo-mode'],
    ['locale', 'locale'],
    ['position', 'position'],
    ['sourceSystem', 'source-system'],
    ['sourceUrl', 'source-url'],
    ['externalUserId', 'external-user-id'],
    ['userName', 'user-name'],
    ['userEmail', 'user-email'],
    ['userToken', 'user-token'],
  ];

  for (const [dataKey, attrName] of mappings) {
    const value = script.dataset[dataKey];

    if (value != null) {
      element.setAttribute(attrName, value);
    }
  }
}

function readUserContext(dataset: DOMStringMap): WidgetUserContext | undefined {
  const user: WidgetUserContext = {
    externalUserId: dataset.externalUserId,
    name: dataset.userName,
    email: dataset.userEmail,
    token: dataset.userToken,
  };

  return hasUserContext(user) ? user : undefined;
}

function hasUserContext(user: WidgetUserContext): boolean {
  return Boolean(user.externalUserId || user.name || user.email || user.token);
}

function attr(element: HTMLElement, name: string): string | undefined {
  return element.getAttribute(name) ?? undefined;
}

function setAttr(element: HTMLElement, name: string, value?: string): void {
  if (value == null || value === '') {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}
