/**
 * Shared verdict -> {label, badgeVariant} mapping, used by Badge and every table that renders a
 * decision column, so the taxonomy is defined exactly once. Maps the extension's real
 * LogEntry.verdict ('success'|'blocked'|'denied'|'error') + masked flag onto the UI's
 * Allowed/Blocked/Masked language — 'denied' reads as "Blocked" too (it's a human-declined
 * destructive action, functionally the same outcome as an explicit blocklist block from the
 * caller's point of view). There is deliberately no "Held" case here: the real extension only
 * ever logs a call's *final* resolution, never the in-between "awaiting approval" moment, so a
 * verdict of 'held' never actually arrives — that filter was removed from the UI for the same
 * reason (see the redesign plan's Phase 2 notes for what building it for real would take).
 */
export function describeVerdict(entry) {
  if (!entry) return { variant: 'allowed', label: 'Allowed' };
  if (entry.verdict === 'blocked') return { variant: 'blocked', label: 'Blocked' };
  if (entry.verdict === 'denied') return { variant: 'blocked', label: 'Blocked' };
  if (entry.masked) return { variant: 'masked', label: 'Masked' };
  return { variant: 'allowed', label: 'Allowed' };
}

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export function riskBadgeVariant(risk) {
  if (risk === 'critical' || risk === 'high') return 'blocked';
  if (risk === 'medium') return 'held';
  return 'allowed';
}

/**
 * The real LogEntry has no risk field (see the redesign plan's Phase 2 notes) — this is an
 * honest heuristic derived from what a real entry does carry (verdict + masked), not fabricated
 * data. A blocked/denied call attempted something the policy considered dangerous enough to stop
 * outright (high); a masked call touched sensitive data but was contained (medium); anything else
 * that succeeded cleanly is low. If the extension ever stamps a real risk score at guard-decision
 * time (Phase 2), swap the call site over to that field instead of this inference.
 */
export function inferRiskLevel(entry) {
  if (!entry) return 'low';
  if (entry.verdict === 'blocked' || entry.verdict === 'denied') return 'high';
  if (entry.masked) return 'medium';
  return 'low';
}
