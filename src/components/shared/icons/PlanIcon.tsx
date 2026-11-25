type PlanIconProps = {
    className?: string;
};

// A 2x2 grid, because the week board is one.
export function PlanIcon({ className }: PlanIconProps) {
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
            <rect x="3.4" y="3.4" width="6.6" height="6.6" rx="1.3" />
            <rect x="14" y="3.4" width="6.6" height="6.6" rx="1.3" />
            <rect x="3.4" y="14" width="6.6" height="6.6" rx="1.3" />
            <rect x="14" y="14" width="6.6" height="6.6" rx="1.3" />
        </svg>
    );
}
