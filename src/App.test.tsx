import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { overallProgress } from './core/progress';
import { earliestActiveWeek, endedWeeks, isValidWeeks, putWeek } from './core/weeks';
import { sampleWeek } from './fixtures/sampleWeek';
import { sampleArchive } from './fixtures/sampleArchive';
import { STORAGE_KEY } from './storage/localBackend';
import type { Weeks } from './core/types';
import { supabase } from './storage/supabaseClient';

// App now calls useAuth, which talks to the real Supabase client — these
// tests must stay hermetic (no real network, no timing dependent on it).
// onAuthStateChange's mock fires its callback synchronously (unlike the real
// one) specifically so `loading` resolves to false within the same render()
// call, matching every existing test's synchronous assertions below.
//
// signInWithPassword/signUp are vi.fn() (not inline arrows) so individual
// tests can override one call's resolved value with mockResolvedValueOnce —
// in particular, signup's session-established-vs-not distinction, which
// AuthForm/App branch on.
vi.mock('./storage/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null } }),
            onAuthStateChange: (callback: (event: string, session: null) => void) => {
                callback('INITIAL_SESSION', null);
                return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
            signUp: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            resetPasswordForEmail: () => Promise.resolve({ error: null }),
            updateUser: () => Promise.resolve({ error: null }),
            signOut: () => Promise.resolve({ error: null }),
        },
    },
}));

// The real widget loads a script from hCaptcha and renders in an iframe,
// which jsdom cannot do — see ChangePasswordForm.test.tsx for the same stand-in.
vi.mock('@hcaptcha/react-hcaptcha', () => ({
    default: ({ onVerify }: { onVerify: (token: string) => void }) => (
        <button type="button" onClick={() => onVerify('captcha-token')}>
            solve captcha
        </button>
    ),
}));

// The app's state is one collection of weeks, past, present and future alike,
// active and ended together (see the Weeks ADT in core/types.ts). These cover
// the seeding and the derivations App does on it, plus a render smoke check;
// the operations themselves are tested in core/weeks.test.ts.
//
// "Today" is pinned to 2026-07-29 (a Wednesday, week-start 2026-07-27) — one
// week after sampleWeek's own week (2026-07-20). That gap is deliberate: App
// always lands on the literal current week, whatever state it's in, so pinning
// it a week past the fixtures' only active week is what exercises the
// landing-week nudge (queueHead < viewing) instead of landing on that week by
// coincidence.
describe('App under the weeks model', () => {
    const seed: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

    beforeEach(() => {
        // The auth mocks are module-level vi.fn()s shared by every test in the
        // file, so their call records survive across tests unless cleared —
        // which matters for any assertion that a call did NOT happen.
        vi.mocked(supabase.auth.signUp).mockClear();
        vi.mocked(supabase.auth.signInWithPassword).mockClear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-07-29T12:00:00'));
        // App now loads from real storage (useWeeks -> Store -> LocalBackend)
        // instead of seeding from fixtures directly, so the fixtures have to be
        // seeded into the actual backing store for App to ever see them.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ weeks: seed }));
    });

    afterEach(() => {
        vi.useRealTimers();
        window.localStorage.clear();
    });

    // useWeeks' load effect resolves asynchronously (store.load() always
    // returns a real Promise, even though LocalBackend's own read is
    // synchronous under the hood), so a render() immediately followed by a
    // synchronous assertion can race ahead of the loaded data. Waiting for a
    // signal that only appears once the fixtures have actually loaded — the
    // "is still open" WeekRef, present only when queueHead resolves to
    // sampleWeek's real week — settles that race for every test that needs
    // the fixtures to be visible.
    async function renderLoaded() {
        render(<App />);
        await screen.findByRole('button', { name: /^Go to Jul 20/ });
    }

    it('seeding the fixtures through putWeek sorts them and satisfies the rep invariant', () => {
        expect(isValidWeeks(seed)).toBe(true);
        expect(seed.map((week) => week.weekStart)).toEqual([
            '2025-12-15',
            '2025-12-22',
            '2026-06-22',
            '2026-06-29',
            '2026-07-06',
            '2026-07-13',
            '2026-07-20',
        ]);
    });

    it('the archive is exactly the ended weeks — the active week is not in it', () => {
        expect(endedWeeks(seed).map((week) => week.weekStart)).toEqual([
            '2025-12-15',
            '2025-12-22',
            '2026-06-22',
            '2026-06-29',
            '2026-07-06',
            '2026-07-13',
        ]);
        expect(endedWeeks(seed)).not.toContain(sampleWeek);
    });

    // earliestActiveWeek itself is exercised thoroughly in core/weeks.test.ts.
    // This just confirms the fixture keeps producing what the header note
    // below depends on — App no longer uses it to pick the landing week, only
    // to name the week the nudge points at.
    it('earliestActiveWeek finds the earliest open week in the fixtures', () => {
        expect(earliestActiveWeek(seed, '2026-08-31')).toBe('2026-07-20');
        expect(earliestActiveWeek(seed, '2026-07-13')).toBeUndefined();
    });

    it('renders the plan pane', async () => {
        await renderLoaded();
        expect(screen.getByLabelText('Previous week')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'plan' })).toBeTruthy();
    });

    // The landing week is always the current week now (2026-07-27, per the
    // pinned clock), untouched by the fixtures and so empty. End week and Move
    // are dead on an empty week, and the note points at sampleWeek's week,
    // which is still open one week behind it.
    it('lands on the current week; when empty, the note points at the earlier open week', async () => {
        await renderLoaded();
        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            true,
        );
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(true);
        expect(screen.getByText(/is still open/)).toBeTruthy();
    });

    it('stepping back onto the earlier open week makes End week and Move live', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(screen.getByLabelText('Previous week'));

        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            false,
        );
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(false);
    });

    it('an ended week offers no editing controls, but the day picker still works', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(screen.getByLabelText('Previous week')); // onto sampleWeek's week
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await user.click(screen.getByLabelText('Previous week')); // back onto it

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(true);
        // the affordances are still IN the DOM (reading the week is the point);
        // inert is what stops any of them being offered
        expect(projects?.querySelectorAll('button').length).toBeGreaterThan(0);

        // picking which day to look at is navigation, not an edit, and it is
        // not inside that inert region — it must keep working on a frozen week
        await user.click(screen.getAllByTitle('Focus this day')[0]!);
        expect(screen.getByText(/Focusing/)).toBeTruthy();
    });

    // Ended and active weeks may interleave in any order — an ended week's
    // position carries no meaning beyond its own weekStart, so a free week
    // that sits before one that's already ended is not frozen by that alone.
    // This is the direct opposite of what this test used to assert, back when
    // ended weeks were required to precede every active one.
    it('a free week inside the archive is editable, not frozen (weeks interleave)', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        // Landing is 2026-07-27; step back nine times into the fixtures' hole.
        // 2026-05-25 has no entry and sits before the last ended week
        // (2026-07-13).
        for (let i = 0; i < 9; i++) {
            await user.click(screen.getByLabelText('Previous week'));
        }
        expect(screen.getByText('May 25 – May 31')).toBeTruthy();

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(false);
        expect(screen.queryByText(/sits behind your archive/)).toBeNull();
        expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();

        await user.click(screen.getByRole('button', { name: '+ add project' }));
        expect(screen.getByPlaceholderText('Project name…')).toBeTruthy();
    });

    // A week named on another tab is a link to it. Setting the week without also
    // switching tabs would leave the click looking like it did nothing.
    it('opening the best week from Stats switches tab and week together', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole('button', { name: 'stats' }));
        const ref = screen.getByRole('button', { name: /^Go to / });
        const week = ref.textContent;
        await user.click(ref);

        expect(screen.getByRole('button', { name: 'plan' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.getByText(week ?? '')).toBeTruthy();
    });

    it('ending a week with carry-forward archives it whole and moves the view on', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByLabelText('Previous week')); // onto sampleWeek's week
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Carry forward' }));

        // The view followed the carry onto the following week (2026-07-27,
        // which is also the current week), which now holds the work that was
        // left over.
        expect(screen.getByRole('button', { name: /^End week/ }).hasAttribute('disabled')).toBe(
            false,
        );

        // The ended week is archived WHOLE: its row reports the week's real
        // done/total, unfinished work included. A partition-style end, which keeps
        // only the finished half behind, would have recorded it as n/n.
        await user.click(screen.getByRole('button', { name: 'archive' }));
        const { done, total } = overallProgress(sampleWeek.projects);
        expect(done).toBeLessThan(total); // the fixture has to be partial for this to bite
        expect(screen.getByText(`${done}/${total} done`)).toBeTruthy();
    });

    // handleAuthSubmit's job: close the dialog when it's safe to (signin
    // always; signup only once a session actually exists), and otherwise
    // leave AuthForm mounted to show whatever non-committal state it owns
    // (its "check your email" screen for a pending signup, its existing
    // notice for reset). Two "Sign in"-labelled buttons are on screen at
    // once here — the top bar's trigger and the form's own submit button —
    // so queries are scoped to the open dialog via `within`.
    describe('sign-up email confirmation', () => {
        async function openAuthDialog(user: ReturnType<typeof userEvent.setup>) {
            await user.click(screen.getByRole('button', { name: 'Sign in' }));
            return within(screen.getByRole('dialog'));
        }

        it('signup that establishes no session keeps the dialog open on a pending-confirmation message', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Create one' }));
            await user.type(dialog.getByLabelText('Email'), 'new@example.com');
            await user.type(dialog.getByLabelText('Username'), 'duong');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.type(dialog.getByLabelText('Confirm password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Create account' }));

            expect(await dialog.findByText('Check your email')).toBeTruthy();
            expect(dialog.getByText('new@example.com')).toBeTruthy();
            expect(dialog.getByText(/Open the link to finish creating your account/)).toBeTruthy();
            // Following the confirmation link signs the browser in
            // automatically — this screen must not offer or imply a manual
            // sign-in step.
            expect(dialog.queryByRole('button', { name: /sign in/i })).toBeNull();
            expect(dialog.queryByText(/come back and sign in/i)).toBeNull();
            // still escapable — the guest affordance survives into this state
            expect(dialog.getByText('Keep planning as a guest')).toBeTruthy();
            expect(screen.getByRole('dialog')).toBeTruthy();
        });

        it('the pending screen can go back to the form, address intact, to fix a mistyped email', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Create one' }));
            await user.type(dialog.getByLabelText('Email'), 'typo@example.com');
            await user.type(dialog.getByLabelText('Username'), 'duong');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.type(dialog.getByLabelText('Confirm password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Create account' }));
            await dialog.findByText('Check your email');

            await user.click(dialog.getByRole('button', { name: 'Use a different email' }));

            // Back on the signup form with the address still in the field —
            // the whole point is correcting a typo, not retyping from scratch.
            expect(dialog.queryByText('Check your email')).toBeNull();
            expect(dialog.getByRole('button', { name: 'Create account' })).toBeTruthy();
            expect(dialog.getByLabelText('Email')).toHaveValue('typo@example.com');
        });

        it('signup that establishes a session immediately closes the dialog', async () => {
            vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
                data: { session: { user: { id: 'u1' } } },
                error: null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Create one' }));
            await user.type(dialog.getByLabelText('Email'), 'new@example.com');
            await user.type(dialog.getByLabelText('Username'), 'duong');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.type(dialog.getByLabelText('Confirm password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Create account' }));

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('a plain sign-in still closes the dialog on success', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.type(dialog.getByLabelText('Email'), 'you@example.com');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Sign in' }));

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        // Signup is the only mode that asks for a name, and it asks through the
        // same sentence-under-the-button channel as every other field rather
        // than the browser's native validation bubble.
        it('signup refuses to submit without a name, and never reaches the backend', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Create one' }));
            await user.type(dialog.getByLabelText('Email'), 'new@example.com');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.type(dialog.getByLabelText('Confirm password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Create account' }));

            expect(await dialog.findByText('Pick a username.')).toBeTruthy();
            expect(supabase.auth.signUp).not.toHaveBeenCalled();
        });

        // The contract that matters is the one with Supabase: the name has to
        // land in user_metadata, which is where useAuth reads it back from.
        it('the name reaches Supabase as user_metadata, trimmed', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Create one' }));
            await user.type(dialog.getByLabelText('Email'), 'new@example.com');
            await user.type(dialog.getByLabelText('Username'), '  duong  ');
            await user.type(dialog.getByLabelText('Password'), 'password123');
            await user.type(dialog.getByLabelText('Confirm password'), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Create account' }));

            expect(supabase.auth.signUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'new@example.com',
                    options: expect.objectContaining({ data: { username: 'duong' } }),
                }),
            );
        });

        it('password reset keeps its existing notice and stays open, unaffected by the signup change', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(dialog.getByRole('button', { name: 'Forgot password?' }));
            await user.type(dialog.getByLabelText('Email'), 'you@example.com');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Send reset link' }));

            expect(
                await dialog.findByText(
                    'If that email has an account, a reset link is on its way.',
                ),
            ).toBeTruthy();
            expect(screen.getByRole('dialog')).toBeTruthy();
        });
    });

    // AuthForm passes closeOnScrimClick={false} (see Dialog.tsx/AuthForm.tsx)
    // so a stray click outside the card while typing a password doesn't
    // discard the form — unlike an ordinary dialog (ConfirmDialog etc.),
    // which is unaffected and still closes on a scrim click by default.
    it('clicking outside the sign-in/sign-up dialog does not close it', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        const dialog = screen.getByRole('dialog');
        await user.click(dialog.parentElement!); // the scrim, outside the panel

        expect(screen.getByRole('dialog')).toBeTruthy();
    });
});
