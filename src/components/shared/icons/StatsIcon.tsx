type StatsIconProps = {
    className?: string;
};

// Three columns on a shared floor. Drawn as one outline rather than three boxes:
// the columns touch, and separate boxes would double every shared edge.
export function StatsIcon({ className }: StatsIconProps) {
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
            <path d="M9 7H4.6A1.6 1.6 0 0 0 3 8.6v10.8A1.6 1.6 0 0 0 4.6 21H9" />
            <path d="M9 21h6" />
            <path d="M9 21V4.6A1.6 1.6 0 0 1 10.6 3h2.8A1.6 1.6 0 0 1 15 4.6V21" />
            <path d="M15 11h4.4A1.6 1.6 0 0 1 21 12.6v6.8A1.6 1.6 0 0 1 19.4 21H15" />
        </svg>
    );
}
