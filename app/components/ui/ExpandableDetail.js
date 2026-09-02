'use client';
import { useState } from 'react';

const CLAMP_CHAR_THRESHOLD = 140;

/** Table "Details" cell — real event payloads can be long (a full export_customers record dump),
 * so this clamps to 2 lines with a click-to-expand toggle instead of blowing out row height. */
export default function ExpandableDetail({ value, className = 'text-xs text-mut' }) {
  const [expanded, setExpanded] = useState(false);
  // JSON.stringify(undefined) returns the value undefined, not a string — guard it explicitly so
  // a detail-less entry renders as an empty cell instead of throwing on text.length below.
  const text = typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);

  return (
    <div className={className}>
      <div className={expanded ? 'break-words' : 'line-clamp-2 break-words'}>{text}</div>
      {text.length > CLAMP_CHAR_THRESHOLD && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-[11px] font-medium text-surf hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
