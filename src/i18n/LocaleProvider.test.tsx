import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from './LocaleProvider';
import { useCopy, useLocale } from './localeContext';
import type { Account, AccountLocale } from './accountLocale';
import type { Locale } from './locale';
import { en } from './en';
import { vi } from './vi';

const KEY = 'beaverplans:locale';
const UNPUSHED_KEY = 'beaverplans:locale:unpushed';

function Probe() {
    const { locale, setLocale } = useLocale();
    const t = useCopy();
    return (
        <div>
            <span data-testid="locale">{locale}</span>
            <span data-testid="label">{t.languagePicker.label}</span>
            <button type="button" onClick={() => setLocale(locale === 'en' ? 'vi' : 'en')}>
                switch
            </button>
        </div>
    );
}

function withLanguages(languages: readonly string[]) {
    vitest.spyOn(window.navigator, 'languages', 'get').mockReturnValue([...languages]);
}

/**
 * An account the test reports on demand, so the network round trip a real one
 * hides behind is something a test can hold open, refuse, or never answer.
 */
function fakeAccount() {
    const saved: Locale[] = [];
    let report: ((account: Account | null) => void) | null = null;
    let refusing = false;

    const link: AccountLocale = {
        watch: (onAccount) => {
            report = onAccount;
            return () => {
                report = null;
            };
        },
        save: (locale) => {
            if (refusing) return Promise.reject(new Error('offline'));
            saved.push(locale);
            return Promise.resolve();
        },
    };

    return {
        link,
        saved,
        says: (account: Account | null) => act(() => report?.(account)),
        refuse: (yes: boolean) => {
            refusing = yes;
        },
    };
}

function markUnpushed(userId: string, locale: Locale) {
    localStorage.setItem(UNPUSHED_KEY, JSON.stringify({ userId, value: locale }));
}

afterEach(() => {
    localStorage.clear();
    vitest.restoreAllMocks();
    document.documentElement.removeAttribute('lang');
});

// Covers localeContext.ts too: useLocale and useCopy are only reachable through
// a provider, so testing them anywhere else would test the default value twice.
describe('LocaleProvider', () => {
    /*
     * Testing strategy
     *
     * partition on what the starting locale comes from:
     *   a stored preference; the browser's languages, with nothing stored;
     *   neither (unsupported languages, nothing stored)
     * partition on the stored value:
     *   a supported tag; a value no version of this app ever wrote
     * partition on localStorage:
     *   working; throwing on read; throwing on write
     * partition on the consumer:
     *   inside a provider; outside every provider
     * partition on the action:
     *   initial render only; a locale change
     * partition on the account:
     *   no account at all; signed out; signed in with a language stored; signed
     *   in with none stored; signed in, then the account changes under us
     * partition on the unpushed mark:
     *   none; owed by this account, disagreeing with it; owed by this account,
     *   agreeing with it; owed by another account
     * partition on the write:
     *   accepted; refused
     */

    it('covers a stored preference winning over the browser', () => {
        localStorage.setItem(KEY, 'vi');
        withLanguages(['en-US']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        expect(screen.getByTestId('label')).toHaveTextContent(vi.languagePicker.label);
    });

    it('covers nothing stored: the browser decides', () => {
        withLanguages(['vi-VN', 'en-US']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
    });

    it('covers neither a stored value nor a supported browser language', () => {
        withLanguages(['fr-FR']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('en');
    });

    it('covers a stored value no version of this app ever wrote', () => {
        localStorage.setItem(KEY, 'klingon');
        withLanguages(['vi']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
    });

    it('covers a locale change: copy swaps and the choice is stored', async () => {
        const user = userEvent.setup();
        withLanguages(['en-US']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );
        expect(screen.getByTestId('label')).toHaveTextContent(en.languagePicker.label);

        await user.click(screen.getByRole('button', { name: 'switch' }));

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        expect(screen.getByTestId('label')).toHaveTextContent(vi.languagePicker.label);
        expect(localStorage.getItem(KEY)).toBe('vi');
    });

    it('covers the html lang attribute tracking the locale', async () => {
        const user = userEvent.setup();
        withLanguages(['en-US']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );
        expect(document.documentElement.lang).toBe('en');

        await user.click(screen.getByRole('button', { name: 'switch' }));

        expect(document.documentElement.lang).toBe('vi');
    });

    it('covers localStorage throwing on read', () => {
        vitest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('private mode');
        });
        withLanguages(['vi']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
    });

    it('covers localStorage throwing on write: the choice still applies', async () => {
        const user = userEvent.setup();
        vitest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('private mode');
        });
        withLanguages(['en-US']);

        render(
            <LocaleProvider>
                <Probe />
            </LocaleProvider>,
        );
        await user.click(screen.getByRole('button', { name: 'switch' }));

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
    });

    it('covers a consumer outside every provider: English, no crash', () => {
        withLanguages(['vi-VN']);

        render(<Probe />);

        expect(screen.getByTestId('locale')).toHaveTextContent('en');
        expect(screen.getByTestId('label')).toHaveTextContent(en.languagePicker.label);
    });

    it("covers signing in: the account's language wins over the device's", async () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'en');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        expect(screen.getByTestId('locale')).toHaveTextContent('en');

        account.says({ userId: 'u1', value: 'vi' });

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        // Cached as a mirror of the account, not pushed back to it.
        await waitFor(() => expect(localStorage.getItem(KEY)).toBe('vi'));
        expect(account.saved).toEqual([]);
    });

    it('covers a guest: the device decides and nothing is written to an account', () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'vi');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says(null);

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        expect(account.saved).toEqual([]);
    });

    it('covers an account with no language stored: it is seeded from the screen', async () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'vi');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: null });

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        await waitFor(() => expect(account.saved).toEqual(['vi']));
        expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
    });

    it('covers a change while signed in: it reaches the account', async () => {
        const user = userEvent.setup();
        const account = fakeAccount();
        localStorage.setItem(KEY, 'en');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: 'en' });
        await user.click(screen.getByRole('button', { name: 'switch' }));

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        await waitFor(() => expect(account.saved).toEqual(['vi']));
        expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
    });

    it('covers a change the account refused: it is marked, kept, and pushed again', async () => {
        const user = userEvent.setup();
        const account = fakeAccount();
        localStorage.setItem(KEY, 'en');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: 'en' });

        account.refuse(true);
        await user.click(screen.getByRole('button', { name: 'switch' }));

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        await waitFor(() =>
            expect(localStorage.getItem(UNPUSHED_KEY)).toBe(
                JSON.stringify({ userId: 'u1', value: 'vi' }),
            ),
        );

        // The account still says English. The change it never heard is newer, so
        // it wins and goes up again.
        account.refuse(false);
        account.says({ userId: 'u1', value: 'en' });

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        await waitFor(() => expect(account.saved).toEqual(['vi']));
        expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
    });

    it('covers a mark the account has caught up with: it is dropped, not pushed again', async () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'vi');
        markUnpushed('u1', 'vi');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: 'vi' });

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        await waitFor(() => expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull());
        expect(account.saved).toEqual([]);
    });

    it('covers a mark owed by another account: it is dropped', async () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'vi');
        markUnpushed('someone-else', 'vi');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: 'en' });

        expect(screen.getByTestId('locale')).toHaveTextContent('en');
        await waitFor(() => expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull());
        expect(account.saved).toEqual([]);
    });

    it('covers the account changing under us: the new value is adopted', () => {
        const account = fakeAccount();
        localStorage.setItem(KEY, 'en');
        withLanguages(['en-US']);

        render(
            <LocaleProvider account={account.link}>
                <Probe />
            </LocaleProvider>,
        );
        account.says({ userId: 'u1', value: 'en' });
        // What a token refresh carrying another device's change looks like.
        account.says({ userId: 'u1', value: 'vi' });

        expect(screen.getByTestId('locale')).toHaveTextContent('vi');
        expect(account.saved).toEqual([]);
    });
});
