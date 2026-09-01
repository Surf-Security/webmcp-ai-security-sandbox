'use client';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useExtensionConnection } from '../../lib/useExtensionConnection';
import { useTopBarSlot } from '../../lib/topBarSlot';

const EXTENSION_ID = 'eopkbbbmfbmdhfhenfmdpdfijcnapmcc';
const WEBSTORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`;

/**
 * Rendered once by AppShell, above every page's content, so connection status is consistent
 * everywhere instead of each page deciding independently whether to show it. Plain small dot/icon
 * per the reference mockup — not a filled circular badge, which read as too heavy against the
 * mockup's much lighter touch. Title sits above subtitle (stacked vertically), matching the
 * mockup exactly — not an inline dash-separated line. Subtitle text and an optional right-aligned
 * action (e.g. Audit Trail's "Export" button lives in this same row, not the page body below)
 * come from useTopBarActions() so each page can customize this shared bar without duplicating it.
 */
export default function TopStatusBar() {
  const { status, recheck } = useExtensionConnection();
  const { subtitle, actionLabel, actionIcon: ActionIcon, onAction } = useTopBarSlot();

  if (status === 'installed') {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-line bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5">
            <span className="absolute h-3 w-3 animate-ping rounded-full bg-ok opacity-75" />
            <span className="relative h-3 w-3 rounded-full bg-ok" />
          </span>
          <div>
            <div className="text-base font-semibold text-ink">Extension connected</div>
            <div className="text-sm text-mut">{subtitle || 'Receiving live events'}</div>
          </div>
        </div>
        {actionLabel && (
          <button
            onClick={onAction}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-surf bg-card px-3 py-1.5 text-sm font-medium text-surf hover:bg-bg"
          >
            {ActionIcon && <ActionIcon size={14} />}
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-3 border-b border-line bg-card px-6 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5">
          <Loader2 size={16} className="animate-spin text-hold" />
        </span>
        <div className="text-base font-semibold text-ink">Checking for the Surf extension…</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bad-bg">
          <AlertTriangle size={16} className="text-bad" />
        </span>
        <div>
          <div className="text-base font-semibold text-bad">Surf extension not connected</div>
          <div className="text-sm text-mut">
            Live protection, approval prompts, and real-time activity require the Surf extension.
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={recheck}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          Check again
        </button>
        <a
          href={WEBSTORE_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-surf px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Install / Load extension
        </a>
      </div>
    </div>
  );
}
