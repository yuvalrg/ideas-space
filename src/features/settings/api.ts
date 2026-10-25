import type { Database, Tables } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import { BUCKET } from '../resources/api';
import { downscaleImage, mimeTypeOf } from '../resources/upload';

export type AllowedEmail = Tables<'allowed_emails'>;
export type PartnerStatus = Database['public']['Enums']['allowed_email_status'];
type Profile = Tables<'profiles'>;

export interface Partner {
  email: string;
  status: PartnerStatus;
  invitedAt: string;
  profile: Profile | null;
}

export async function getWorkspaceName(): Promise<string | null> {
  const result = await getSupabase()
    .from('app_settings')
    .select('value')
    .eq('key', 'workspace_name')
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data?.value ?? null;
}

/** The trigger stamps who/when and logs settings.updated. */
export async function setWorkspaceName(value: string): Promise<void> {
  const result = await getSupabase()
    .from('app_settings')
    .update({ value })
    .eq('key', 'workspace_name')
    .select('key');
  if (result.error) throw result.error;
  if (result.data.length !== 1) throw new Error('workspace_name_missing');
  window.dispatchEvent(new CustomEvent('workspace-name', { detail: value }));
}

/** The allowed list (source of truth for access) joined with each partner's profile. */
export async function listPartners(): Promise<Partner[]> {
  const supabase = getSupabase();
  const [emails, profiles] = await Promise.all([
    supabase.from('allowed_emails').select('*').order('invited_at'),
    supabase.from('profiles').select('*'),
  ]);
  if (emails.error) throw emails.error;
  if (profiles.error) throw profiles.error;
  const byEmail = new Map(profiles.data.map((profile) => [profile.email, profile]));
  return emails.data.map((row) => ({
    email: row.email,
    status: row.status,
    invitedAt: row.invited_at,
    profile: byEmail.get(row.email) ?? null,
  }));
}

export async function invitePartner(email: string): Promise<void> {
  const result = await getSupabase().rpc('invite_partner', { p_email: email });
  if (result.error) throw result.error;
}

/** Status 'removed' and the profile inactive: the partner's next request fails RLS at once. */
export async function removePartner(email: string): Promise<void> {
  const result = await getSupabase().rpc('remove_partner', { p_email: email });
  if (result.error) throw result.error;
}

export async function updateMyProfile(
  id: string,
  changes: { display_name?: string; avatar_url?: string | null },
): Promise<void> {
  const result = await getSupabase().from('profiles').update(changes).eq('id', id).select('id');
  if (result.error) throw result.error;
  if (result.data.length !== 1) throw new Error('profile_not_updated');
}

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isAvatarType(file: File): boolean {
  return AVATAR_TYPES.has(mimeTypeOf(file));
}

/** Uploads a 256px picture into avatars/{profile id}/ and returns its storage path. */
export async function uploadAvatar(profileId: string, file: File): Promise<string> {
  const body = await downscaleImage(file, 256);
  const ext = mimeTypeOf(file).split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `avatars/${profileId}/${crypto.randomUUID()}.${ext}`;
  const result = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, body, { contentType: mimeTypeOf(file), upsert: false });
  if (result.error) throw result.error;
  return path;
}

/** Signed links (60 minutes) for profile pictures, by storage path. */
export async function avatarUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const result = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (result.error) throw result.error;
  for (const entry of result.data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}
