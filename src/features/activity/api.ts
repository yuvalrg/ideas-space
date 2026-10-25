import type { Json, Tables } from '../../lib/database.types';
import { isMessageKey, t } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';
import { STATUS_LABEL, type IdeaStatus } from '../ideas/api';
import { ITEM_TYPE_LABEL, type ItemType } from '../items/api';

export type Activity = Tables<'activity_log'>;

export interface ActivityRow {
  activity: Activity;
  idea: { id: string; title: string; trashed: boolean } | null;
}

/** The group's last 50 actions, newest first (spec section 6). Written only by triggers/functions. */
export async function listActivity(): Promise<ActivityRow[]> {
  const supabase = getSupabase();
  const result = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (result.error) throw result.error;
  const ideaIds = [
    ...new Set(result.data.map((a) => a.idea_id).filter((id): id is string => !!id)),
  ];
  const ideas = new Map<string, { id: string; title: string; trashed: boolean }>();
  if (ideaIds.length > 0) {
    const ideaResult = await supabase
      .from('ideas')
      .select('id, title, deleted_at')
      .in('id', ideaIds);
    if (ideaResult.error) throw ideaResult.error;
    for (const idea of ideaResult.data) {
      ideas.set(idea.id, { id: idea.id, title: idea.title, trashed: idea.deleted_at !== null });
    }
  }
  return result.data.map((activity) => ({
    activity,
    idea: activity.idea_id ? (ideas.get(activity.idea_id) ?? null) : null,
  }));
}

function field(value: Json | null, name: string): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const found = value[name];
    if (typeof found === 'string' || typeof found === 'number') return String(found);
  }
  return null;
}

function statusLabel(status: string | null): string {
  return status && status in STATUS_LABEL ? t(STATUS_LABEL[status as IdeaStatus]) : '';
}

/**
 * The Hebrew line for an action code. activity_log keeps codes and user content only (hard rule 3);
 * the sentence comes from he.json here.
 */
export function describe(activity: Activity): string {
  const { action, entity_type: entityType } = activity;
  if (action === 'idea.status_changed') {
    return t('activity.idea.status_changed', {
      from: statusLabel(field(activity.old_value, 'status')),
      to: statusLabel(field(activity.new_value, 'status')),
    });
  }
  if (action === 'idea.restored') {
    return t('activity.idea.restored', {
      n: field(activity.new_value, 'restored_from_version') ?? '',
    });
  }
  if (action.startsWith('item.')) {
    const type = entityType in ITEM_TYPE_LABEL ? t(ITEM_TYPE_LABEL[entityType as ItemType]) : '';
    const key = `activity.${action}`;
    return isMessageKey(key) ? t(key, { type }) : action;
  }
  const key = `activity.${action}`;
  return isMessageKey(key) ? t(key) : action;
}

/** The user content worth showing under the line (not the idea title, which is the link). */
export function detail(activity: Activity): { text: string; ltr: boolean } | null {
  const { action, summary } = activity;
  if (action.startsWith('partner.')) return summary ? { text: summary, ltr: true } : null;
  if (action === 'settings.updated') {
    const value = field(activity.new_value, 'value');
    return value ? { text: value, ltr: false } : null;
  }
  if (action.startsWith('idea.')) return null;
  return summary ? { text: summary, ltr: false } : null;
}
