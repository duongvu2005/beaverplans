import { useState } from 'react';
import { WeightDots } from './WeightDots';
import { Dialog } from './Dialog';
import styles from './WeightChip.module.css';

const LEVELS = [1, 2, 3] as const;
const NAME: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const MULT: Record<number, string> = { 1: '×1', 2: '×2', 3: '×3' };

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
    const [open, setOpen] = useState(false);
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
                aria-label={`Weight: ${NAME[weight]}`}
                onClick={() => setOpen(true)}
            >
                <Pips weight={weight} />
            </button>
            <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
                <div className={styles.sheet}>
                    <div className={styles.grab} />
                    <h4 id={titleId} className={styles.sheetTitle}>
                        Weight{label ? ` — ${label}` : ''}
                    </h4>
                    <p className={styles.sheetSub}>Harder subtasks count for more of the day.</p>
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
                            <span className={styles.optLabel}>{NAME[l]}</span>
                            <span className={styles.optMeta}>counts {MULT[l]}</span>
                        </button>
                    ))}
                </div>
            </Dialog>
        </span>
    );
}
