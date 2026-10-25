import { Fragment, type ReactNode } from 'react';
import { t, type MessageKey } from './index';

/**
 * Renders a he.json string whose {placeholders} are React nodes, e.g. an email wrapped in
 * <span dir="ltr"> inside a Hebrew sentence (spec section 12, mixed text).
 */
export function Message({ id, values }: { id: MessageKey; values: Record<string, ReactNode> }) {
  const parts = t(id).split(/\{(\w+)\}/);
  return (
    <>
      {parts.map((part, index) => (
        // Odd indexes are placeholder names captured by the split.
        <Fragment key={index}>{index % 2 === 1 ? (values[part] ?? `{${part}}`) : part}</Fragment>
      ))}
    </>
  );
}
