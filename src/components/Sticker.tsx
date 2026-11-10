export type StickerKind =
  | "empty-box"
  | "search"
  | "coins"
  | "scooter"
  | "printer"
  | "sparkle";

type Props = {
  kind: StickerKind;
  className?: string;
  motion?: "float" | "wiggle" | "none";
};

const TEAL = "#00E5B0";
const INK = "#1E293B";
const PAPER = "#E2E8F0";

function Art({ kind }: { kind: StickerKind }) {
  switch (kind) {
    case "empty-box":
      return (
        <>
          <ellipse cx="48" cy="78" rx="26" ry="4" fill={INK} opacity="0.55" />
          <path d="M26 40h44v32a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V40z" fill={INK} />
          <path d="M26 40l8-12h28l8 12" stroke={TEAL} strokeWidth="3" strokeLinejoin="round" />
          <path d="M26 40h44" stroke={TEAL} strokeWidth="3" />
          <path d="M44 40v20" stroke={PAPER} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <circle cx="70" cy="26" r="2.5" fill={TEAL} />
          <circle cx="78" cy="34" r="1.6" fill={TEAL} opacity="0.7" />
        </>
      );

    case "search":
      return (
        <>
          <circle cx="44" cy="42" r="22" stroke={TEAL} strokeWidth="3.5" fill="none" />
          <circle cx="44" cy="42" r="22" fill={INK} opacity="0.35" />
          <path d="M60 58l14 14" stroke={TEAL} strokeWidth="5" strokeLinecap="round" />
          <path d="M34 40h20M34 48h13" stroke={PAPER} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        </>
      );

    case "coins":
      return (
        <>
          <ellipse cx="48" cy="66" rx="22" ry="6" fill={TEAL} opacity="0.25" />
          <circle cx="48" cy="50" r="18" fill={INK} stroke={TEAL} strokeWidth="3" />
          <path d="M48 42v16M44 46h6a3 3 0 0 1 0 6h-6" stroke={TEAL} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <circle cx="66" cy="34" r="9" fill={INK} stroke={TEAL} strokeWidth="2.4" />
          <circle cx="30" cy="30" r="5" fill={TEAL} opacity="0.5" />
        </>
      );

    case "scooter":
      return (
        <>
          <ellipse cx="48" cy="76" rx="26" ry="4" fill={INK} opacity="0.55" />
          <circle cx="32" cy="66" r="9" fill="none" stroke={TEAL} strokeWidth="3.5" />
          <circle cx="66" cy="66" r="9" fill="none" stroke={TEAL} strokeWidth="3.5" />
          <path d="M32 66h18l6-22h10" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M46 44h12" stroke={PAPER} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="40" y="30" width="16" height="12" rx="3" fill={INK} stroke={TEAL} strokeWidth="2.6" />
          <path d="M44 36h8" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );

    case "printer":
      return (
        <>
          <rect x="28" y="20" width="40" height="18" rx="3" fill={PAPER} opacity="0.85" />
          <rect x="20" y="38" width="56" height="26" rx="5" fill={INK} stroke={TEAL} strokeWidth="3" />
          <rect x="32" y="54" width="32" height="18" rx="3" fill={PAPER} />
          <path d="M38 60h20M38 66h14" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="66" cy="46" r="3" fill={TEAL} />
        </>
      );

    case "sparkle":
      return (
        <>
          <path d="M48 22l4.5 12.5L65 39l-12.5 4.5L48 56l-4.5-12.5L31 39l12.5-4.5L48 22z" fill={TEAL} />
          <path d="M70 52l2.6 7.2L80 62l-7.4 2.8L70 72l-2.6-7.2L60 62l7.4-2.8L70 52z" fill={TEAL} opacity="0.65" />
          <path d="M26 54l2 5.6L34 62l-6 2.4L26 70l-2-5.6L18 62l6-2.4L26 54z" fill={TEAL} opacity="0.4" />
        </>
      );
  }
}

export default function Sticker({ kind, className = "", motion = "float" }: Props) {
  const motionClass = motion === "float" ? "rq-float" : motion === "wiggle" ? "rq-wiggle" : "";

  return (
    <svg
      viewBox="0 0 96 96"
      className={`${motionClass} ${className}`.trim()}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <Art kind={kind} />
    </svg>
  );
}
