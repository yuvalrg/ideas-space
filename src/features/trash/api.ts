import { getSupabase } from '../../lib/supabase';
import type { Idea } from '../ideas/api';

/** Ideas in the trash, most recently trashed first (spec section 6). */
export async function listTrash(): Promise<Idea[]> {
  const result = await getSupabase()
    .from('ideas')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (result.error) throw result.error;
  return result.data;
}

/** Soft delete (spec section 8): the idea leaves the list, search and the questions screen. */
export async function trashIdea(id: string): Promise<void> {
  const result = await getSupabase().rpc('trash_idea', { p_idea_id: id });
  if (result.error) throw result.error;
}

/** Brings the idea back with its questions and resources (acceptance criterion 10). */
export async function restoreIdea(id: string): Promise<void> {
  const result = await getSupabase().rpc('restore_idea', { p_idea_id: id });
  if (result.error) throw result.error;
}
