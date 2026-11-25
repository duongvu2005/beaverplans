import { describe, expect, it } from 'vitest';
import { catalogFor } from './catalog';
// ?raw rather than node:fs: @types/node is out of tsconfig.app's "types", and
// the alignment check below is about the files as text.
import EN_SOURCE from './en.ts?raw';
import VI_SOURCE from './vi.ts?raw';
import { en } from './en';
import { vi } from './vi';

describe('catalogFor', () => {
    /*
     * Testing strategy
     *
     * partition on locale:
     *   en; vi
     */

    it('covers en', () => {
        expect(catalogFor('en')).toBe(en);
    });

    it('covers vi', () => {
        expect(catalogFor('vi')).toBe(vi);
    });
});

/** A leaf of a catalog: the words, or a function producing them. */
type Entry = string | ((...args: readonly string[]) => string);

/**
 * Every leaf of a catalog, keyed by its dotted path.
 *
 * Recurses, though the catalogs are nested only a block deep: a check that
 * walked one level would go quiet rather than fail the day something nested
 * further.
 */
function leaves(node: object, prefix = ''): Map<string, Entry> {
    const found = new Map<string, Entry>();
    for (const [key, value] of Object.entries(node)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (typeof value === 'object' && value !== null) {
            for (const [nested, entry] of leaves(value, path)) found.set(nested, entry);
        } else {
            found.set(path, value as Entry);
        }
    }
    return found;
}

/** What an entry renders, with a stand-in for each value it interpolates. */
function render(entry: Entry): string {
    return typeof entry === 'function' ? entry(...Array<string>(entry.length).fill('x')) : entry;
}

describe('the catalogs themselves', () => {
    /*
     * The type system already refuses a vi catalog with a missing or misspelled
     * key at any depth, so these cover what it cannot: a cast or a widened type
     * slipping one through, and an entry translated to the empty string.
     *
     * partition on the check:
     *   key sets agree; entry kinds agree; entry arities agree; no entry is
     *   blank
     * partition on depth:
     *   a leaf directly on the catalog; a leaf inside a block
     */

    const source = leaves(en);
    const translated = leaves(vi);

    it('covers the key sets agreeing, at every depth', () => {
        expect([...translated.keys()].sort()).toEqual([...source.keys()].sort());
    });

    it('covers the entry kinds agreeing', () => {
        for (const [path, entry] of source) {
            expect(typeof translated.get(path), `${path} is a different kind of entry`).toBe(
                typeof entry,
            );
        }
    });

    // The one gap the types leave: a function taking fewer arguments is
    // assignable to one taking more, so `() => 'Chuyển sang'` satisfies
    // `(name: string) => string` and quietly drops the name.
    it('covers the entry arities agreeing', () => {
        for (const [path, entry] of source) {
            const other = translated.get(path);
            if (typeof entry === 'function' && typeof other === 'function') {
                expect(other.length, `${path} takes fewer values than English does`).toBe(
                    entry.length,
                );
            }
        }
    });

    /*
     * The one shape a blank is allowed to be: a positional fragment either side
     * of an embedded element, in a language that wants no word in that position
     * — English puts nothing before the WeekRef where Vietnamese needs `Tuan `.
     * Every other blank is an entry someone forgot to write, so the exemption is
     * by path rather than by "positional entries may be empty".
     */
    const MAY_BE_BLANK = new Set(['app.queueOpenLead']);

    it('covers no entry being blank', () => {
        for (const catalog of [source, translated]) {
            for (const [path, entry] of catalog) {
                if (MAY_BE_BLANK.has(path)) continue;
                expect(render(entry).trim(), `${path} is blank`).not.toBe('');
            }
        }
    });

    it('covers the blank exemptions still existing as entries', () => {
        for (const catalog of [source, translated]) {
            for (const path of MAY_BE_BLANK) {
                expect(catalog.has(path), `${path} is exempt but no longer exists`).toBe(true);
            }
        }
    });

    // A block that exists but holds nothing would pass every check above by
    // having no leaves to fail one.
    it('covers every block holding something', () => {
        for (const catalog of [en, vi]) {
            for (const [name, block] of Object.entries(catalog)) {
                expect(Object.keys(block).length, `${name} is empty`).toBeGreaterThan(0);
            }
        }
    });

    /*
     * The positional entries are the sweep's one exception to keying a whole
     * sentence: `app`'s two header notes wrap an ELEMENT — a bolded run, a
     * clickable WeekRef — so the words either side of it are separate entries,
     * and the SPACING lives inside them rather than in the component.
     *
     * A missing or doubled space is invisible to every other check here, since
     * each half is a perfectly good non-blank string. It shows up only once the
     * pieces are joined.
     */
    describe('the positional entries around an embedded element', () => {
        for (const [name, catalog] of [
            ['en', en],
            ['vi', vi],
        ] as const) {
            it(`covers ${name}: the week-over note joins with single spaces`, () => {
                const { weekOverLead, weekOverAction, weekOverRest } = catalog.app;
                const joined = `${weekOverLead}${weekOverAction}${weekOverRest}`;

                expect(joined, 'a doubled space').not.toMatch(/ {2}/);
                // The bolded run is a phrase mid-sentence, so it needs air on
                // both sides.
                expect(weekOverLead, 'lead must end in a space').toMatch(/ $/);
                expect(weekOverRest, 'rest must start with a space').toMatch(/^ /);
                expect(weekOverAction.trim(), 'the action carries no padding').toBe(weekOverAction);
            });

            it(`covers ${name}: the queue note wraps the week it names`, () => {
                // A WeekRef renders between the two, so the lead hands off with
                // a space and the rest picks up with one. An empty lead is a
                // language saying nothing goes before the week; a lead of only
                // spaces is a typo.
                expect(catalog.app.queueOpenLead, 'lead must end in a space').toMatch(/^$|\S $/);
                expect(catalog.app.queueOpenRest).toMatch(/^ \S/);
            });

            it(`covers ${name}: the typed gate wraps the name it asks for`, () => {
                const { typeToConfirmLead, typeToConfirmRest } = catalog.confirmDialog;

                expect(typeToConfirmLead, 'lead must end in a space').toMatch(/\S $/);
                expect(typeToConfirmRest, 'rest must start with a space').toMatch(/^ \S/);
            });

            it(`covers ${name}: the focus line and the day tags open with their separator`, () => {
                // Each of these trails an element or a tag and supplies its own
                // leading separator, for the same reason.
                expect(catalog.weekView.focusing, 'focusing must end in a space').toMatch(/ $/);
                expect(catalog.weekView.focusingToday).toMatch(/^ /);
                expect(catalog.weekView.orClickAnyDay).toMatch(/^ · /);
                expect(catalog.dayCell.nowOn('X')).toMatch(/^ · /);
                expect(catalog.dayCell.reschedule).toMatch(/^ · /);
                expect(catalog.focusedDay.today).toMatch(/^ · /);
            });
        }
    });
});

describe('the catalogs read side by side', () => {
    /*
     * Every key must sit on the same line number in every catalog. Nothing about that is type-checked, and the two ways it breaks —
     * a comment inside one catalog, an import above one — displace every line
     * below silently.
     */

    /** The key each line declares, or null for a line that declares none. */
    function keyLines(text: string): readonly (string | null)[] {
        return text
            .split('\n')
            .map((line: string) => /^\s*([A-Za-z0-9_]+):/.exec(line)?.[1] ?? null);
    }

    it('covers every key sitting on the same line number', () => {
        const source = keyLines(EN_SOURCE);
        const translated = keyLines(VI_SOURCE);

        for (let line = 0; line < Math.max(source.length, translated.length); line++) {
            expect(
                translated[line] ?? null,
                `line ${line + 1}: en has ${source[line] ?? 'no key'}`,
            ).toBe(source[line] ?? null);
        }
    });
});
