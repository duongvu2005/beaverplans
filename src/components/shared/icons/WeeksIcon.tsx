type WeeksIconProps = {
    className?: string;
};

// A calendar. Adapted from SVG Repo's CC0 "calendar" (id 521530), redrawn as an
// outline so it carries the same stroke weight as its neighbours in the tab bar.
export function WeeksIcon({ className }: WeeksIconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="3" y="4.4" width="18" height="17" rx="2.4" />
            <path d="M3 9.8h18" />
            <path d="M7.6 2.4v3.4" />
            <path d="M16.4 2.4v3.4" />
        </svg>
    );
}
