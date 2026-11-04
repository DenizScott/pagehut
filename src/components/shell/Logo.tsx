/** App mark: a rounded tile with an open book and a keyhole. Single colour, legible at 16 px. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M7 10.5c3-.9 6-.6 9 1.2 3-1.8 6-2.1 9-1.2v12c-3-.9-6-.6-9 1.2-3-1.8-6-2.1-9-1.2z"
        fill="none"
        stroke="var(--accent-fg)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16.2" r="1.6" fill="var(--accent-fg)" />
      <path d="M15.3 17.2h1.4l.5 3h-2.4z" fill="var(--accent-fg)" />
    </svg>
  );
}
