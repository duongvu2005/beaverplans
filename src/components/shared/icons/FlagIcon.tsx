type FlagIconProps = {
    className?: string;
};

// A flag planted on a date, filled rather than stroked: it is drawn at 11px,
// where a hollow interior closes up.
export function FlagIcon({ className }: FlagIconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M7 3.5 V21"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
            />
            <path d="M8.4 4.6 H19 L16 9 L19 13.4 H8.4 Z" fill="currentColor" />
        </svg>
    );
}
