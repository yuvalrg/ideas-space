import { fullDateTime, relativeTime } from '../lib/format';

/** Relative time with the full date on hover (spec section 6). */
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={fullDateTime(iso)}>
      {relativeTime(iso)}
    </time>
  );
}
