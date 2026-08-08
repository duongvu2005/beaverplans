// Support — a heart at the same 16px box as the other chrome glyphs, but
// FILLED rather than outlined. This link asks for a donation, not for a bug
// report, and a hollow heart beside a hollow theme disc reads as one more
// utility; a solid one reads as a gift. Tinted --accent by its caller, the way
// the old app's did.
export function HeartIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M8 13.2S2.4 9.9 2.4 6.4a2.9 2.9 0 0 1 5.6-1.1 2.9 2.9 0 0 1 5.6 1.1c0 3.5-5.6 6.8-5.6 6.8Z" />
        </svg>
    );
}
