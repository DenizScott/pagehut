/**
 * App mark, "Folded Shelter": a folded page under a small roof. Follows the app theme through
 * --accent (ink) and --brand-detail (the two brass lines). Legible at 16 px.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4.5 20.5 14.25 5.5 24.75 11.25" stroke="var(--accent)" strokeWidth="3.25" />
        <rect x="12.75" y="12" width="15.25" height="16.25" rx="2.7" stroke="var(--accent)" strokeWidth="2.75" />
        <path d="M17 18.25h6.75M17 22.75h4.75" stroke="var(--brand-detail)" strokeWidth="2.25" />
      </g>
    </svg>
  );
}
