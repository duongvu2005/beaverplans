import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { useLocale } from '@/i18n/localeContext';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
    /*
     * Testing strategy
     *     partition on children: render cleanly | throw while rendering
     *     partition on what follows a catch: nothing | the boundary is remounted
     *         under a new key (how the app clears a broken view)
     *     partition on the fallback: is handed the error
     *
     * NOT covered: errors thrown from event handlers or async work — React
     * boundaries do not catch those at all.
     *
     * React logs every caught error to console.error, silenced here so a passing
     * run stays readable.
     */
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    function Boom({ explode }: { explode: boolean }) {
        if (explode) throw new Error('kaboom');
        return <p>all fine</p>;
    }

    it('covers children rendering cleanly: renders them, no fallback', () => {
        render(
            <ErrorBoundary fallback={() => <p>fallback</p>}>
                <Boom explode={false} />
            </ErrorBoundary>,
        );

        expect(screen.getByText('all fine')).toBeInTheDocument();
        expect(screen.queryByText('fallback')).toBeNull();
    });

    it('covers a child throwing: renders the fallback instead', () => {
        render(
            <ErrorBoundary fallback={() => <p>fallback</p>}>
                <Boom explode={true} />
            </ErrorBoundary>,
        );

        expect(screen.getByText('fallback')).toBeInTheDocument();
        expect(screen.queryByText('all fine')).toBeNull();
    });

    it('covers the fallback being handed the error', () => {
        render(
            <ErrorBoundary fallback={(error) => <p>caught: {error.message}</p>}>
                <Boom explode={true} />
            </ErrorBoundary>,
        );

        expect(screen.getByText('caught: kaboom')).toBeInTheDocument();
    });

    it('logs the error, so a crash leaves a trace in the console', () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary fallback={() => <p>fallback</p>}>
                <Boom explode={true} />
            </ErrorBoundary>,
        );

        expect(
            logged.mock.calls.some((args) =>
                args.some((arg) => arg instanceof Error && arg.message === 'kaboom'),
            ),
        ).toBe(true);
    });

    // A caught error is sticky: the app clears one by giving the boundary a new
    // key, which is what switching views does.
    it('covers remounting under a new key: the fallback clears', async () => {
        function Harness() {
            const [view, setView] = useState('broken');
            return (
                <>
                    <button type="button" onClick={() => setView('working')}>
                        switch view
                    </button>
                    <ErrorBoundary key={view} fallback={() => <p>fallback</p>}>
                        <Boom explode={view === 'broken'} />
                    </ErrorBoundary>
                </>
            );
        }
        const user = userEvent.setup();
        render(<Harness />);
        expect(screen.getByText('fallback')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'switch view' }));

        expect(screen.getByText('all fine')).toBeInTheDocument();
        expect(screen.queryByText('fallback')).toBeNull();
    });

    /*
     * The nesting main.tsx uses. A fallback is rendered by the boundary, so it
     * sees only the providers ABOVE it: put LocaleProvider inside and the crash
     * screen silently falls back to English.
     */
    describe('a locale provider around it', () => {
        function Probe() {
            return <p>locale: {useLocale().locale}</p>;
        }

        it('covers the provider outside: the fallback speaks the chosen language', () => {
            localStorage.setItem('beaverplans:locale', 'vi');

            render(
                <LocaleProvider>
                    <ErrorBoundary fallback={() => <Probe />}>
                        <Boom explode={true} />
                    </ErrorBoundary>
                </LocaleProvider>,
            );

            expect(screen.getByText('locale: vi')).toBeInTheDocument();
        });

        it('covers the provider inside: the fallback silently falls back to English', () => {
            localStorage.setItem('beaverplans:locale', 'vi');

            render(
                <ErrorBoundary fallback={() => <Probe />}>
                    <LocaleProvider>
                        <Boom explode={true} />
                    </LocaleProvider>
                </ErrorBoundary>,
            );

            expect(screen.getByText('locale: en')).toBeInTheDocument();
        });
    });
});
