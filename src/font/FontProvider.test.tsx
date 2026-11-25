import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FontProvider } from './FontProvider';
import { useFont } from './fontContext';
import type { Account, AccountFont } from './accountFont';
import type { FontPref } from './font';

// The real one talks to the network and the font cache; what matters here is
// only WHEN it settles, since the switch is not allowed to paint before it does.
const loads: { resolve: () => void }[] = [];
vi.mock('./faces', () => ({
    ensureFaces: () =>
        new Promise<void>((resolve) => {
            loads.push({ resolve });
        }),
}));

const KEY = 'beaverplans:font';

function Probe() {
    const { font, setFont } = useFont();
    return (
        <div>
            <span data-testid="font">{font}</span>
            <button type="button" onClick={() => setFont(font === 'modern' ? 'classic' : 'modern')}>
                switch
            </button>
        </div>
    );
}

/** An account the test reports on demand, as LocaleProvider's tests do. */
function fakeAccount() {
    const saved: FontPref[] = [];
    let report: ((account: Account | null) => void) | null = null;

    const link: AccountFont = {
        watch: (onAccount) => {
            report = onAccount;
            return () => {
                report = null;
            };
        },
        save: (value) => {
            saved.push(value);
            return Promise.resolve();
        },
    };

    return { link, saved, says: (a: Account | null) => act(() => report?.(a)) };
}

/** Settles the pending face load, as the browser finishing a fetch would. */
async function facesArrive(): Promise<void> {
    await act(async () => {
        loads.forEach((l) => l.resolve());
        loads.length = 0;
    });
}

beforeEach(() => {
    loads.length = 0;
});

afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-font');
    vi.restoreAllMocks();
});

describe('FontProvider', () => {
    /*
     * Testing strategy
     *
     * The account ordering itself is useAccountPref's, covered by
     * LocaleProvider.test.tsx; what is font-only is tested here.
     *
     * partition on the starting look: nothing cached; a cached look; a cached
     *   value no version of this app ever wrote
     * partition on the switch: faces still loading; faces arrived
     * partition on the account: absent; signed in
     */

    it('covers nothing cached: the default look', () => {
        render(
            <FontProvider>
                <Probe />
            </FontProvider>,
        );

        expect(screen.getByTestId('font')).toHaveTextContent('modern');
        expect(document.documentElement.dataset.font).toBe('modern');
    });

    it('covers a cached look winning over the default', () => {
        localStorage.setItem(KEY, 'classic');

        render(
            <FontProvider>
                <Probe />
            </FontProvider>,
        );

        expect(screen.getByTestId('font')).toHaveTextContent('classic');
        expect(document.documentElement.dataset.font).toBe('classic');
    });

    it('covers a cached value no version of this app ever wrote', () => {
        localStorage.setItem(KEY, 'gothic');

        render(
            <FontProvider>
                <Probe />
            </FontProvider>,
        );

        expect(screen.getByTestId('font')).toHaveTextContent('modern');
    });

    // The whole reason FontProvider exists rather than a bare useAccountPref:
    // fonts.css is font-display: optional, so flipping the tokens onto faces the
    // browser has not fetched would change nothing, and then change everything
    // on the next reload.
    it('covers the tokens not moving until the faces have arrived', async () => {
        render(
            <FontProvider>
                <Probe />
            </FontProvider>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'switch' }));

        expect(loads).toHaveLength(1);
        expect(document.documentElement.dataset.font).toBe('modern');
        expect(screen.getByTestId('font')).toHaveTextContent('modern');

        await facesArrive();

        expect(document.documentElement.dataset.font).toBe('classic');
        expect(screen.getByTestId('font')).toHaveTextContent('classic');
    });

    it('covers the choice being remembered on this device', async () => {
        render(
            <FontProvider>
                <Probe />
            </FontProvider>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'switch' }));
        await facesArrive();

        expect(localStorage.getItem(KEY)).toBe('classic');
    });

    it("covers signing in: the account's look wins over the device's", () => {
        localStorage.setItem(KEY, 'modern');
        const account = fakeAccount();

        render(
            <FontProvider account={account.link}>
                <Probe />
            </FontProvider>,
        );
        account.says({ userId: 'u1', value: 'classic' });

        expect(screen.getByTestId('font')).toHaveTextContent('classic');
        expect(document.documentElement.dataset.font).toBe('classic');
    });

    it('covers a change while signed in reaching the account', async () => {
        const account = fakeAccount();

        render(
            <FontProvider account={account.link}>
                <Probe />
            </FontProvider>,
        );
        account.says({ userId: 'u1', value: 'modern' });

        await userEvent.click(screen.getByRole('button', { name: 'switch' }));
        await facesArrive();

        expect(account.saved).toEqual(['classic']);
    });

    it('covers a consumer outside every provider: the default, no crash', () => {
        render(<Probe />);

        expect(screen.getByTestId('font')).toHaveTextContent('modern');
    });
});
