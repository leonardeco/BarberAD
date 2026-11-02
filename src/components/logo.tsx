import { useId } from "react";

export function LogoMark({ size = 40 }: { size?: number }) {
  const clip = useId();
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 64 64" width={size}>
      <defs>
        <clipPath id={clip}>
          <rect height="38" rx="7" width="14" x="25" y="13" />
        </clipPath>
      </defs>
      <rect fill="#0F172A" height="64" rx="16" stroke="rgba(248,250,252,0.12)" strokeWidth="2" width="64" />
      <rect fill="#D97706" height="46" rx="11" width="22" x="21" y="9" />
      <rect fill="#0F172A" height="38" rx="7" width="14" x="25" y="13" />
      <g clipPath={`url(#${clip})`} fill="#D97706">
        <path d="M20 21 44 9v7L20 28z" />
        <path d="M20 35 44 23v7L20 42z" />
        <path d="M20 49 44 37v7L20 56z" />
      </g>
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={size} />
      <span className="text-xl font-bold tracking-tight">
        Barber<span className="text-[#D97706]">AD</span>
      </span>
    </span>
  );
}
