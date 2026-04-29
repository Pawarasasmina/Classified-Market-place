type CategoryIconProps = {
  slug: string;
  className?: string;
};

function iconClasses(className?: string) {
  return className ?? "h-6 w-6";
}

export function CategoryIcon({ slug, className }: CategoryIconProps) {
  switch (slug) {
    case "electronics":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <rect x="7" y="2.75" width="10" height="18.5" rx="2.4" />
          <path d="M10 6h4" />
          <path d="M11.25 17.5h1.5" />
        </svg>
      );
    case "jobs":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <path d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7" />
          <rect x="3" y="7" width="18" height="12.5" rx="2.4" />
          <path d="M3 12.25h18" />
          <path d="M10 12.25v2h4v-2" />
        </svg>
      );
    case "motors":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <circle cx="7.5" cy="16.5" r="2.25" />
          <circle cx="16.5" cy="16.5" r="2.25" />
          <path d="M4 16V11.8a2 2 0 0 1 2-2h8.6a3 3 0 0 1 2.3 1.05l1.8 2.1a2.5 2.5 0 0 1 .6 1.6V16" />
          <path d="M9 9.8l1.25-3h3.5" />
        </svg>
      );
    case "property":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.25 9.75V20h11.5V9.75" />
          <path d="M9.25 20v-5.25h5.5V20" />
        </svg>
      );
    case "services":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <path d="M14.5 4.5a3.5 3.5 0 0 0-4.95 4.95l5.45 5.45a3.5 3.5 0 1 0 4.95-4.95l-5.45-5.45Z" />
          <path d="m8.5 10.5-4 4" />
          <path d="m5 19 2.2-2.2" />
          <path d="m3.75 16.75 3.5 3.5" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClasses(className)}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.5v3.5l2.5 2.5" />
        </svg>
      );
  }
}
