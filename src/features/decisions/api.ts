import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import type { IdeaStatus } from '../ideas/api';

export type Decision = Tables<'decisions'>;

export async function listDecisions(ideaId: string): Promise<Decision[]> {
  const result = await getSupabase()
    .from('decisions_live')
    .select('*')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return result.data as Decision[];
}

export interface DecisionInput {
  content: string;
  reason: string;
  basis: string;
  nextStep: string;
  assigneeId: string | null;
  dueDate: string | null;
  newStatus: IdeaStatus | null;
}

/**
 * record_decision writes the decision and, in the same transaction, copies the next step, assignee
 * and due date to the idea and changes its status when one is chosen (spec section 6).
 */
export async function recordDecision(ideaId: string, input: DecisionInput): Promise<string> {
  const result = await getSupabase().rpc('record_decision', {
    p_idea_id: ideaId,
    p_content: input.content,
    // Optional arguments left out default to null in the SQL function.
    p_reason: input.reason || undefined,
    p_basis: input.basis || undefined,
    p_next_step: input.nextStep || undefined,
    p_assignee_id: input.assigneeId ?? undefined,
    p_due_date: input.dueDate ?? undefined,
    p_new_status: input.newStatus ?? undefined,
  });
  if (result.error) throw result.error;
  return result.data;
}

/** Soft delete; the idea's next step and status stay as they are. */
export async function deleteDecision(id: string): Promise<void> {
  const result = await getSupabase()
    .from('decisions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (result.error) throw result.error;
}
