type EditIconProps = {
    className?: string;
};

// Task editor — same as the deadline clock but a sharp square outline.
export function EditIcon({ className }: EditIconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <rect x="4" y="4" width="16" height="16" />
            <path d="M12 4 V12 H20" />
        </svg>
    );
}
