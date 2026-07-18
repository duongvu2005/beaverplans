type CloseIconProps = {
    className?: string;
};

// Delete — a plain ×, drawn at half the extent of the square/circle icons
// (spans 8→16 vs their 4→20), so it reads about half the size.
export function CloseIcon({ className }: CloseIconProps) {
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
            <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" />
        </svg>
    );
}
