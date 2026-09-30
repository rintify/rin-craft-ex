/** The folded mark is vector artwork, shared by the shell and empty canvas. */
export function FoldMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 5h29L21 19H6V5Z" fill="currentColor" />
      <path d="M6 19h15L6 36V19Z" fill="currentColor" opacity=".72" />
      <path d="m21 19 14-14v14L21 33V19Z" fill="currentColor" opacity=".38" />
      <path d="M6 19h15L35 5" stroke="var(--surface)" strokeWidth="1" />
    </svg>
  );
}
