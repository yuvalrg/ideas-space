import type { Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import { downscaleImage, mimeTypeOf, storageName } from './upload';

// Links and files of an idea (spec sections 6 and 9). The client writes files and resources
// directly (hard rule 1); triggers stamp the author and write activity_log.

export type Resource = Tables<'resources'>;
export type StoredFile = Tables<'files'>;

export const BUCKET = 'idea-files';
const SIGNED_URL_SECONDS = 60 * 60; // spec section 9: signed links last 60 minutes

export interface ResourceRow {
  resource: Resource;
  file: StoredFile | null;
}

export async function listResources(ideaId: string): Promise<ResourceRow[]> {
  const supabase = getSupabase();
  const resources = await supabase
    .from('resources_live')
    .select('*')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  if (resources.error) throw resources.error;
  const rows = resources.data as Resource[];
  const fileIds = rows.map((r) => r.file_id).filter((id): id is string => id !== null);
  const files = new Map<string, StoredFile>();
  if (fileIds.length > 0) {
    const result = await supabase.from('files').select('*').in('id', fileIds);
    if (result.error) throw result.error;
    for (const file of result.data) files.set(file.id, file);
  }
  return rows.map((resource) => ({
    resource,
    file: resource.file_id ? (files.get(resource.file_id) ?? null) : null,
  }));
}

interface Details {
  title: string;
  description: string;
  relevance: string;
}

const optional = (text: string) => text.trim() || null;

/** "example.com/path" from a URL, used when the partner leaves the name empty. */
export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : decodeURIComponent(parsed.pathname);
    return `${parsed.hostname.replace(/^www\./, '')}${path}`.slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

export async function addLink(ideaId: string, url: string, details: Details): Promise<void> {
  const result = await getSupabase()
    .from('resources')
    .insert({
      idea_id: ideaId,
      kind: 'link',
      url,
      title: optional(details.title) ?? titleFromUrl(url),
      description: optional(details.description),
      relevance: optional(details.relevance),
    });
  if (result.error) throw result.error;
}

/**
 * Upload to ideas/{idea_id}/{file_id}_{name}, then record the file and the resource. If recording
 * fails, the uploaded object is removed again so no orphan is left behind.
 */
export async function addFile(ideaId: string, file: File, details: Details): Promise<void> {
  const supabase = getSupabase();
  const fileId = crypto.randomUUID();
  const path = `ideas/${ideaId}/${fileId}_${storageName(file.name)}`;
  const body = await downscaleImage(file);
  const mimeType = mimeTypeOf(file);

  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: mimeType, upsert: false });
  if (uploaded.error) throw uploaded.error;

  try {
    const recorded = await supabase.from('files').insert({
      id: fileId,
      idea_id: ideaId,
      storage_path: path,
      original_name: file.name,
      mime_type: mimeType,
      size_bytes: body.size,
    });
    if (recorded.error) throw recorded.error;
    const resource = await supabase.from('resources').insert({
      idea_id: ideaId,
      kind: 'file',
      file_id: fileId,
      title: optional(details.title) ?? file.name,
      description: optional(details.description),
      relevance: optional(details.relevance),
    });
    if (resource.error) throw resource.error;
  } catch (cause) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw cause;
  }
}

/** A signed link valid for 60 minutes, created only when a member opens the file. */
export async function signedFileUrl(file: StoredFile): Promise<string> {
  const result = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS);
  if (result.error) throw result.error;
  return result.data.signedUrl;
}

/** Soft delete (spec section 8): the resource disappears; the file stays in storage. */
export async function deleteResource(id: string): Promise<void> {
  const result = await getSupabase()
    .from('resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (result.error) throw result.error;
}
