const PREFIX = 'xchannel.webchat';

export function getOrCreateVisitorId(widgetKey: string): string {
  const storageKey = `${PREFIX}.${widgetKey || 'default'}.visitorId`;
  const existing = localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const visitorId = crypto.randomUUID();
  localStorage.setItem(storageKey, visitorId);
  return visitorId;
}

