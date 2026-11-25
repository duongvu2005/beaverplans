import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
import { vi as viCatalog } from '@/i18n/vi';
import { Heatmap, HeatmapLegend } from './Heatmap';
import { heatColumns } from './heatColumns';

describe('Heatmap', () => {
    /*
     * Testing strategy — a column says whether it opens a month, this names it,
     * so the cases are about the strip. The cells are geometry and belong to
     * heatColumns; the shades are CSS.
     *
     *   partition on the label's language: en | vi
     *   partition on a column's position in its month: opens it | does not
     */

    // 52 weeks back from Mon Aug 10 2026 reaches Aug 2025, so the strip spans a
    // full year and names both ends.
    const columns = heatColumns(new Map(), new Set(), '2026-08-10', '2026-08-10');

    /** The labels actually drawn, in column order. Class names are hashed. */
    function strip(container: HTMLElement): string[] {
        return [...container.querySelectorAll('[class*="month"] span')].map(
            (node) => node.textContent ?? '',
        );
    }

    it('covers en: a year-long window names every month it crosses', () => {
        const { container } = render(<Heatmap columns={columns} />);
        const labels = strip(container);
        expect(labels).toContain('Aug');
        expect(labels).toContain('Dec');
        expect(labels.at(-1)).toBe('Aug');
    });

    it('covers vi: the same strip in the numeric Vietnamese forms', () => {
        localStorage.setItem('beaverplans:locale', 'vi');
        const { container } = render(
            <LocaleProvider>
                <Heatmap columns={columns} />
            </LocaleProvider>,
        );
        localStorage.clear();
        const labels = strip(container);
        expect(labels).toContain('Th8');
        expect(labels).toContain('Th12');
        expect(labels).not.toContain('Aug');
    });

    it('covers only the column that opens a month carrying a label', () => {
        const { container } = render(<Heatmap columns={columns} />);
        const opens = columns.filter((column) => column.opensMonth).length;
        expect(opens).toBe(13); // Aug 2025 through Aug 2026
        expect(strip(container)).toHaveLength(opens);
    });

    /*
     * A cell's tooltip lives in a title attribute, invisible to every assertion
     * above, which reads text nodes. The date inside stays the grid's ISO key:
     * the chart spans a year, so a day without its year would be ambiguous.
     */
    // One archived week (Aug 3) with 3 units finished on the Wednesday; every
    // other week in the window was never archived.
    const withOneWeek = heatColumns(
        new Map([['2026-08-05', 3]]),
        new Set(['2026-08-03']),
        '2026-08-10',
        '2026-08-10',
    );

    function titleOf(container: HTMLElement, date: string): string | null {
        return container.querySelector(`[title^="${date}:"]`)?.getAttribute('title') ?? null;
    }

    it('covers a tracked cell and an untracked week, in English', () => {
        const { container } = render(<Heatmap columns={withOneWeek} />);

        expect(titleOf(container, '2026-08-05')).toBe(en.heatmap.cellUnits('2026-08-05', 3));
        expect(titleOf(container, '2026-07-27')).toBe(en.heatmap.cellUntracked('2026-07-27'));
    });

    it('covers vi: the prose translates and the ISO date does not', () => {
        const { container } = renderIn('vi', <Heatmap columns={withOneWeek} />);

        expect(titleOf(container, '2026-08-05')).toBe(viCatalog.heatmap.cellUnits('2026-08-05', 3));
        expect(titleOf(container, '2026-07-27')).toBe(
            viCatalog.heatmap.cellUntracked('2026-07-27'),
        );
        expect(container.innerHTML).not.toContain('week not tracked');
    });
});

describe('HeatmapLegend', () => {
    it('captions the shades Less … More', () => {
        render(<HeatmapLegend />);
        expect(screen.getByText(en.heatmap.less)).toBeInTheDocument();
        expect(screen.getByText(en.heatmap.more)).toBeInTheDocument();
    });

    it('covers vi: both captions come from the catalog', () => {
        renderIn('vi', <HeatmapLegend />);
        expect(screen.getByText(viCatalog.heatmap.less)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.heatmap.more)).toBeInTheDocument();
        expect(screen.queryByText(en.heatmap.less)).toBeNull();
        expect(screen.queryByText(en.heatmap.more)).toBeNull();
    });
});
