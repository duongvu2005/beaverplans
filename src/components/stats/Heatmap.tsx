import { useLayoutEffect, useRef } from 'react';
import type { DayOfWeek } from '@/core/types';
import { dayName, monthLabel } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import type { HeatColumn } from './heatColumns';
import styles from './Heatmap.module.css';

/* Every other row: seven 9px rows cannot carry seven legible letters. */
const AXIS_DAYS: ReadonlyArray<DayOfWeek | null> = ['mon', null, 'wed', null, 'fri', null, 'sun'];

type HeatmapProps = {
    columns: ReadonlyArray<HeatColumn>;
    className?: string;
};

/** A year of scheduled work as a day grid, one column per week, oldest first. Width and overflow are the caller's. */
export function Heatmap({ columns, className }: HeatmapProps) {
    const grid = useRef<HTMLDivElement>(null);
    const { locale } = useLocale();
    const { heatmap } = useCopy();

    // A scroll container opens at its left, and the newest week is the
    // rightmost column. Before paint, so there is no jump.
    useLayoutEffect(() => {
        const node = grid.current;
        if (node !== null) node.scrollLeft = node.scrollWidth;
    }, [columns]);

    return (
        <div className={className ? `${styles.heat} ${className}` : styles.heat} ref={grid}>
            <div className={styles.axis} aria-hidden="true">
                {AXIS_DAYS.map((day, row) => (
                    <div key={row} className={styles.axisLabel}>
                        {day === null ? '' : dayName(day, locale, 'letter')}
                    </div>
                ))}
            </div>
            <div className={styles.grid}>
                {columns.map((column) => (
                    <div key={column.key} className={styles.column}>
                        <div className={styles.month}>
                            {column.opensMonth && <span>{monthLabel(column.key, locale)}</span>}
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
                                        ? heatmap.cellUntracked(cell.key)
                                        : heatmap.cellUnits(cell.key, cell.count)
                                }
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The five shades, least to most, captioned Less … More. */
export function HeatmapLegend() {
    const { heatmap } = useCopy();
    return (
        <div className={styles.legend}>
            <span>{heatmap.less}</span>
            {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className={styles.cell} data-level={level} />
            ))}
            <span>{heatmap.more}</span>
        </div>
    );
}
