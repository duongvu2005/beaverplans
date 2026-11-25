type ArrowRightIconProps = {
    className?: string;
};

export function ArrowRightIcon({ className }: ArrowRightIconProps) {
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
            <path d="M5 12H19M19 12L13 6M19 12L13 18" />
        </svg>
    );
}
