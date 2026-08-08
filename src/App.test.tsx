import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { overallProgress } from './core/progress';
import { earliestActiveWeek, endedWeeks, isValidWeeks, putWeek } from './core/weeks';
import { sampleWeek } from './fixtures/sampleWeek';
import { sampleArchive } from './fixtures/sampleArchive';
import { STORAGE_KEY } from './storage/localBackend';
import type { Weeks } from './core/types';
import { supabase } from './storage/supabaseClient';
import { cloudBackend, store } from './storage/instance';
import { APP_CONTAINER_SELECTOR, DESKTOP_MIN_WIDTH } from './hooks/useContainerWidth';

// App now calls useAuth, which talks to the real Supabase client — these
// tests must stay hermetic (no real network, no timing dependent on it).
//
// EVERY method here is a vi.fn(), with no behaviour of its own: the defaults
// are installed in beforeEach instead (see signedOut()). That is deliberate —
// an inline arrow cannot be overridden, and hard-coding a signed-out session
// here is what previously made every signed-in surface in App unreachable from
// its own test file, including the one action that deletes every week the
// account has.
//
// `from`/`rpc`/`channel` are on it because a signed-in App runs on CloudBackend
// (see storage/instance.ts), which reaches all three. They answer as a small
// fake server — see `server` below.
vi.mock('./storage/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            resetPasswordForEmail: vi.fn(),
            updateUser: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn(),
        rpc: vi.fn(),
        channel: vi.fn(),
        removeChannel: vi.fn(),
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

/**
 * The mock above, typed as what it actually is. supabase-js's own types
 * describe a surface far wider than this app touches, and threading them
 * through every override costs more than it checks — what App actually asks
 * the client for is pinned by the tests themselves.
 */
const fake = supabase as unknown as {
    // Named rather than Record<string, Mock>: under noUncheckedIndexedAccess an
    // index signature makes every one of these possibly-undefined at each use.
    auth: {
        getSession: Mock;
        onAuthStateChange: Mock;
        signInWithPassword: Mock;
        signUp: Mock;
        resetPasswordForEmail: Mock;
        updateUser: Mock;
        signOut: Mock;
    };
    from: Mock;
    rpc: Mock;
    channel: Mock;
    removeChannel: Mock;
};

/** A session, shaped as much of one as useAuth reads (see usernameOf). */
function sessionFor(id: string, email: string, username?: string) {
    return { user: { id, email, user_metadata: username === undefined ? {} : { username } } };
}

/** Fires an auth event at the app's listener, the way supabase-js would. */
let emit: (event: string, session: unknown) => void;

/**
 * Points the client at `session`: both the initial read and the listener's
 * first event report it, which is how useAuth seeds (whichever lands first).
 * The listener fires synchronously — unlike the real one — so `loading`
 * resolves within render() and the synchronous assertions below still hold.
 */
function authAs(session: unknown) {
    fake.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session } }));
    fake.auth.onAuthStateChange.mockImplementation((callback: typeof emit) => {
        emit = callback;
        callback('INITIAL_SESSION', session);
        return { data: { subscription: { unsubscribe: () => {} } } };
    });
}

/**
 * The stand-in for the two Supabase tables a signed-in App reaches through
 * CloudBackend: what the server holds, and what it was asked to write. Reads
 * are answered from `weeks`; writes are recorded rather than applied, since
 * every assertion here is about what the app SENT.
 */
const server = {
    weeks: [] as { week_start: string; ended: boolean; projects: unknown }[],
    upserts: [] as unknown[],
    deletes: [] as string[],
};

function installFakeServer() {
    server.weeks = [];
    server.upserts = [];
    server.deletes = [];
    fake.from.mockImplementation((table: string) => {
        if (table === 'planner_weeks') {
            return {
                select: () => Promise.resolve({ data: server.weeks, error: null }),
                upsert: (rows: unknown[]) => {
                    server.upserts.push(...rows);
                    return Promise.resolve({ error: null });
                },
                delete: () => ({
                    in: (_column: string, values: string[]) => {
                        server.deletes.push(...values);
                        return Promise.resolve({ error: null });
                    },
                }),
            };
        }
        // old_planner_state — nobody in these tests has legacy data to import;
        // migrateLegacy.test.ts is where that path is exercised.
        return {
            select: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
            }),
        };
    });
    // The Realtime feed: opened by CloudBackend.load, never fired here.
    const channel = { on: () => channel, subscribe: () => channel };
    fake.channel.mockImplementation(() => channel);
    fake.removeChannel.mockImplementation(() => Promise.resolve('ok'));
}

/** Puts `weeks` on the fake server, as rows. */
function seedServer(weeks: Weeks) {
    server.weeks = weeks.map((week) => ({
        week_start: week.weekStart,
        ended: week.ended,
        projects: week.projects,
    }));
}

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
        // The mocks are module-level vi.fn()s shared by every test in the file,
        // so both their call records and any per-test behaviour survive unless
        // reset — the records matter for any assertion that a call did NOT
        // happen, and the behaviour matters because a signed-in test would
        // otherwise leak its session into the next one.
        for (const method of Object.values(fake.auth)) method.mockReset();
        fake.auth.signInWithPassword.mockResolvedValue({ error: null });
        fake.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
        fake.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
        fake.auth.updateUser.mockResolvedValue({ error: null });
        fake.auth.signOut.mockResolvedValue({ error: null });
        authAs(null); // signed out unless a test says otherwise
        installFakeServer();
        // Its cache, its durable copies and any armed push all outlive one
        // test — it is a module singleton, and App uses the real one.
        cloudBackend.reset();
        store.useBackend('local');
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-07-29T12:00:00'));
        // App now loads from real storage (useWeeks -> Store -> LocalBackend)
        // instead of seeding from fixtures directly, so the fixtures have to be
        // seeded into the actual backing store for App to ever see them.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ weeks: seed }));
    });

    afterEach(() => {
        // Before the timers go back to real: a signed-in test leaves a debounced
        // push armed, and letting it fire into the next test's mocks is the kind
        // of cross-test bleed that shows up as an unrelated failure.
        cloudBackend.reset();
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
            fake.auth.signUp.mockResolvedValueOnce({
                data: { session: sessionFor('u1', 'new@example.com') },
                error: null,
            });
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

    /*
     * The whole-week actions App owns. Every one of these is destructive or
     * moves the view, and each is reachable only through the dialog that owns
     * it — which is why App's function coverage was the lowest in the codebase
     * despite its statements being middling.
     *
     *   partition on the action: end (unfinished | all done) | reopen | clear
     *       board | move work (allowed | blocked destination)
     *   partition on the confirm: confirmed | dismissed
     */

    /** Steps back one week, onto sampleWeek's own week, which is active. */
    async function stepBackToSampleWeek(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByLabelText('Previous week'));
    }

    async function openManageSheet(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByRole('button', { name: 'Manage' }));
    }

    // Clearing wipes a live board with no archive record kept — the one
    // destructive week action that leaves nothing behind — so it must ask, and
    // dismissing must genuinely leave the work alone.
    it('clearing the board is offered behind a confirm, and dismissing keeps the work', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);

        await openManageSheet(user);
        await user.click(screen.getByText('Clear this board'));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText(/Nothing planned yet/)).toBeNull();
    });

    it('confirming the clear empties that week and leaves the archive alone', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        const archivedBefore = endedWeeks(seed).length;

        await openManageSheet(user);
        await user.click(screen.getByText('Clear this board'));
        await user.click(screen.getByRole('button', { name: 'Clear the board' }));

        expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'archive' }));
        expect(screen.getAllByRole('button', { name: /^Open archived week/ })).toHaveLength(
            archivedBefore,
        );
    });

    // Mis-ending a week is an easy slip, and the fix has to exist — otherwise
    // one wrong click permanently freezes a week's worth of work.
    it('an ended week can be reopened, and becomes editable again', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await stepBackToSampleWeek(user); // back onto the week just ended
        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(true);

        await user.click(screen.getByRole('button', { name: 'Reopen…' }));
        await user.click(screen.getByRole('button', { name: 'Reopen week' }));

        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(false);
    });

    it('dismissing the reopen leaves the week frozen', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        await user.click(screen.getByRole('button', { name: /^End week/ }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: 'Reopen…' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(true);
    });

    // Moving relabels a whole week's plan onto another week. The view has to
    // follow it — a move that left you looking at the now-empty week you moved
    // out of reads as if the work was deleted.
    it('moving a week relabels the work and takes the view with it', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        expect(screen.getByText('Jul 20 – Jul 26')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: /work/i }));
        // armed: the arrows now aim a destination rather than change the view.
        // Forward onto the current week, which the fixtures leave empty — Jul 13
        // behind it is an ended week and so occupied (see the blocked case below).
        await user.click(screen.getByLabelText('Later destination'));
        await user.click(screen.getByRole('button', { name: /work onto Jul 27/ }));

        expect(screen.getByText('Jul 27 – Aug 02')).toBeTruthy();
        // and the week it came from is empty now, not a second copy
        await user.click(screen.getByLabelText('Previous week'));
        expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();
    });

    // moveWeek refuses a destination that already holds work, and the header
    // says so in place of the destination note. Without the explanation the
    // Move button just goes dead and the refusal looks like a bug.
    it('a destination that already has work explains itself instead of going quiet', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: /work/i }));
        // Jul 13 is the last ended week in the fixtures, so it is occupied.
        await user.click(screen.getByLabelText('Earlier destination'));

        expect(screen.getByText('This week already has work in it.')).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Cannot move here/ })).toBeDisabled();
    });

    // The all-done end is a different dialog from the unfinished one, with no
    // carry-forward offered — there is nothing left to carry. Needs its own
    // seed: an empty week cannot be ended at all (canEndWeek), so "finished"
    // has to mean every subtask ticked, not an empty board.
    it('ending a finished week offers no carry-forward', async () => {
        const user = userEvent.setup();
        const doneWeek: Weeks = [
            {
                weekStart: '2026-07-20',
                ended: false,
                projects: [
                    {
                        id: 'p1',
                        name: 'English',
                        tasks: [
                            {
                                id: 't1',
                                name: 'Essay',
                                subtasks: [
                                    {
                                        id: 's1',
                                        isDone: true,
                                        assignedDay: 'mon',
                                        missedDays: [],
                                        weight: 1,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ weeks: doneWeek }));
        render(<App />);
        await screen.findByText('Jul 27 – Aug 02');
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: /^End week/ }));

        expect(screen.getByText(/Everything/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Carry forward' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    });

    // The Archive tab edits a SUBSET of the weeks — only the ended ones — and
    // its updater's result is merged back over the active weeks. Getting that
    // merge wrong would drop every unended week the moment anything in the
    // archive was touched.
    it('deleting from the archive leaves the active weeks untouched', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        const archivedBefore = endedWeeks(seed).length;

        await user.click(screen.getByRole('button', { name: 'archive' }));
        const rows = screen.getAllByRole('button', { name: /^Open archived week/ });
        expect(rows).toHaveLength(archivedBefore);
        await user.click(screen.getAllByRole('button', { name: /^Delete week/ })[0]!);
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(screen.getAllByRole('button', { name: /^Open archived week/ })).toHaveLength(
            archivedBefore - 1,
        );

        // the active week survived the archive edit
        await user.click(screen.getByRole('button', { name: 'plan' }));
        await stepBackToSampleWeek(user);
        expect(screen.queryByText(/Nothing planned yet/)).toBeNull();
    });

    /*
     * The signed-in half of the app: everything App only mounts once
     * auth.user is non-null, plus the recovery gate that replaces it entirely.
     * None of it was reachable while the client mock hard-coded a signed-out
     * session — including handleConfirmClearAll, which deletes every week the
     * account has, on every device, with no undo.
     *
     * The board itself is the same board, so these do not re-test it. What is
     * asserted here is what only exists when there is an account: the panels,
     * the handoffs between them, and what the destructive ones actually do.
     *
     *   partition on the surface: data & privacy | account settings |
     *       guest merge | recovery gate
     *   partition on the destructive action: dismissed | confirmed
     *   partition on the merge prompt's form factor: phone (sheet) | desktop
     *       (dialog)
     */
    describe('signed in', () => {
        const account = sessionFor('u1', 'you@example.com', 'duong');

        beforeEach(() => {
            // No guest data on this device: leftover local weeks would raise
            // the merge prompt over everything. The two tests that want it
            // seed it back deliberately.
            window.localStorage.removeItem(STORAGE_KEY);
            seedServer(seed);
            authAs(account);
        });

        /** Renders and waits for the account chip, which only the signed-in,
         *  fully-loaded app has (App renders null until both settle). */
        async function renderSignedIn() {
            const user = userEvent.setup();
            render(<App />);
            await screen.findByRole('button', { name: /^Account: duong/ });
            return user;
        }

        async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
            await user.click(screen.getByRole('button', { name: /^Account: duong/ }));
        }

        async function openDataPanel(user: ReturnType<typeof userEvent.setup>) {
            await openAccountMenu(user);
            await user.click(screen.getByRole('menuitem', { name: /Data & privacy/ }));
        }

        // The panel is the app's answer to "what are you holding on me" — so
        // naming the wrong account, or offering to act on a count that is not
        // the real one, is the whole failure. The count is also what the
        // erasure confirm below quotes back.
        it('Data & privacy names the account and the number of weeks it would act on', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            expect(screen.getByText(/\(you@example\.com\)/)).toBeTruthy();
            expect(screen.getByText(`${seed.length} weeks stored`)).toBeTruthy();
        });

        // Every other destructive action in this app leaves something behind —
        // ending a week archives it, clearing a board leaves the archive. This
        // one leaves nothing, so a dismissal has to be a genuine no-op rather
        // than a delete that already happened behind the dialog.
        it('deleting everything asks first, and dismissing keeps every week', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            await user.click(screen.getByRole('button', { name: /Delete all my data/ }));
            // handed off, not stacked: the panel closes on the way
            expect(screen.getByText('Delete every week?')).toBeTruthy();
            expect(screen.queryByText(/Nothing stored yet/)).toBeNull();

            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByText('Delete every week?')).toBeNull();
            expect(store.getWeeks()).toHaveLength(seed.length);
            await user.click(screen.getByRole('button', { name: 'archive' }));
            expect(screen.getAllByRole('button', { name: /^Open archived week/ })).toHaveLength(
                endedWeeks(seed).length,
            );
        });

        // The single most destructive action in the app, and the one that has
        // to reach past this device: weeks left on the server would come back
        // on the next load, which reads as the deletion silently failing.
        it('confirming the delete empties the app and asks the server to drop every week', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            await user.click(screen.getByRole('button', { name: /Delete all my data/ }));
            // The confirm quotes the count it is about to destroy — consent for
            // "all 7 of your weeks" is not consent for some other number.
            expect(screen.getByText(new RegExp(`all ${seed.length} of your weeks`))).toBeTruthy();
            await user.click(screen.getByRole('button', { name: 'Delete everything' }));

            expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();
            await user.click(screen.getByRole('button', { name: 'archive' }));
            expect(screen.queryAllByRole('button', { name: /^Open archived week/ })).toHaveLength(
                0,
            );

            // The push is debounced (CloudBackend.DEBOUNCE_MS), so this waits
            // on the real timer rather than assuming the write is immediate.
            await waitFor(
                () =>
                    expect([...server.deletes].sort()).toEqual(
                        seed.map((week) => week.weekStart).sort(),
                    ),
                { timeout: 3000 },
            );
        });

        // The panel offers two ways to take a copy before it offers erasure,
        // so the copy has to be the real thing: everything, in the format the
        // app claims, named for the day it was taken.
        it('Download as JSON hands the browser every week, named for today', async () => {
            const blobs: Blob[] = [];
            const names: string[] = [];
            // jsdom has neither: downloadText is the one place the app leaves
            // the DOM it can assert on.
            URL.createObjectURL = vi.fn((blob: Blob) => {
                blobs.push(blob);
                return 'blob:test';
            });
            URL.revokeObjectURL = vi.fn();
            const click = vi
                .spyOn(HTMLAnchorElement.prototype, 'click')
                .mockImplementation(function (this: HTMLAnchorElement) {
                    names.push(this.download);
                });

            try {
                const user = await renderSignedIn();
                await openDataPanel(user);
                await user.click(screen.getByRole('button', { name: /Download as JSON/ }));

                expect(names).toEqual(['beaverplans-2026-07-29.json']);
                const written = JSON.parse(await blobs[0]!.text()) as { weeks: Weeks };
                expect(written.weeks.map((week) => week.weekStart)).toEqual(
                    seed.map((week) => week.weekStart),
                );
            } finally {
                click.mockRestore();
            }
        });

        // Both flows are owned by App rather than nested inside the panel that
        // offers them, so the handoff is the thing that can break: a panel left
        // mounted behind the screen it opened is one you dismiss twice.
        it('Account settings hands off to Change password, closing itself on the way', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);
            await user.click(screen.getByRole('menuitem', { name: /Account settings/ }));
            expect(screen.getByText('duong')).toBeTruthy();

            await user.click(screen.getByRole('button', { name: /Password/ }));

            expect(screen.getByText('Change password')).toBeTruthy();
            expect(screen.queryByText('Account settings')).toBeNull();
        });

        it('Account settings hands off to Change email, which says it is not finished', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);
            await user.click(screen.getByRole('menuitem', { name: /Account settings/ }));

            await user.click(screen.getByRole('button', { name: 'Change email' }));

            expect(screen.getByText('Change email')).toBeTruthy();
            expect(screen.getByText(/Currently you@example\.com/)).toBeTruthy();
            // it admits it rather than pretending — see ChangeEmailForm
            expect(screen.getByRole('button', { name: 'Not available yet' })).toBeDisabled();
            expect(screen.queryByText('Account settings')).toBeNull();
        });

        // Signing out has to take the account's data off the screen with it,
        // not just the chip: the next person at this browser is a guest.
        it('signing out drops back to the guest board', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);

            await user.click(screen.getByRole('menuitem', { name: /Sign out/ }));
            // supabase-js reports the sign-out as an event; the mock does not
            // fire one on its own.
            emit('SIGNED_OUT', null);

            expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: /^Account: duong/ })).toBeNull();
            expect(screen.getByText(/Nothing planned yet/)).toBeTruthy();
        });

        /*
         * The recovery gate. Following a reset-password link signs the browser
         * in with a live session, so without this the app would drop someone
         * straight into their account having never set a new password — with
         * the old one still valid.
         */
        it('a recovery link replaces the app with the new-password screen, board and all', async () => {
            await renderSignedIn();

            emit('PASSWORD_RECOVERY', account);

            expect(await screen.findByText('Choose a new password')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'plan' })).toBeNull();
            expect(screen.queryByRole('button', { name: /^Account: duong/ })).toBeNull();
        });

        it('setting the new password releases the gate into the app', async () => {
            const user = await renderSignedIn();
            emit('PASSWORD_RECOVERY', account);
            await screen.findByText('Choose a new password');

            await user.type(screen.getByLabelText('New password'), 'newpassword');
            await user.type(screen.getByLabelText('Confirm password'), 'newpassword');
            await user.click(screen.getByRole('button', { name: 'Set new password' }));

            expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword' });
            expect(await screen.findByRole('button', { name: 'plan' })).toBeTruthy();
        });

        // The opposite failure to the one above: cancelling must sign out, and
        // must NOT drop the gate if that sign-out did not happen — the recovery
        // session would still be live, which is the whole thing the screen is
        // there to prevent.
        it('cancelling the recovery signs out; a failed sign-out keeps the gate up', async () => {
            fake.auth.signOut.mockResolvedValueOnce({ error: { message: 'Offline' } });
            const user = await renderSignedIn();
            emit('PASSWORD_RECOVERY', account);
            await screen.findByText('Choose a new password');

            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
            expect(await screen.findByText('Offline')).toBeTruthy();
            expect(screen.getByText('Choose a new password')).toBeTruthy();

            await user.click(screen.getByRole('button', { name: 'Cancel' }));
            await waitFor(() => expect(screen.queryByText('Choose a new password')).toBeNull());
        });

        /*
         * The guest-work prompt. Raised when this browser holds guest weeks and
         * the account already has weeks of its own — the one case where neither
         * silently adopting nor silently dropping them is defensible.
         */
        const guestWeeks: Weeks = [
            {
                weekStart: '2026-07-27', // the landing week, empty in the fixtures
                ended: false,
                projects: [{ id: 'g1', name: 'Planned as a guest', tasks: [] }],
            },
        ];

        function seedGuestWork() {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ weeks: guestWeeks }));
        }

        it('guest work plus an account that already has weeks raises the prompt, and merging keeps both', async () => {
            seedGuestWork();
            const user = await renderSignedIn();

            expect(await screen.findByText('Unsaved guest work found')).toBeTruthy();
            // jsdom measures every box at zero, so this is the phone's form of
            // the question — rows you tap, not buttons in a foot (see the
            // desktop test below for the other half of that pair)
            expect(screen.getByText(/Added below what you already have/)).toBeTruthy();
            await user.click(screen.getByRole('button', { name: /Merge into my plan/ }));

            // it lands on the week it was planned for, which is the one on
            // screen — and the account's own weeks are still there beside it
            expect(await screen.findByDisplayValue('Planned as a guest')).toBeTruthy();
            expect(store.getWeeks()).toHaveLength(seed.length + 1);
            // and the guest copy is gone, so the next sign-in does not ask again
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"weeks":[]');
        });

        it('discarding the guest work drops it and leaves the account untouched', async () => {
            seedGuestWork();
            const user = await renderSignedIn();
            await screen.findByText('Unsaved guest work found');

            await user.click(screen.getByRole('button', { name: /Discard guest work/ }));

            expect(screen.queryByText('Unsaved guest work found')).toBeNull();
            expect(screen.queryByDisplayValue('Planned as a guest')).toBeNull();
            expect(store.getWeeks()).toHaveLength(seed.length);
        });

        // The one prompt in the app whose two form factors are different
        // COMPONENTS rather than the same one restyled (see App's isDesktop),
        // so a width that picks the wrong one is a real failure and not a
        // cosmetic one: the sheet's choices are rows you tap, the dialog's are
        // buttons in a foot.
        it('at desktop width the same question is asked as a dialog, not a sheet', async () => {
            seedGuestWork();
            const container = document.createElement('div');
            container.setAttribute('data-app-container', '');
            container.getBoundingClientRect = () =>
                ({ width: DESKTOP_MIN_WIDTH }) as unknown as DOMRect;
            document.body.appendChild(container);
            expect(document.querySelector(APP_CONTAINER_SELECTOR)).toBe(container);

            const user = userEvent.setup();
            render(<App />, { container });
            await screen.findByText('Unsaved guest work found');

            expect(screen.getByText(/Merging adds it below what you already have/)).toBeTruthy();
            expect(screen.queryByText(/Deletes what you planned as a guest/)).toBeNull();

            // Decide later is not a cancel: it keeps the guest work for next time
            await user.click(screen.getByRole('button', { name: 'Decide later' }));
            expect(screen.queryByText('Unsaved guest work found')).toBeNull();
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Planned as a guest');
        });
    });
});
