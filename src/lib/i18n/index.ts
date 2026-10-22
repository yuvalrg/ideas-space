import he from './he.json';

export type MessageKey = keyof typeof he;

/** Returns the Hebrew UI string for a key. Every UI string comes from he.json. */
export function t(key: MessageKey): string {
  return he[key];
}
