import { useState } from 'react';
import styles from './WeightDots.module.css';

const LEVELS = [1, 2, 3] as const;
const NAME: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

type WeightDotsProps = {
    weight: number;
    onChange: (weight: number) => void;
};

export function WeightDots({ weight, onChange }: WeightDotsProps) {
    const [hint, setHint] = useState<number | null>(null);
    return (
        <div
            className={styles.dots}
            role="radiogroup"
            aria-label="Weight"
            data-hint={hint === null ? '' : NAME[hint]}
        >
            {LEVELS.map((level) => (
                <button
                    key={level}
                    type="button"
                    className={styles.seg}
                    role="radio"
                    aria-checked={level === weight}
                    aria-label={NAME[level]}
                    onMouseEnter={() => setHint(level)}
                    onMouseLeave={() => setHint(null)}
                    onFocus={() => setHint(level)}
                    onBlur={() => setHint(null)}
                    onClick={() => onChange(level)}
                >
                    <span className={level <= weight ? `${styles.pip} ${styles.on}` : styles.pip} />
                </button>
            ))}
        </div>
    );
}
