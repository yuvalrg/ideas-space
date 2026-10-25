/** A partner's picture, or the first letter of their name on a colored circle. */
export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url: string | null | undefined;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
