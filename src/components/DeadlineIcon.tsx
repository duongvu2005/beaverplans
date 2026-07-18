type DeadlineIconProps = {
    className?: string;
};

// Deadline — a clock: circle with hands from 12 o'clock to center to 3 o'clock.
export function DeadlineIcon({ className }: DeadlineIconProps) {
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
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4 V12 H20" />
        </svg>
    );
}
