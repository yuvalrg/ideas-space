import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { Dialog } from '../components/Dialog';
import { TimeAgo } from '../components/TimeAgo';
import { useAuth } from '../features/auth/authContext';
import { invalidateLookups } from '../features/ideas/useLookups';
import {
  avatarUrls,
  getWorkspaceName,
  invitePartner,
  isAvatarType,
  listPartners,
  removePartner,
  setWorkspaceName,
  updateMyProfile,
  uploadAvatar,
  type Partner,
  type PartnerStatus,
} from '../features/settings/api';

type Feedback = { kind: 'ok'; text: string } | { kind: 'error'; key: MessageKey } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return feedback.kind === 'ok' ? (
    <p role="status" className="text-sm font-medium text-emerald-700">
      {feedback.text}
    </p>
  ) : (
    <p role="alert" className="text-sm font-medium text-red-700">
      {t(feedback.key)}
    </p>
  );
}

const STATUS_LABEL: Record<PartnerStatus, MessageKey> = {
  invited: 'settings.partnerStatus.invited',
  joined: 'settings.partnerStatus.joined',
  removed: 'settings.partnerStatus.removed',
};

const STATUS_STYLE: Record<PartnerStatus, string> = {
  invited: 'bg-amber-50 text-amber-800 ring-amber-200',
  joined: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  removed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

/** Workspace name, editable by any partner (spec section 6). */
function WorkspaceSection() {
  const id = useId();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceName().then(
      (value) => {
        if (!cancelled) setName(value ?? '');
      },
      (cause: unknown) => {
        if (!cancelled) setFeedback({ kind: 'error', key: errorMessageKey(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name?.trim()) return setFeedback({ kind: 'error', key: 'settings.nameRequired' });
    setSaving(true);
    setFeedback(null);
    try {
      await setWorkspaceName(name.trim());
      setFeedback({ kind: 'ok', text: t('settings.saved') });
    } catch (cause) {
      setFeedback({ kind: 'error', key: errorMessageKey(cause) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900">
        {t('settings.workspaceTitle')}
      </h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <label htmlFor={`${id}-name`} className="field-label">
          {t('settings.workspaceLabel')}
        </label>
        <input
          id={`${id}-name`}
          value={name ?? ''}
          disabled={name === null}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          className="field-input"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || name === null} className="btn-primary">
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </section>
  );
}

/** My profile: display name (required) and picture (optional); email comes from sign-in. */
function ProfileSection({ avatarUrl }: { avatarUrl: string | null }) {
  const id = useId();
  const { profile, session, reload } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!profile) return null;
  const profileId = profile.id;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      invalidateLookups();
      await reload();
      setFeedback({ kind: 'ok', text: t('settings.saved') });
    } catch (cause) {
      setFeedback({ kind: 'error', key: errorMessageKey(cause) });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setFeedback({ kind: 'error', key: 'settings.nameRequired' });
    void run(() => updateMyProfile(profileId, { display_name: name.trim() }));
  }

  function onPicture(file: File | undefined) {
    if (!file) return;
    if (!isAvatarType(file)) return setFeedback({ kind: 'error', key: 'settings.avatarType' });
    void run(async () => {
      const path = await uploadAvatar(profileId, file);
      await updateMyProfile(profileId, { avatar_url: path });
    });
  }

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900">
        {t('settings.profileTitle')}
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar name={profile.display_name} url={avatarUrl} size={64} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {t('settings.avatarChoose')}
          </button>
          {profile.avatar_url && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void run(() => updateMyProfile(profileId, { avatar_url: null }))}
            >
              {t('settings.avatarRemove')}
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            onPicture(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <p className="w-full text-xs text-slate-500">{t('settings.avatarHint')}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <label htmlFor={`${id}-name`} className="field-label">
          {t('settings.displayNameLabel')}
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          className="field-input"
        />
        <p className="text-sm text-slate-600">
          {t('settings.emailLabel')}:{' '}
          <span dir="ltr" className="font-medium">
            {session?.user.email}
          </span>{' '}
          <span className="text-xs text-slate-500">{t('settings.emailFixed')}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? t('settings.saving') : t('settings.save')}
          </button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </section>
  );
}

/** Partners: status, invite, remove with typed-name confirmation, last-partner guard (spec 5, 15). */
function PartnersSection({
  partners,
  avatars,
  onChanged,
}: {
  partners: Partner[] | null;
  avatars: Map<string, string>;
  onChanged: () => void;
}) {
  const id = useId();
  const { profile, reload } = useAuth();
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [removing, setRemoving] = useState<Partner | null>(null);
  const [typed, setTyped] = useState('');
  const [removeError, setRemoveError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (partner: Partner) => partner.profile?.display_name ?? partner.email;

  async function invite(address: string) {
    setInviting(true);
    setFeedback(null);
    try {
      await invitePartner(address);
      setEmail('');
      onChanged();
      setFeedback({
        kind: 'ok',
        text: t('settings.invited', { email: address.trim().toLowerCase() }),
      });
    } catch (cause) {
      // The typed address stays in the field (hard rule 6).
      setFeedback({ kind: 'error', key: errorMessageKey(cause) });
    } finally {
      setInviting(false);
    }
  }

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return setFeedback({ kind: 'error', key: 'errors.invalid_email' });
    void invite(email);
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await removePartner(removing.email);
      const removedName = nameOf(removing);
      const wasMe = removing.email === profile?.email;
      setRemoving(null);
      setFeedback({ kind: 'ok', text: t('settings.removed', { name: removedName }) });
      if (wasMe)
        await reload(); // my access ends now: the guard shows the no-access screen
      else onChanged();
    } catch (cause) {
      setRemoveError(errorMessageKey(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900">
        {t('settings.partnersTitle')}
      </h2>

      {!partners ? (
        <p role="status" className="mt-4 text-slate-500">
          {t('common.loading')}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {partners.map((partner) => {
            const isMe = partner.email === profile?.email;
            return (
              <li key={partner.email} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar
                  name={nameOf(partner)}
                  url={partner.profile?.avatar_url ? avatars.get(partner.profile.avatar_url) : null}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    <bdi>{nameOf(partner)}</bdi>
                    {isMe && (
                      <span className="ms-1 text-sm text-slate-500">{t('settings.you')}</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    <span dir="ltr">{partner.email}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {partner.profile ? (
                      <Message
                        id="settings.joinedAt"
                        values={{ time: <TimeAgo iso={partner.profile.joined_at} /> }}
                      />
                    ) : (
                      <Message
                        id="settings.invitedAt"
                        values={{ time: <TimeAgo iso={partner.invitedAt} /> }}
                      />
                    )}
                    {partner.profile?.last_seen_at && (
                      <>
                        {' · '}
                        <Message
                          id="settings.lastSeen"
                          values={{ time: <TimeAgo iso={partner.profile.last_seen_at} /> }}
                        />
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[partner.status]}`}
                >
                  {t(STATUS_LABEL[partner.status])}
                </span>
                {partner.status === 'removed' ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={inviting}
                    onClick={() => void invite(partner.email)}
                  >
                    {t('settings.inviteAgain')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary text-red-700"
                    onClick={() => {
                      setRemoving(partner);
                      setTyped('');
                      setRemoveError(null);
                    }}
                  >
                    {t('settings.remove')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={onInvite}
        noValidate
        className="mt-6 space-y-3 border-t border-slate-100 pt-5"
      >
        <h3 className="font-bold text-slate-900">{t('settings.inviteTitle')}</h3>
        <label htmlFor={`${id}-email`} className="field-label">
          {t('settings.inviteLabel')}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          dir="ltr"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-input"
        />
        <p className="text-xs text-slate-500">{t('settings.inviteHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={inviting} className="btn-primary">
            {inviting ? t('settings.inviting') : t('settings.invite')}
          </button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>

      <Dialog
        open={removing !== null}
        title={removing ? t('settings.removeTitle', { name: nameOf(removing) }) : ''}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700"
              disabled={busy || !removing || typed.trim() !== nameOf(removing).trim()}
              onClick={() => void confirmRemove()}
            >
              {t('settings.removeConfirm')}
            </button>
          </>
        }
      >
        {removing && (
          <div className="space-y-3">
            <p className="text-slate-700">{t('settings.removeText')}</p>
            <label htmlFor={`${id}-confirm`} className="field-label">
              <Message
                id="settings.removeConfirmLabel"
                values={{ name: <bdi className="font-bold">{nameOf(removing)}</bdi> }}
              />
            </label>
            <input
              id={`${id}-confirm`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="field-input"
            />
            {removeError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {t(removeError)}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}

/** Settings (spec section 6): workspace name, my profile, partners. */
export function SettingsRoute() {
  const { profile } = useAuth();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<MessageKey | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const myAvatar = profile?.avatar_url ?? null;

  // Load partners and their pictures' signed links; again after a change or a new picture of mine.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listPartners();
      const paths = list.map((p) => p.profile?.avatar_url).filter((p): p is string => !!p);
      const urls = await avatarUrls(paths);
      if (cancelled) return;
      setPartners(list);
      setAvatars(urls);
    })().catch((cause: unknown) => {
      if (!cancelled) setError(errorMessageKey(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [version, myAvatar]);

  return (
    <section className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
      {error && (
        <p role="alert" className="font-medium text-red-700">
          {t(error)}
        </p>
      )}
      <WorkspaceSection />
      <ProfileSection avatarUrl={myAvatar ? (avatars.get(myAvatar) ?? null) : null} />
      <PartnersSection partners={partners} avatars={avatars} onChanged={refresh} />
    </section>
  );
}
