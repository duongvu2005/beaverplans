type CopyIconProps = {
    className?: string;
};

// Copy this week's plan — two overlapping squares, same rect+path recipe as EditIcon.
export function CopyIcon({ className }: CopyIconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
        >
            <rect x="7.8" y="7.8" width="12" height="12" rx="2.4" />
            <path
                d="M16.2 7.8V5.1a1.8 1.8 0 0 0-1.8-1.8H5.1a1.8 1.8 0 0 0-1.8 1.8v9.3a1.8 1.8 0 0 0 1.8 1.8h2.7"
                strokeLinecap="round"
            />
        </svg>
    );
}
