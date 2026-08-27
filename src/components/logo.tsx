/**
 * Premium Resolvaio logo — shield + scale icon with wordmark.
 * Used across nav, auth pages, and footer for consistent branding.
 */

export function LogoIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Shield shape */}
      <path
        d="M20 3L6 9V18C6 27.94 12.04 37.28 20 39C27.96 37.28 34 27.94 34 18V9L20 3Z"
        fill="#111111"
      />
      {/* Inner shield highlight */}
      <path
        d="M20 6L9 11V18C9 26.28 14.22 34.02 20 35.8C25.78 34.02 31 26.28 31 18V11L20 6Z"
        fill="#1A1A1A"
      />
      {/* Scale/balance inside shield */}
      {/* Pillar */}
      <rect x="19" y="13" width="2" height="14" rx="1" fill="#F7F7F5" />
      {/* Beam */}
      <rect x="12" y="14.5" width="16" height="1.5" rx="0.75" fill="#F7F7F5" />
      {/* Left pan */}
      <path d="M12 15.5L10 21H14L12 15.5Z" fill="#F7F7F5" opacity="0.9" />
      <ellipse cx="12" cy="21.5" rx="2.5" ry="0.8" fill="#F7F7F5" opacity="0.9" />
      {/* Right pan */}
      <path d="M28 15.5L26 21H30L28 15.5Z" fill="#F7F7F5" opacity="0.9" />
      <ellipse cx="28" cy="21.5" rx="2.5" ry="0.8" fill="#F7F7F5" opacity="0.9" />
      {/* Base */}
      <rect x="16" y="27" width="8" height="1.5" rx="0.75" fill="#F7F7F5" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon className="h-8 w-8" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Resolvaio
      </span>
    </div>
  );
}

export function LogoLight({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon className="h-8 w-8" />
      <span className="text-lg font-semibold tracking-tight text-white">
        Resolvaio
      </span>
    </div>
  );
}
