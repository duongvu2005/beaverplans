import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n/LocaleProvider';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { CrashScreen } from './CrashScreen';
import styles from './CrashScreen.module.css';

vi.mock('@/utils/downloadText', () => ({ downloadText: vi.fn() }));
import { downloadText } from '@/utils/downloadText';

describe('CrashScreen', () => {
    /*
     * Testing strategy
     *     partition on scope: 'app' (everything is gone, the only way on is a
     *         reload) | 'view' (the frame survives, so it says to switch tabs)
     *     partition on what is stored: something | nothing -- with nothing
     *         stored there is no copy to offer and the button must not pretend
     *     interaction: download -> downloadText with the stored bytes UNCHANGED
     *     partition on how many buttons the foot gets: none | some
     */
    const realStorage = globalThis.localStorage;

    afterEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: realStorage,
        });
        vi.clearAllMocks();
    });

    function stubStored(text: string | null) {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: { getItem: () => text },
        });
    }

    it("covers scope 'app': offers a reload", () => {
        stubStored('{"weeks":[]}');
        render(<CrashScreen scope="app" />);

        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    });

    it("covers scope 'view': points at the tab itself, no reload button", () => {
        stubStored('{"weeks":[]}');
        render(<CrashScreen scope="view" />);

        expect(screen.queryByRole('button', { name: /reload/i })).toBeNull();
        expect(screen.getByText(/reloading the tab/i)).toBeInTheDocument();
    });

    it('covers something stored: hands over the bytes untouched', async () => {
        const stored = '{"weeks":[{"weekStart":"2026-08-03"}]}';
        stubStored(stored);
        const user = userEvent.setup();
        render(<CrashScreen scope="app" />);

        await user.click(screen.getByRole('button', { name: /download/i }));

        expect(downloadText).toHaveBeenCalledWith(
            expect.stringMatching(/^beaverplans-recovery-\d{4}-\d{2}-\d{2}\.json$/),
            stored,
            'application/json',
        );
    });

    it('covers nothing stored: no download offered', () => {
        stubStored(null);
        render(<CrashScreen scope="app" />);

        expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    });

    function footClass(): string {
        const value = styles.foot;
        if (value === undefined) throw new Error('CrashScreen.module.css has no .foot');
        return value;
    }

    /*
     * The foot is a bordered strip. 'view' with nothing stored is the one case
     * that fills neither slot, and an empty foot is a rule with nothing under it.
     */
    it('covers a foot with no buttons: not drawn', () => {
        stubStored(null);
        const { container } = render(<CrashScreen scope="view" />);

        expect(container.querySelector(`.${footClass()}`)).toBeNull();
    });

    it('covers a foot with buttons: drawn', () => {
        stubStored(null);
        const { container } = render(<CrashScreen scope="app" />);

        expect(container.querySelector(`.${footClass()}`)).not.toBeNull();
    });

    /*
     * Not through `renderIn`: this suite replaces localStorage with a getItem-only
     * stub, and the helper writes. The stub answers both keys instead.
     */
    it('covers vi: the whole screen, in the language the reader chose', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: {
                getItem: (key: string) => (key === 'beaverplans:locale' ? 'vi' : '{"weeks":[]}'),
                setItem: () => {},
            },
        });

        render(
            <LocaleProvider>
                <CrashScreen scope="app" />
            </LocaleProvider>,
        );

        expect(screen.getByText(viCatalog.crashScreen.appTitle)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.crashScreen.appBody)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.crashScreen.reload }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.crashScreen.download }),
        ).toBeInTheDocument();
    });
});
