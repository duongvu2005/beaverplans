import styles from './Avatar.module.css';

type AvatarProps = {
    /**
     * A per-user image, when there is one. Nothing sets this today — uploads
     * would need a storage bucket, its policies, and size limits, which is a
     * different piece of work. The prop exists so that work is a drop-in rather
     * than a rewrite of every call site: the old app carried the same unused
     * escape hatch, and it is the reason this component can stay a leaf.
     */
    src?: string;
    /** rendered size in px; the drawing scales, the stroke weights do not */
    size?: number;
    /**
     * Accessible name. Left empty by default because every current call site
     * sits inside a control that is already labelled (the account chip names the
     * user; the phone's slot is labelled "Account"), and a second name there
     * would just be read twice.
     */
    alt?: string;
    /** for the caller's own spacing only — this draws its whole circle itself */
    className?: string;
};

/**
 * The default account picture: a cat, drawn rather than uploaded.
 *
 * A monogram was the other candidate and was rejected on purpose — it needs a
 * name to be a letter of, so it would break for a signed-in account whose
 * username has not been set, and the per-user colour it wants is a second
 * identity signal competing with the username right beside it. One drawn mark
 * for everybody says "this is you" without claiming to distinguish you, which is
 * all the chip actually needs.
 */
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
            {/* The old app's drawing, unchanged. The ring is the head — a filled
                disc, not an outline around something else — so this is the whole
                circular avatar and call sites must NOT wrap it in a second circle.
                What makes it read as a cat at this size is the colour split (see
                the CSS): accent features on a paper face. Drawn all in one ink it
                turns into a letter M in a circle. */}
            <circle className={styles.ring} cx="50" cy="50" r="45.5" />
            {/* The old app's own path and eyes, scaled 1.2x about the head's centre
                and squared up left-to-right. Unscaled they sit in the middle third
                of the disc, so enlarging the avatar only ever produced a bigger
                circle with the same small mark adrift in it — but much past this the
                ears crowd the head's own outline. */}
            <path className={styles.line} d="M26 62 L34.4 30.8 L50 47.6 L65.6 30.8 L74 62" />
            <circle className={styles.eye} cx="43.6" cy="54.8" r="3.6" />
            <circle className={styles.eye} cx="56.4" cy="54.8" r="3.6" />
        </svg>
    );
}
