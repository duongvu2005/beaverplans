// Week-stepper chevron. One component with a direction rather than two icons,
// so the pair can never drift apart in weight or size.
export function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
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
            <path d={dir === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} />
        </svg>
    );
}
