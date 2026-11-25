import { useState } from 'react';
import { WeightDots } from './WeightDots';
import { Dialog } from '@/components/shared/Dialog';
import { useCopy } from '@/i18n/localeContext';
import styles from './WeightChip.module.css';

const LEVELS = [1, 2, 3] as const;

type Level = (typeof LEVELS)[number];

// Level to catalog key; the words themselves live in the catalog.
const KEY = { 1: 'easy', 2: 'medium', 3: 'hard' } as const;

// A symbol in every language, so it stays here rather than in the catalog.
const MULT: Record<Level, string> = { 1: '×1', 2: '×2', 3: '×3' };

// A subtask's weight is 1..3, but the prop is a number: an unclamped lookup renders "Weight: undefined".
function asLevel(weight: number): Level {
    if (weight <= 1) return 1;
    return weight >= 3 ? 3 : 2;
}

type WeightChipProps = {
    weight: number;
    onChange: (weight: number) => void;
    label?: string;
};

function Pips({ weight, large = false }: { weight: number; large?: boolean }) {
    return (
        <span className={styles.pips}>
            {LEVELS.map((l) => {
                const cls = [styles.pip, large ? styles.lg : '', l <= weight ? styles.on : '']
                    .filter(Boolean)
                    .join(' ');
                return <span key={l} className={cls} />;
            })}
        </span>
    );
}

export function WeightChip({ weight, onChange, label }: WeightChipProps) {
    const { common, weightChip } = useCopy();
    const [open, setOpen] = useState(false);
    const nameOf = (level: Level) => common.weights[KEY[level]];
    const titleId = 'weight-sheet-title';
    return (
        <span className={styles.wrap}>
            <span className={styles.fine}>
                <WeightDots weight={weight} onChange={onChange} />
            </span>
            <button
                type="button"
                className={styles.chip}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={weightChip.weightOf(nameOf(asLevel(weight)))}
                onClick={() => setOpen(true)}
            >
                <Pips weight={weight} />
            </button>
            <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
                <div className={styles.sheet}>
                    <div className={styles.grab} />
                    <h4 id={titleId} className={styles.sheetTitle}>
                        {label === undefined ? weightChip.title : weightChip.titleOf(label)}
                    </h4>
                    <p className={styles.sheetSub}>{weightChip.hint}</p>
                    {LEVELS.map((l) => (
                        <button
                            key={l}
                            type="button"
                            className={l === weight ? `${styles.opt} ${styles.optSel}` : styles.opt}
                            onClick={() => {
                                onChange(l);
                                setOpen(false);
                            }}
                        >
                            <Pips weight={l} large />
                            <span className={styles.optLabel}>{nameOf(l)}</span>
                            <span className={styles.optMeta}>{weightChip.counts(MULT[l])}</span>
                        </button>
                    ))}
                </div>
            </Dialog>
        </span>
    );
}
