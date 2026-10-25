export default function SignInLoader({ label = "Connecting to GitHub" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm"
    >
      <svg viewBox="0 0 80 96" className="h-28 w-24" aria-hidden="true">
        {/* Document */}
        <path
          d="M12 4h38l22 22v62a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="2"
        />
        <path d="M50 4v18a4 4 0 0 0 4 4h18z" fill="#bfdbfe" />
        {/* Text lines that light up as they are "read" */}
        <rect className="ad-line" style={{ animationDelay: "0s" }} x="18" y="36" width="40" height="5" rx="2.5" />
        <rect className="ad-line" style={{ animationDelay: "0.3s" }} x="18" y="48" width="46" height="5" rx="2.5" />
        <rect className="ad-line" style={{ animationDelay: "0.6s" }} x="18" y="60" width="34" height="5" rx="2.5" />
        <rect className="ad-line" style={{ animationDelay: "0.9s" }} x="18" y="72" width="42" height="5" rx="2.5" />
        {/* Magnifying glass scanning the page */}
        <g className="ad-scan">
          <circle cx="30" cy="44" r="10" fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth="4" />
          <path d="M37.5 51.5l8 8" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>

      <p className="mt-6 text-sm font-medium text-slate-700">
        {label}
        <span className="ad-dot" style={{ animationDelay: "0s" }}>.</span>
        <span className="ad-dot" style={{ animationDelay: "0.2s" }}>.</span>
        <span className="ad-dot" style={{ animationDelay: "0.4s" }}>.</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">This only takes a moment</p>
    </div>
  );
}
