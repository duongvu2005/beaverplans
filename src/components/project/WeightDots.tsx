import { useState } from 'react';
import { useCopy } from '@/i18n/localeContext';
import styles from './WeightDots.module.css';

const LEVELS = [1, 2, 3] as const;

// Level to catalog key; the words themselves live in the catalog.
const KEY = { 1: 'easy', 2: 'medium', 3: 'hard' } as const;

type Level = (typeof LEVELS)[number];

type WeightDotsProps = {
    weight: number;
    onChange: (weight: number) => void;
};

export function WeightDots({ weight, onChange }: WeightDotsProps) {
    const { common, weightDots } = useCopy();
    const [hint, setHint] = useState<Level | null>(null);
    const nameOf = (level: Level) => common.weights[KEY[level]];
    return (
        <div
            className={styles.dots}
            role="radiogroup"
            aria-label={weightDots.label}
            data-hint={hint === null ? '' : nameOf(hint)}
        >
            {LEVELS.map((level) => (
                <button
                    key={level}
                    type="button"
                    className={styles.seg}
                    role="radio"
                    aria-checked={level === weight}
                    aria-label={nameOf(level)}
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
