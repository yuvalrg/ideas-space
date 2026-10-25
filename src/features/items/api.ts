import type { Database, Tables } from '../../lib/database.types';
import type { MessageKey } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';

// Thoughts, questions and info (spec section 6). The client writes items directly (hard rule 1);
// triggers stamp who/when and write activity_log.

export type Item = Tables<'items'>;
export type ItemType = Database['public']['Enums']['item_type'];
export type QuestionStatus = Database['public']['Enums']['question_status'];

export const ITEM_TYPES: ItemType[] = ['thought', 'question', 'info'];

export const ITEM_TYPE_LABEL: Record<ItemType, MessageKey> = {
  thought: 'itemType.thought',
  question: 'itemType.question',
  info: 'itemType.info',
};

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, MessageKey> = {
  open: 'questionStatus.open',
  in_review: 'questionStatus.in_review',
  answered: 'questionStatus.answered',
};

/** Live items of one idea, oldest first. */
export async function listIdeaItems(ideaId: string): Promise<Item[]> {
  const result = await getSupabase()
    .from('items_live')
    .select('*')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  return result.data as Item[];
}

export async function addItem(ideaId: string, type: ItemType, content: string): Promise<Item> {
  const result = await getSupabase()
    .from('items')
    .insert({ idea_id: ideaId, type, content })
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data;
}

async function updateItem(id: string, changes: Database['public']['Tables']['items']['Update']) {
  const result = await getSupabase().from('items').update(changes).eq('id', id).select().single();
  if (result.error) throw result.error;
  return result.data;
}

/** Answering moves the question to 'answered' (acceptance criterion 6); the trigger stamps who/when. */
export function answerQuestion(id: string, answer: string): Promise<Item> {
  return updateItem(id, { question_status: 'answered', answer });
}

export function setQuestionStatus(id: string, status: QuestionStatus): Promise<Item> {
  return updateItem(id, { question_status: status });
}

export function setAssignee(id: string, assigneeId: string | null): Promise<Item> {
  return updateItem(id, { assignee_id: assigneeId });
}

/** Soft delete (spec section 8): hidden from every screen, kept in the database. */
export function deleteItem(id: string): Promise<Item> {
  return updateItem(id, { deleted_at: new Date().toISOString() });
}

export interface QuestionRow {
  item: Item;
  ideaTitle: string;
}

/** Every question of every idea not in the trash, most recently updated first. */
export async function listQuestions(): Promise<QuestionRow[]> {
  const supabase = getSupabase();
  const [questions, ideas] = await Promise.all([
    supabase
      .from('items_live')
      .select('*')
      .eq('type', 'question')
      .order('updated_at', { ascending: false }),
    supabase.from('ideas_live').select('id, title'),
  ]);
  if (questions.error) throw questions.error;
  if (ideas.error) throw ideas.error;
  const titles = new Map(ideas.data.map((idea) => [idea.id, idea.title]));
  return (questions.data as Item[]).map((item) => ({
    item,
    ideaTitle: titles.get(item.idea_id) ?? '',
  }));
}
