import he from './he.json';

export type MessageKey = keyof typeof he;

/**
 * Returns the Hebrew UI string for a key. Every UI string comes from he.json.
 * Placeholders like {name} are replaced from params.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = he[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** True when he.json has this key (used to map server error codes to messages). */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(he, key);
}
