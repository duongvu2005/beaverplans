import { useLayoutEffect, useRef } from 'react';
import type { HeatColumn } from './heatColumns';
import styles from './Heatmap.module.css';

/* Every other row: seven 9px rows cannot carry seven legible letters, and the
   unnamed rows are unambiguous once their neighbours are named. */
const AXIS = ['M', '', 'W', '', 'F', '', 'S'];

type HeatmapProps = {
    columns: ReadonlyArray<HeatColumn>;
};

/**
 * A year of scheduled work as a day grid, one column per week, oldest first.
 *
 * Shows only work that had a day to sit on — a leaf task carries no weekday,
 * so it cannot appear here at all. The caller states that shortfall in words
 * next to the chart rather than letting the grid quietly under-report.
 */
export function Heatmap({ columns }: HeatmapProps) {
    const scroller = useRef<HTMLDivElement>(null);

    // The newest week is the rightmost column and the one worth seeing, but a
    // scroll container opens at its left. Before paint, so there is no jump.
    useLayoutEffect(() => {
        const node = scroller.current;
        if (node !== null) node.scrollLeft = node.scrollWidth;
    }, [columns]);

    return (
        <div className={styles.scroller} ref={scroller}>
            <div className={styles.heat}>
                <div className={styles.axis} aria-hidden="true">
                    {AXIS.map((letter, row) => (
                        <div key={row} className={styles.axisLabel}>
                            {letter}
                        </div>
                    ))}
                </div>
                <div className={styles.grid}>
                    {columns.map((column) => (
                        <div key={column.key} className={styles.column}>
                            <div className={styles.month}>
                                {column.month && <span>{column.month}</span>}
                            </div>
                            {column.cells.map((cell) => (
                                <div
                                    key={cell.key}
                                    // A tracked cell is styled by its level alone;
                                    // the other two states are the modifiers.
                                    className={
                                        cell.state === 'tracked'
                                            ? styles.cell
                                            : `${styles.cell} ${styles[cell.state]}`
                                    }
                                    data-level={cell.state === 'tracked' ? cell.level : undefined}
                                    title={
                                        cell.state === 'untracked'
                                            ? `${cell.key}: week not tracked`
                                            : `${cell.key}: ${cell.count} units`
                                    }
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** The five shades, least to most, captioned Less … More. */
export function HeatmapLegend() {
    return (
        <div className={styles.legend}>
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className={styles.cell} data-level={level} />
            ))}
            <span>More</span>
        </div>
    );
}
