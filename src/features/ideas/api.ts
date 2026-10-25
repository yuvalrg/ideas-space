import { Constants, type Database, type Tables } from '../../lib/database.types';
import type { MessageKey } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';

export type IdeaStatus = Database['public']['Enums']['idea_status'];
export type SectionKey = Database['public']['Enums']['section_key'];
export type Idea = Tables<'ideas'>;
export type Category = Tables<'categories'>;
export type Sections = Partial<Record<SectionKey, string>>;

/** Enum order = display order (spec decision 3 and 4). */
export const IDEA_STATUSES = Constants.public.Enums.idea_status;
export const SECTION_KEYS = Constants.public.Enums.section_key;

export const STATUS_LABEL: Record<IdeaStatus, MessageKey> = {
  new: 'status.new',
  discussion: 'status.discussion',
  review: 'status.review',
  approved: 'status.approved',
  paused: 'status.paused',
  dropped: 'status.dropped',
};

export const SECTION_LABEL: Record<SectionKey, MessageKey> = {
  audience: 'section.audience',
  problem: 'section.problem',
  value: 'section.value',
  how_it_works: 'section.how_it_works',
  existing_solutions: 'section.existing_solutions',
  opportunity: 'section.opportunity',
  revenue_model: 'section.revenue_model',
  partners_suppliers: 'section.partners_suppliers',
  costs_resources: 'section.costs_resources',
  risks: 'section.risks',
};

/** The versioned state of an idea (idea_versions.snapshot). */
export interface Snapshot {
  title: string;
  summary: string;
  category_id: string | null;
  sections: Sections;
}

export interface Version {
  version_no: number;
  change_type: Database['public']['Enums']['version_change_type'];
  restored_from_version: number | null;
  created_by: string;
  created_at: string;
  snapshot: Snapshot;
}

/** save_idea refused a stale version; details says who saved last and when. */
export class VersionConflict extends Error {
  constructor(
    readonly versionNo: number,
    readonly updatedByName: string | null,
    readonly updatedAt: string,
  ) {
    super('version_conflict');
  }
}

// The generated types mark RPC arguments as non-null; the SQL functions accept null.
const nullable = <T>(value: T | null): T => value as T;

/** All ideas not in the trash. The list is small (2-6 partners), so filtering happens in the client. */
export async function listIdeas(): Promise<Idea[]> {
  const result = await getSupabase()
    .from('ideas_live')
    .select('*')
    .order('updated_at', { ascending: false });
  if (result.error) throw result.error;
  return result.data as Idea[];
}

/** Open (not answered) question count per idea. */
export async function openQuestionCounts(): Promise<Map<string, number>> {
  const result = await getSupabase()
    .from('items_live')
    .select('idea_id')
    .eq('type', 'question')
    .neq('question_status', 'answered');
  if (result.error) throw result.error;
  const counts = new Map<string, number>();
  for (const row of result.data) {
    if (row.idea_id) counts.set(row.idea_id, (counts.get(row.idea_id) ?? 0) + 1);
  }
  return counts;
}

/** ILIKE pattern for a substring search, with %, _ and \ in the user's text taken literally. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Ids of ideas whose title, summary or any section contains the query (spec decision 13: substring,
 * case-insensitive, so "מלון" also finds "המלון").
 */
export async function searchIdeaIds(query: string): Promise<Set<string>> {
  const supabase = getSupabase();
  const pattern = likePattern(query);
  // Inside .or() the value is double-quoted (so commas or parentheses in the query cannot break the
  // filter syntax), and PostgREST then reads backslash and quote as escapes.
  const quoted = `"${pattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
  const [byText, bySection] = await Promise.all([
    supabase.from('ideas_live').select('id').or(`title.ilike.${quoted},summary.ilike.${quoted}`),
    supabase.from('idea_sections').select('idea_id').ilike('content', pattern),
  ]);
  if (byText.error) throw byText.error;
  if (bySection.error) throw bySection.error;
  const ids = new Set<string>();
  for (const row of byText.data) if (row.id) ids.add(row.id);
  for (const row of bySection.data) ids.add(row.idea_id);
  return ids;
}

export async function getIdea(id: string): Promise<{ idea: Idea; sections: Sections } | null> {
  const supabase = getSupabase();
  const [ideaResult, sectionsResult] = await Promise.all([
    supabase.from('ideas').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('idea_sections').select('section_key, content').eq('idea_id', id),
  ]);
  if (ideaResult.error) throw ideaResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (!ideaResult.data) return null;
  const sections: Sections = {};
  for (const row of sectionsResult.data) sections[row.section_key] = row.content;
  return { idea: ideaResult.data, sections };
}

export async function createIdea(input: {
  title: string;
  summary: string;
  categoryId: string | null;
  interesting: string;
}): Promise<string> {
  const result = await getSupabase().rpc('create_idea', {
    p_title: input.title,
    p_summary: input.summary,
    p_category_id: nullable(input.categoryId),
    p_interesting: nullable(input.interesting || null),
  });
  if (result.error) throw result.error;
  return result.data;
}

/** Returns the idea's version after the save (unchanged when nothing changed). */
export async function saveIdea(
  id: string,
  expectedVersion: number,
  snapshot: Snapshot,
): Promise<number> {
  // Send every section: a blank one clears it (save_idea keeps sections that are left out).
  const sections: Record<string, string> = {};
  for (const key of SECTION_KEYS) sections[key] = snapshot.sections[key] ?? '';
  const result = await getSupabase().rpc('save_idea', {
    p_idea_id: id,
    p_expected_version: expectedVersion,
    p_title: snapshot.title,
    p_summary: snapshot.summary,
    p_category_id: nullable(snapshot.category_id),
    p_sections: sections,
  });
  if (result.error) {
    if (result.error.message === 'version_conflict') {
      const detail = JSON.parse(result.error.details ?? '{}') as {
        version_no?: number;
        updated_by_name?: string | null;
        updated_at?: string;
      };
      throw new VersionConflict(
        detail.version_no ?? expectedVersion,
        detail.updated_by_name ?? null,
        detail.updated_at ?? new Date().toISOString(),
      );
    }
    throw result.error;
  }
  return result.data;
}

export async function setIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
  const result = await getSupabase().rpc('set_idea_status', { p_idea_id: id, p_status: status });
  if (result.error) throw result.error;
}

export async function duplicateIdea(id: string, title: string): Promise<string> {
  const result = await getSupabase().rpc('duplicate_idea', { p_idea_id: id, p_title: title });
  if (result.error) throw result.error;
  return result.data;
}

export async function listVersions(id: string): Promise<Version[]> {
  const result = await getSupabase()
    .from('idea_versions')
    .select('version_no, change_type, restored_from_version, created_by, created_at, snapshot')
    .eq('idea_id', id)
    .order('version_no', { ascending: false });
  if (result.error) throw result.error;
  return result.data as unknown as Version[];
}

/** Returns the new version number. */
export async function restoreVersion(id: string, versionNo: number): Promise<number> {
  const result = await getSupabase().rpc('restore_version', {
    p_idea_id: id,
    p_version_no: versionNo,
  });
  if (result.error) throw result.error;
  return result.data;
}
