import type { Snapshot } from './api';

// Local drafts of an idea being edited (spec section 8): kept in this browser every 5 seconds so a
// refresh or a failed save never loses text. Storage can be unavailable (private mode), so every
// access is guarded and the editor works without it.

export interface Draft {
  savedAt: string;
  baseVersion: number;
  values: Snapshot;
}

const key = (ideaId: string) => `ideas-space:draft:${ideaId}`;

export function readDraft(ideaId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(ideaId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(ideaId: string, baseVersion: number, values: Snapshot): Draft | null {
  const draft: Draft = { savedAt: new Date().toISOString(), baseVersion, values };
  try {
    localStorage.setItem(key(ideaId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(ideaId: string): void {
  try {
    localStorage.removeItem(key(ideaId));
  } catch {
    // nothing to clear
  }
}

/** True when two snapshots hold the same text (blank sections count as empty). */
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  if (a.title.trim() !== b.title.trim() || a.summary.trim() !== b.summary.trim()) return false;
  if (a.category_id !== b.category_id) return false;
  const keys = new Set([...Object.keys(a.sections), ...Object.keys(b.sections)]);
  for (const k of keys) {
    const left = (a.sections as Record<string, string | undefined>)[k]?.trim() ?? '';
    const right = (b.sections as Record<string, string | undefined>)[k]?.trim() ?? '';
    if (left !== right) return false;
  }
  return true;
}
