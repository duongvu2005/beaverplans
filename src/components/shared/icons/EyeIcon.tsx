type EyeIconProps = {
    className?: string;
};

// Reveal-password toggle glyphs. Drawn at the same 24-box, 1.5 stroke as the
// rest of the icon set, so they sit at the same weight as CloseIcon et al.
export function EyeIcon({ className }: EyeIconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6Z" />
            <circle cx="12" cy="12" r="2.6" />
        </svg>
    );
}

export function EyeOffIcon({ className }: EyeIconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M10.7 6.2A9.4 9.4 0 0 1 12 6c5.7 0 9 6 9 6a15 15 0 0 1-2.4 3M6.5 7.1A14.6 14.6 0 0 0 3 12s3.3 6 9 6a9.3 9.3 0 0 0 3.6-.7" />
            <path d="M10.1 10.1a2.6 2.6 0 0 0 3.7 3.7" />
            <path d="M4 4l16 16" />
        </svg>
    );
}
