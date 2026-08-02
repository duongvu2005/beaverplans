// Support — an outlined heart at the same 16px/1.5 weight as the other chrome
// glyphs, so it sits beside the theme toggle without shouting.
export function HeartIcon() {
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
            <path d="M8 13.2S2.4 9.9 2.4 6.4a2.9 2.9 0 0 1 5.6-1.1 2.9 2.9 0 0 1 5.6 1.1c0 3.5-5.6 6.8-5.6 6.8Z" />
        </svg>
    );
}
