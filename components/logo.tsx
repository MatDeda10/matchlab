export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-[12px] border border-accent/25 bg-accent/10">
        <svg viewBox="0 0 32 32" className="size-6" role="img" aria-label="MatchLab">
          <rect x="3" y="3" width="26" height="26" rx="7" fill="none" stroke="currentColor" strokeOpacity="0.35" className="text-accent" />
          <path d="M16 3v26M3 16h26" stroke="currentColor" strokeOpacity="0.2" className="text-accent" />
          <circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="1.6" fill="currentColor" className="text-accent" />
          <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" className="text-accent" strokeWidth="2" fill="none" />
        </svg>
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className="block text-[17px] font-semibold tracking-tight">MatchLab</span>
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.18em] text-faint">
            Football intelligence
          </span>
        </span>
      ) : null}
    </span>
  );
}
