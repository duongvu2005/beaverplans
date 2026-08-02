// The account slot's glyph: head and shoulders, outlined. Stands in for an
// avatar until there is an account to draw one from.
export function UserIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="8" cy="5.6" r="2.6" />
            <path d="M3.2 13.2a4.8 4.8 0 0 1 9.6 0" />
        </svg>
    );
}
