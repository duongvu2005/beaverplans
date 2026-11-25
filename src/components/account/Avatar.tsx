import styles from './Avatar.module.css';

type AvatarProps = {
    /** a per-user image; no call site passes one, so the drawing below is what shows */
    src?: string;
    /** rendered size in px; the drawing scales, the stroke weights do not */
    size?: number;
    /** Accessible name; empty by default, since call sites sit inside a labelled control. */
    alt?: string;
    /** for the caller's own spacing only — this draws its whole circle itself */
    className?: string;
};

/** The default account picture: a cat, drawn rather than uploaded. */
export function Avatar({ src, size = 22, alt = '', className }: AvatarProps) {
    const classes = className === undefined ? styles.cat : `${styles.cat} ${className}`;
    if (src !== undefined) {
        const imgClasses = className === undefined ? styles.image : `${styles.image} ${className}`;
        return <img className={imgClasses} src={src} alt={alt} width={size} height={size} />;
    }
    return (
        <svg
            className={classes}
            width={size}
            height={size}
            viewBox="0 0 100 100"
            role={alt === '' ? undefined : 'img'}
            aria-label={alt === '' ? undefined : alt}
            aria-hidden={alt === '' ? true : undefined}
        >
            {/* The ring is the head, so this is the whole avatar:
                call sites must NOT wrap it in a second circle. */}
            <circle className={styles.ring} cx="50" cy="50" r="45.5" />
            <path className={styles.line} d="M26 62 L34.4 30.8 L50 47.6 L65.6 30.8 L74 62" />
            <circle className={styles.eye} cx="43.6" cy="54.8" r="3.6" />
            <circle className={styles.eye} cx="56.4" cy="54.8" r="3.6" />
        </svg>
    );
}
