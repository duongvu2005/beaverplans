// Chevron, by direction. One component rather than an icon per direction, so
// they can never drift apart in weight or size: the week stepper's left/right
// pair and the account chip's "this opens something" caret are the same mark.
const PATH = {
    left: 'M10 3.5 5.5 8l4.5 4.5',
    right: 'M6 3.5 10.5 8 6 12.5',
    down: 'M3.5 6 8 10.5 12.5 6',
} as const;

export function ChevronIcon({ dir }: { dir: keyof typeof PATH }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={PATH[dir]} />
        </svg>
    );
}
