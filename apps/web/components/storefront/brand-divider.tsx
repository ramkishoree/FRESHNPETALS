/** Purely decorative section-break motif for the storefront redesign. */
export function BrandDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`leaf-divider ${className}`} role="presentation" aria-hidden="true">
      <svg
        width="34"
        height="18"
        viewBox="0 0 34 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17 2c-2.2 2.1-2.2 6 0 8.6 2.2-2.6 2.2-6.5 0-8.6Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M8 8c1.9-.6 4.6 0 6.4 1.9-2.4 1-4.9.7-6.4-1.9Z"
          fill="currentColor"
          opacity="0.7"
        />
        <path
          d="M26 8c-1.9-.6-4.6 0-6.4 1.9 2.4 1 4.9.7 6.4-1.9Z"
          fill="currentColor"
          opacity="0.7"
        />
        <circle cx="17" cy="13.5" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
}
