import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { overallProgress } from '@/core/progress';
import { earliestActiveWeek, endedWeeks, isValidWeeks, putWeek, weekAt } from '@/core/weeks';
import { sampleWeek } from '@/fixtures/sampleWeek';
import { monthAndDay, weekRangeLabel } from '@/i18n/dateCopy';
import { sampleArchive } from '@/fixtures/sampleArchive';
import { STORAGE_KEY } from '@/storage/localBackend';
import type { Weeks } from '@/core/types';
import { supabase } from '@/storage/supabaseClient';
import { cloudBackend, store } from '@/storage/instance';
import { APP_CONTAINER_SELECTOR, DESKTOP_MIN_WIDTH } from '@/hooks/useContainerWidth';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';

// App calls useAuth, which talks to the real Supabase client; these tests stay
// hermetic.
//
// EVERY method must stay a bare vi.fn() with no behaviour of its own — an
// inline arrow cannot be overridden, so a session hard-coded here would put
// every signed-in surface in App out of reach. The defaults go in beforeEach.
//
// `from`/`rpc`/`channel` are here because a signed-in App runs on CloudBackend
// (see storage/instance.ts), which reaches all three; `server` below answers
// them.
vi.mock('@/storage/supabaseClient', () => ({
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

/** The mock above, typed as what it actually is. */
const fake = supabase as unknown as {
    // Spelled out rather than an index signature: under noUncheckedIndexedAccess
    // that would make every method possibly-undefined at each use.
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

/** Fires an auth event at every listener, the way supabase-js would. */
let emit: (event: string, session: unknown) => void;

/**
 * Points the client at `session`: both the initial read and the listener's
 * first event report it, which is how useAuth seeds (whichever lands first).
 * The listener fires synchronously — unlike the real one — so `loading`
 * resolves within render() and the synchronous assertions below still hold.
 *
 * Every listener is kept, not just the last: useAuth and useGuidePref both
 * subscribe to this one client, and holding only one would let the second
 * silently take the first's events.
 */
function authAs(session: unknown) {
    const listeners: ((event: string, session: unknown) => void)[] = [];
    emit = (event, next) => listeners.slice().forEach((listener) => listener(event, next));

    fake.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session } }));
    fake.auth.onAuthStateChange.mockImplementation((callback: typeof emit) => {
        listeners.push(callback);
        callback('INITIAL_SESSION', session);
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        const at = listeners.indexOf(callback);
                        if (at !== -1) listeners.splice(at, 1);
                    },
                },
            },
        };
    });
}

/**
 * The Supabase table a signed-in App reaches through CloudBackend. Reads
 * are answered from `weeks`; writes are recorded rather than applied, so an
 * assertion can only be about what the app SENT.
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
                // .retry() is what the reads actually await — CloudBackend
                // turns postgrest-js's retry ladder off when offline.
                select: () => ({
                    retry: () => Promise.resolve({ data: server.weeks, error: null }),
                }),
                // .abortSignal() is what the writes actually await — it is how
                // CloudBackend bounds a request that would otherwise never settle.
                upsert: (rows: unknown[]) => ({
                    abortSignal: () => {
                        server.upserts.push(...rows);
                        return Promise.resolve({ error: null });
                    },
                }),
                delete: () => ({
                    in: (_column: string, values: string[]) => ({
                        abortSignal: () => {
                            server.deletes.push(...values);
                            return Promise.resolve({ error: null });
                        },
                    }),
                }),
            };
        }
        throw new Error(`unexpected table: ${table}`);
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

// The seeding and the derivations App does over Weeks, plus a render smoke
// check; the operations themselves are tested in core/weeks.test.ts.
//
// "Today" is pinned to 2026-07-29 (a Wednesday, week-start 2026-07-27), one
// week after sampleWeek's own week (2026-07-20). The gap is load-bearing: App
// lands on the literal current week, so a week's distance from the fixtures'
// only active week is what puts the landing-week nudge (queueHead < viewing)
// on screen. Move the clock and most of the expectations below change.
describe('App under the weeks model', () => {
    const seed: Weeks = [sampleWeek, ...sampleArchive].reduce<Weeks>(putWeek, []);

    beforeEach(() => {
        // Module-level vi.fn()s shared by the whole file: without a reset, call
        // records break every "was not called" assertion and a signed-in test
        // leaks its session into the next one.
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
        // App reads through useWeeks -> Store -> LocalBackend, never the
        // fixtures directly, so they have to go into the real backing store.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ weeks: seed }));
    });

    afterEach(() => {
        // Before the timers go back to real: a signed-in test leaves a debounced
        // push armed, and it must not fire into the next test's mocks.
        cloudBackend.reset();
        vi.useRealTimers();
        window.localStorage.clear();
    });

    // store.load() returns a real Promise even though LocalBackend reads
    // synchronously, so a render() followed by a synchronous assertion races
    // the fixtures. The awaited WeekRef appears only once queueHead resolves to
    // sampleWeek's week, which is the signal that they have landed.
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

    // earliestActiveWeek itself is exercised in core/weeks.test.ts; this pins
    // what the header note below depends on the fixtures producing.
    it('earliestActiveWeek finds the earliest open week in the fixtures', () => {
        expect(earliestActiveWeek(seed, '2026-08-31')).toBe('2026-07-20');
        expect(earliestActiveWeek(seed, '2026-07-13')).toBeUndefined();
    });

    it('renders the plan pane', async () => {
        await renderLoaded();
        expect(screen.getByLabelText(en.weekHeader.prevWeek)).toBeTruthy();
        expect(screen.getByRole('button', { name: en.topBar.views.plan })).toBeTruthy();
    });

    it('lands on the current week; when empty, the note points at the earlier open week', async () => {
        await renderLoaded();
        expect(
            screen.getByRole('button', { name: en.weekHeader.endWeek }).hasAttribute('disabled'),
        ).toBe(true);
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(true);
        // The WeekRef's parent is the note, and the note is lead + ref + rest.
        expect(
            screen.getByRole('button', { name: /^Go to Jul 20/ }).parentElement,
        ).toHaveTextContent(`${en.app.queueOpenLead}Jul 20 – Jul 26${en.app.queueOpenRest}`);
        // A week stuck behind an older one has a problem to report, which
        // outranks saying where in the week you are.
        expect(screen.queryByText(/days left/)).toBeNull();
    });

    it('stepping back onto the earlier open week makes End week and Move live', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek));

        expect(
            screen.getByRole('button', { name: en.weekHeader.endWeek }).hasAttribute('disabled'),
        ).toBe(false);
        const move = screen.getByRole('button', { name: /work/i });
        expect(move.hasAttribute('disabled')).toBe(false);
        // Only the week being lived has a day phase to report.
        expect(screen.queryByText(/days left/)).toBeNull();
    });

    // The day-phase note is last in the chain, so the older open week in front
    // of it has to be ended before it can show. That lands back on the current
    // week.
    it('with nothing wrong, the note says how much of the current week is left', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek));
        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));

        expect(screen.getByText('Jul 27 – Aug 02')).toBeTruthy();
        // Wed Jul 29, per the pinned clock: Wed, Thu, Fri, Sat, Sun. Matched
        // loosely — the count is what this is about, not the words around it.
        expect(screen.getByText(/5 days left/)).toBeTruthy();
    });

    it('an ended week offers no editing controls, but the day picker still works', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek)); // onto sampleWeek's week
        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek)); // back onto it

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(true);
        // the affordances are still IN the DOM (reading the week is the point);
        // inert is what stops any of them being offered
        expect(projects?.querySelectorAll('button').length).toBeGreaterThan(0);

        // the day picker is navigation, not an edit, and sits outside the inert
        // region — it must keep working on a frozen week
        await user.click(screen.getAllByTitle('Focus this day')[0]!);
        expect(screen.getByText(/Focusing/)).toBeTruthy();
    });

    // An ended week's position carries no meaning beyond its own weekStart, so
    // sitting before one is not on its own a reason to be frozen.
    it('a free week inside the archive is editable, not frozen (weeks interleave)', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        // Landing is 2026-07-27; step back nine times into the fixtures' hole.
        // 2026-05-25 has no entry and sits before the last ended week
        // (2026-07-13).
        for (let i = 0; i < 9; i++) {
            await user.click(screen.getByLabelText(en.weekHeader.prevWeek));
        }
        expect(screen.getByText('May 25 – May 31')).toBeTruthy();

        const projects = document.querySelector('.projectView');
        expect(projects?.hasAttribute('inert')).toBe(false);
        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeTruthy();
        // Nothing wrong and no day phase, so the note falls through to the last
        // branch.
        expect(screen.getByText(en.app.emptyNote)).toBeTruthy();

        await user.click(screen.getByRole('button', { name: en.projectList.addProject }));
        expect(screen.getByPlaceholderText(en.projectCard.namePlaceholder)).toBeTruthy();
    });

    it('opening the best week from Stats switches tab and week together', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole('button', { name: en.topBar.views.stats }));
        const ref = screen.getByRole('button', { name: /^Go to / });
        const week = ref.textContent;
        await user.click(ref);

        expect(screen.getByRole('button', { name: en.topBar.views.plan })).toHaveAttribute(
            'aria-current',
            'page',
        );
        expect(screen.getByText(week ?? '')).toBeTruthy();
    });

    it('ending a week with carry-forward archives it whole and moves the view on', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByLabelText(en.weekHeader.prevWeek)); // onto sampleWeek's week
        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: en.app.carryForward }));

        // The view followed the carry onto 2026-07-27 — also the current week —
        // which now holds what was left over, so End week is live again.
        expect(
            screen.getByRole('button', { name: en.weekHeader.endWeek }).hasAttribute('disabled'),
        ).toBe(false);

        // The ended week is archived WHOLE: its row reports the week's real
        // done/total, unfinished work included, not n/n.
        await user.click(screen.getByRole('button', { name: 'Weeks' }));
        const { done, total } = overallProgress(sampleWeek.projects);
        expect(done).toBeLessThan(total); // the fixture has to be partial for this to bite
        expect(screen.getByText(`${done}/${total} done`)).toBeTruthy();
    });

    // handleAuthSubmit closes the dialog when it is safe to — signin always,
    // signup only once a session exists — and otherwise leaves AuthForm mounted
    // to show its own non-committal state.
    //
    // Two "Sign in"-labelled buttons are on screen at once here, the top bar's
    // trigger and the form's submit, so queries are scoped with `within`.
    describe('sign-up email confirmation', () => {
        async function openAuthDialog(user: ReturnType<typeof userEvent.setup>) {
            await user.click(screen.getByRole('button', { name: 'Sign in' }));
            return within(screen.getByRole('dialog'));
        }

        it('signup that establishes no session keeps the dialog open on a pending-confirmation message', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(
                dialog.getByRole('button', { name: en.authForm.switches.signin.action }),
            );
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'new@example.com');
            await user.type(dialog.getByLabelText(en.authForm.usernameLabel), 'duong');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.type(dialog.getByLabelText(en.authForm.confirmPasswordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.signup }));

            expect(await dialog.findByText(en.authForm.checkYourEmail)).toBeTruthy();
            expect(dialog.getByText('new@example.com')).toBeTruthy();
            expect(dialog.getByText(/Open the link to finish creating your account/)).toBeTruthy();
            // Following the confirmation link signs the browser in
            // automatically — this screen must not offer or imply a manual
            // sign-in step.
            expect(dialog.queryByRole('button', { name: /sign in/i })).toBeNull();
            expect(dialog.queryByText(/come back and sign in/i)).toBeNull();
            // still escapable — the guest affordance survives into this state
            expect(dialog.getByText(en.authForm.keepPlanningAsGuest)).toBeTruthy();
            expect(screen.getByRole('dialog')).toBeTruthy();
        });

        it('the pending screen can go back to the form, address intact, to fix a mistyped email', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(
                dialog.getByRole('button', { name: en.authForm.switches.signin.action }),
            );
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'typo@example.com');
            await user.type(dialog.getByLabelText(en.authForm.usernameLabel), 'duong');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.type(dialog.getByLabelText(en.authForm.confirmPasswordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.signup }));
            await dialog.findByText(en.authForm.checkYourEmail);

            await user.click(dialog.getByRole('button', { name: en.authForm.useDifferentEmail }));

            expect(dialog.queryByText(en.authForm.checkYourEmail)).toBeNull();
            expect(dialog.getByRole('button', { name: en.authForm.submits.signup })).toBeTruthy();
            expect(dialog.getByLabelText(en.authForm.emailLabel)).toHaveValue('typo@example.com');
        });

        it('signup that establishes a session immediately closes the dialog', async () => {
            fake.auth.signUp.mockResolvedValueOnce({
                data: { session: sessionFor('u1', 'new@example.com') },
                error: null,
            });
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(
                dialog.getByRole('button', { name: en.authForm.switches.signin.action }),
            );
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'new@example.com');
            await user.type(dialog.getByLabelText(en.authForm.usernameLabel), 'duong');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.type(dialog.getByLabelText(en.authForm.confirmPasswordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.signup }));

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('a plain sign-in still closes the dialog on success', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'you@example.com');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: 'Sign in' }));

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        // The complaint goes through the same sentence-under-the-button channel
        // as every other field, not the browser's native validation bubble.
        it('signup refuses to submit without a name, and never reaches the backend', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(
                dialog.getByRole('button', { name: en.authForm.switches.signin.action }),
            );
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'new@example.com');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.type(dialog.getByLabelText(en.authForm.confirmPasswordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.signup }));

            expect(await dialog.findByText(en.authForm.pickUsername)).toBeTruthy();
            expect(supabase.auth.signUp).not.toHaveBeenCalled();
        });

        // user_metadata is where useAuth reads the name back from.
        it('the name reaches Supabase as user_metadata, trimmed', async () => {
            const user = userEvent.setup();
            await renderLoaded();
            const dialog = await openAuthDialog(user);

            await user.click(
                dialog.getByRole('button', { name: en.authForm.switches.signin.action }),
            );
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'new@example.com');
            await user.type(dialog.getByLabelText(en.authForm.usernameLabel), '  duong  ');
            await user.type(dialog.getByLabelText(en.authForm.passwordLabel), 'password123');
            await user.type(dialog.getByLabelText(en.authForm.confirmPasswordLabel), 'password123');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.signup }));

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

            await user.click(dialog.getByRole('button', { name: en.authForm.forgotPassword }));
            await user.type(dialog.getByLabelText(en.authForm.emailLabel), 'you@example.com');
            await user.click(dialog.getByText('solve captcha'));
            await user.click(dialog.getByRole('button', { name: en.authForm.submits.reset }));

            expect(await dialog.findByText(en.authForm.resetLinkSent)).toBeTruthy();
            expect(screen.getByRole('dialog')).toBeTruthy();
        });
    });

    // AuthForm alone passes closeOnScrimClick={false}; every other dialog still
    // closes on a scrim click.
    it('clicking outside the sign-in/sign-up dialog does not close it', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        const dialog = screen.getByRole('dialog');
        await user.click(dialog.parentElement!); // the scrim, outside the panel

        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    /*
     * The whole-week actions App owns. Every one is destructive or moves the
     * view, and each is reachable only through the dialog that owns it.
     *
     *   partition on the action: end (unfinished | all done) | reopen | clear
     *       board | move work (allowed | blocked destination)
     *   partition on the confirm: confirmed | dismissed
     */

    /** Steps back one week, onto sampleWeek's own week, which is active. */
    async function stepBackToSampleWeek(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek));
    }

    async function openManageSheet(user: ReturnType<typeof userEvent.setup>) {
        await user.click(screen.getByRole('button', { name: en.weekHeader.manage }));
    }

    // The one destructive week action that leaves nothing behind: clearing
    // keeps no archive record.
    it('clearing the board is offered behind a confirm, and dismissing keeps the work', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);

        await openManageSheet(user);
        await user.click(screen.getByText(en.weekActionsSheet.clear));
        await user.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(screen.queryByText(en.weekWelcome.quietTitle)).toBeNull();
    });

    it('confirming the clear empties that week and leaves the archive alone', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        const archivedBefore = endedWeeks(seed).length;

        await openManageSheet(user);
        await user.click(screen.getByText(en.weekActionsSheet.clear));
        await user.click(screen.getByRole('button', { name: en.app.clearBoardConfirm }));

        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Weeks' }));
        expect(screen.getAllByRole('button', { name: /^Open week/ })).toHaveLength(archivedBefore);
    });

    it('an ended week can be reopened, and becomes editable again', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await stepBackToSampleWeek(user); // back onto the week just ended
        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(true);

        await user.click(screen.getByRole('button', { name: en.weekHeader.reopen }));
        await user.click(screen.getByRole('button', { name: en.app.reopenConfirm }));

        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(false);
    });

    it('dismissing the reopen leaves the week frozen', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: en.weekHeader.reopen }));
        await user.click(screen.getByRole('button', { name: en.common.cancel }));

        expect(document.querySelector('.projectView')?.hasAttribute('inert')).toBe(true);
    });

    it('moving a week relabels the work and takes the view with it', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);
        expect(screen.getByText('Jul 20 – Jul 26')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: /work/i }));
        // armed: the arrows now aim a destination rather than change the view.
        // Forward onto the current week, which the fixtures leave empty — Jul 13
        // behind it is an ended week and so occupied (see the blocked case below).
        await user.click(screen.getByLabelText(en.weekHeader.nextDestination));
        await user.click(screen.getByRole('button', { name: /work onto Jul 27/ }));

        expect(screen.getByText('Jul 27 – Aug 02')).toBeTruthy();
        // and the week it came from is empty now, not a second copy
        await user.click(screen.getByLabelText(en.weekHeader.prevWeek));
        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeTruthy();
    });

    // moveWeek refuses a destination that already holds work; the header says
    // so in place of the destination note.
    it('a destination that already has work explains itself instead of going quiet', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: /work/i }));
        // Jul 13 is the last ended week in the fixtures, so it is occupied.
        await user.click(screen.getByLabelText(en.weekHeader.prevDestination));

        expect(screen.getByText(en.app.moveBlockedHasWork)).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Cannot move here/ })).toBeDisabled();
    });

    // Needs its own seed: canEndWeek refuses an empty week, so "finished" has
    // to mean every subtask ticked, not an empty board.
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

        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));

        expect(screen.getByText(/Everything/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: en.app.carryForward })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    });

    /*
     * The guide goes off when it is switched off, and at no other time —
     * finishing a week is not a statement about wanting to be taught.
     *
     *   partition on the archive at the moment of ending: empty (the first week
     *       ever finished) | already holding weeks. Neither touches it.
     */
    it('finishing a first week leaves the guide preference alone', async () => {
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

        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        // Scoped: the header's button and the dialog's confirm now carry the
        // same label, so an unscoped query matches both.
        await user.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: en.app.endDoneConfirm,
            }),
        );

        expect(window.localStorage.getItem('beaverplans:guide')).toBe('yes');
    });

    it('finishing a later week leaves the guide preference alone', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        // turned back on by hand, with weeks already in the archive
        window.localStorage.setItem('beaverplans:guide', 'yes');
        await stepBackToSampleWeek(user);

        await user.click(screen.getByRole('button', { name: en.weekHeader.endWeek }));
        await user.click(screen.getByRole('button', { name: 'Clear all' }));

        expect(window.localStorage.getItem('beaverplans:guide')).toBe('yes');
    });

    // The list now edits Weeks directly rather than the ended slice, so what is
    // worth pinning is that deleting one row takes exactly that week with it.
    it('deleting one week from the list leaves every other week standing', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole('button', { name: 'Weeks' }));
        expect(screen.getAllByRole('button', { name: /^Open week/ })).toHaveLength(seed.length);

        // An ended week, named rather than taken by position: the newest row is
        // the active one and deleting it would prove nothing about the rest.
        const label = weekRangeLabel('2026-07-13', 'en');
        const row = screen.getByRole('button', { name: `Open week ${label}` });
        await user.click(within(row).getByRole('button', { name: /^Delete week/ }));
        await user.click(screen.getByRole('button', { name: en.common.delete }));

        expect(screen.getAllByRole('button', { name: /^Open week/ })).toHaveLength(seed.length - 1);
        expect(
            screen.queryByRole('button', { name: `Open week ${label}` }),
        ).not.toBeInTheDocument();

        // the active week survived the edit
        await user.click(screen.getByRole('button', { name: en.topBar.views.plan }));
        await stepBackToSampleWeek(user);
        expect(screen.queryByText(en.weekWelcome.quietTitle)).toBeNull();
    });

    /*
     * The signed-in half of the app: everything App only mounts once
     * auth.user is non-null, plus the recovery gate that replaces it entirely.
     * The board is the same board, so it is not re-tested here — only the
     * panels, the handoffs between them, and what the destructive ones do.
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

        // The chip opens the sheet at every width now — there is no desktop
        // dropdown for these rows to live in.
        async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
            await user.click(screen.getByRole('button', { name: /^Account: duong/ }));
        }

        function sheetRow(name: string | RegExp) {
            return within(screen.getByRole('dialog')).getByText(name).closest('button')!;
        }

        async function openDataPanel(user: ReturnType<typeof userEvent.setup>) {
            await openAccountMenu(user);
            await user.click(sheetRow(en.accountSheet.data));
        }

        /*
         * Back rather than Close: these screens are opened FROM the account
         * sheet, so leaving one returns to it instead of dropping you on the
         * board and making you find the chip again.
         */
        it('Back out of the data panel returns to the account sheet', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);
            expect(screen.getByText(en.dataPrivacyDialog.title)).toBeTruthy();

            await user.click(
                within(screen.getByRole('dialog')).getByRole('button', { name: en.common.back }),
            );

            expect(screen.getByText(en.accountSheet.accountSettings)).toBeTruthy();
            expect(screen.queryByText(en.dataPrivacyDialog.title)).toBeNull();
        });

        it('Back out of account settings returns to the account sheet', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);
            await user.click(sheetRow(en.accountSheet.accountSettings));

            await user.click(
                within(screen.getByRole('dialog')).getByRole('button', { name: en.common.back }),
            );

            expect(screen.getByText(en.accountSheet.data)).toBeTruthy();
        });

        // The sheet is the top of this stack, so it closes rather than going back.
        it('Close on the account sheet leaves it altogether', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);

            await user.click(
                within(screen.getByRole('dialog')).getByRole('button', { name: en.common.close }),
            );

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        // The count here is what the erasure confirm below quotes back.
        it('Data & privacy names the number of weeks it would act on', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            expect(screen.getByText(`${seed.length} weeks stored`)).toBeTruthy();
        });

        // Nothing survives this one, so a dismissal has to be a genuine no-op
        // rather than a delete that already happened behind the dialog.
        it('deleting everything asks first, and dismissing keeps every week', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            await user.click(screen.getByRole('button', { name: /Delete all my data/ }));
            // handed off, not stacked: the panel closes on the way
            expect(screen.getByText(en.app.clearAllTitle)).toBeTruthy();
            expect(screen.queryByText(/Nothing stored yet/)).toBeNull();

            await user.click(screen.getByRole('button', { name: en.common.back }));

            expect(screen.queryByText(en.app.clearAllTitle)).toBeNull();
            // Back, not Close: this confirm was reached from the data panel.
            expect(screen.getByText(en.dataPrivacyDialog.title)).toBeTruthy();
            expect(store.getWeeks()).toHaveLength(seed.length);
            await user.click(screen.getByRole('button', { name: 'Weeks' }));
            expect(screen.getAllByRole('button', { name: /^Open week/ })).toHaveLength(seed.length);
        });

        // It has to reach past this device: weeks left on the server come back
        // on the next load, which reads as the deletion silently failing.
        it('confirming the delete empties the app and asks the server to drop every week', async () => {
            const user = await renderSignedIn();
            await openDataPanel(user);

            await user.click(screen.getByRole('button', { name: /Delete all my data/ }));
            // Consent for "all 7 of your weeks" is not consent for some other
            // number.
            expect(screen.getByText(new RegExp(`all ${seed.length} of your weeks`))).toBeTruthy();

            // Held until the account name is typed back: the erasure reaches
            // every device, so a stray click must not be enough.
            const confirm = screen.getByRole('button', { name: en.app.clearAllConfirm });
            expect(confirm).toBeDisabled();
            await user.type(within(screen.getByRole('dialog')).getByRole('textbox'), 'duong');
            await user.click(confirm);

            expect(screen.getByText(en.weekWelcome.titleProject)).toBeTruthy();
            await user.click(screen.getByRole('button', { name: 'Weeks' }));
            expect(screen.queryAllByRole('button', { name: /^Open week/ })).toHaveLength(0);

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

        // App owns both flows rather than nesting them inside the panel that
        // offers them, so the handoff is the thing that can break.
        it('Account settings hands off to Change password, closing itself on the way', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);
            await user.click(sheetRow(en.accountSheet.accountSettings));
            expect(screen.getByText('duong')).toBeTruthy();

            await user.click(screen.getByRole('button', { name: /Password/ }));

            expect(screen.getByText(en.changePasswordForm.title)).toBeTruthy();
            expect(screen.queryByText(en.accountSheet.accountSettings)).toBeNull();
        });

        it('Account settings hands off to Change email, closing itself on the way', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);
            await user.click(sheetRow(en.accountSheet.accountSettings));

            await user.click(screen.getByRole('button', { name: en.accountSettings.changeEmail }));

            expect(screen.getByText(en.changeEmailForm.title)).toBeTruthy();
            expect(screen.getByText(/Currently using you@example\.com/)).toBeTruthy();
            expect(screen.getByRole('button', { name: en.changeEmailForm.submit })).toBeEnabled();
            // The re-auth gate reaches the real screen: only the new address is
            // mailed, so the password is the only check on the change.
            expect(screen.getByLabelText(en.authForm.passwordLabel)).toBeTruthy();
            expect(screen.queryByText(en.accountSheet.accountSettings)).toBeNull();
        });

        // The next person at this browser is a guest, so the data goes with the
        // chip.
        it('signing out drops back to the guest board', async () => {
            const user = await renderSignedIn();
            await openAccountMenu(user);

            await user.click(sheetRow(en.accountSheet.signOut));
            // supabase-js reports the sign-out as an event; the mock does not
            // fire one on its own.
            emit('SIGNED_OUT', null);

            expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: /^Account: duong/ })).toBeNull();
            expect(screen.getByText(en.weekWelcome.titleProject)).toBeTruthy();
        });

        /*
         * The recovery gate. A reset-password link signs the browser in with a
         * live session, so without it someone lands in their account having
         * never set a new password, with the old one still valid.
         */
        it('a recovery link replaces the app with the new-password screen, board and all', async () => {
            await renderSignedIn();

            emit('PASSWORD_RECOVERY', account);

            expect(await screen.findByText(en.recoveryScreen.title)).toBeTruthy();
            expect(screen.queryByRole('button', { name: en.topBar.views.plan })).toBeNull();
            expect(screen.queryByRole('button', { name: /^Account: duong/ })).toBeNull();
        });

        it('setting the new password releases the gate into the app', async () => {
            const user = await renderSignedIn();
            emit('PASSWORD_RECOVERY', account);
            await screen.findByText(en.recoveryScreen.title);

            await user.type(screen.getByLabelText(en.changePasswordForm.newLabel), 'newpassword');
            await user.type(screen.getByLabelText(en.authForm.confirmPasswordLabel), 'newpassword');
            await user.click(screen.getByRole('button', { name: en.recoveryScreen.submit }));

            expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword' });
            expect(await screen.findByRole('button', { name: en.topBar.views.plan })).toBeTruthy();
        });

        // The gate must NOT drop when the sign-out fails: the recovery session
        // would still be live, which is what the screen exists to prevent.
        it('cancelling the recovery signs out; a failed sign-out keeps the gate up', async () => {
            fake.auth.signOut.mockResolvedValueOnce({ error: { message: 'Offline' } });
            const user = await renderSignedIn();
            emit('PASSWORD_RECOVERY', account);
            await screen.findByText(en.recoveryScreen.title);

            await user.click(screen.getByRole('button', { name: en.common.cancel }));

            expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
            expect(await screen.findByText('Offline')).toBeTruthy();
            expect(screen.getByText(en.recoveryScreen.title)).toBeTruthy();

            await user.click(screen.getByRole('button', { name: en.common.cancel }));
            await waitFor(() => expect(screen.queryByText(en.recoveryScreen.title)).toBeNull());
        });

        /*
         * The guest-work prompt. Raised only when this browser holds guest
         * weeks and the account already has weeks of its own.
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

        /*
         * The same guest work, but landing on a week the account has already
         * ENDED. putWeek freezes an ended week against every producer, so the
         * merge cannot write there — and merging clears the guest copy, so a
         * silent drop would destroy the work outright. Hence the second
         * question, and hence these tests asserting on what is left on the
         * device rather than only on what is on screen.
         */
        const endedCollisionWeek = '2026-07-20'; // sampleWeek's own week

        function seedGuestWorkOnEndedWeek() {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    weeks: [{ ...guestWeeks[0], weekStart: endedCollisionWeek }],
                }),
            );
            seedServer(putWeek(seed, { ...weekAt(seed, endedCollisionWeek), ended: true }));
        }

        it('guest work landing on an archived week asks before merging anything', async () => {
            seedGuestWorkOnEndedWeek();
            const user = await renderSignedIn();

            await user.click(await screen.findByRole('button', { name: /Merge into my plan/ }));

            expect(await screen.findByText(en.guestMerge.reopenTitle)).toBeTruthy();
            // Nothing has moved yet: the guest copy is still the only copy.
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Planned as a guest');
        });

        it('reopening from that second prompt keeps the work instead of dropping it', async () => {
            seedGuestWorkOnEndedWeek();
            const user = await renderSignedIn();

            await user.click(await screen.findByRole('button', { name: /Merge into my plan/ }));
            await user.click(
                await screen.findByRole('button', { name: en.guestMerge.reopenConfirm }),
            );

            // The week is live again and holds the guest's project beside its own.
            await waitFor(() =>
                expect(
                    store.getWeeks().find((week) => week.weekStart === endedCollisionWeek)?.ended,
                ).toBe(false),
            );
            expect(
                store
                    .getWeeks()
                    .find((week) => week.weekStart === endedCollisionWeek)
                    ?.projects.some((project) => project.name === 'Planned as a guest'),
            ).toBe(true);
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"weeks":[]');
        });

        it('cancelling that second prompt leaves the guest work on the device', async () => {
            seedGuestWorkOnEndedWeek();
            const user = await renderSignedIn();

            await user.click(await screen.findByRole('button', { name: /Merge into my plan/ }));
            await user.click(await screen.findByRole('button', { name: en.common.cancel }));

            await waitFor(() => expect(screen.queryByText(en.guestMerge.reopenTitle)).toBeNull());
            // Still the only copy, so the next sign-in can ask again.
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Planned as a guest');
            expect(
                store.getWeeks().find((week) => week.weekStart === endedCollisionWeek)?.ended,
            ).toBe(true);
        });

        it('guest work plus an account that already has weeks raises the prompt, and merging keeps both', async () => {
            seedGuestWork();
            const user = await renderSignedIn();

            expect(await screen.findByText(en.guestMerge.title)).toBeTruthy();
            // jsdom measures every box at zero, so this is the phone's form of
            // the question — rows you tap, not buttons in a foot (see the
            // desktop test below for the other half of that pair)
            expect(screen.getByText(/Your guest work will be added/)).toBeTruthy();
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
            await screen.findByText(en.guestMerge.title);

            await user.click(screen.getByRole('button', { name: /Discard guest work/ }));

            expect(screen.queryByText(en.guestMerge.title)).toBeNull();
            expect(screen.queryByDisplayValue('Planned as a guest')).toBeNull();
            expect(store.getWeeks()).toHaveLength(seed.length);
        });

        // The one prompt whose two form factors are different COMPONENTS rather
        // than the same one restyled (see App's isDesktop), so a width that
        // picks the wrong one is a real failure, not a cosmetic one.
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
            await screen.findByText(en.guestMerge.title);

            expect(
                screen.getByText(/keeping each item in the week you planned it for/),
            ).toBeTruthy();
            expect(screen.queryByText(/Deletes what you planned as a guest/)).toBeNull();

            // Decide later is not a cancel: it keeps the guest work for next time
            await user.click(screen.getByRole('button', { name: en.guestMerge.decideLater }));
            expect(screen.queryByText(en.guestMerge.title)).toBeNull();
            expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Planned as a guest');
        });
    });

    /*
     * App's own prose: the header note, and the whole-week confirms it owns
     * rather than delegates. Each confirm is a separate branch, and a branch
     * left hard-coded is invisible until you are standing in it.
     *
     * Everything here is signed out, so the fourth confirm (Delete every week,
     * reached from Data & privacy) is out of reach and covered by its catalog
     * entry alone.
     */
    describe('in Vietnamese', () => {
        const app = viCatalog.app;

        /** renderLoaded's Vietnamese twin — the same WeekRef, named in vi. */
        async function renderLoadedIn() {
            renderIn('vi', <App />);
            // The range is numeric in Vietnamese — `20/07 – 26/07`, not `Jul 20`.
            await screen.findByRole('button', { name: /^Đi tới 20\/07/ });
        }

        const stepBack = async (user: ReturnType<typeof userEvent.setup>) =>
            user.click(screen.getByLabelText(viCatalog.weekHeader.prevWeek));

        // The WeekRef branch is an element wrapped in a sentence, the one shape
        // the catalog cannot hold whole.
        it('covers vi: the header note names the open week and reads around it', async () => {
            await renderLoadedIn();

            const note = screen.getByRole('button', { name: /^Đi tới 20\/07/ }).parentElement;
            expect(note).toHaveTextContent(`${app.queueOpenLead}20/07 – 26/07${app.queueOpenRest}`);
            expect(note).not.toHaveTextContent(en.app.queueOpenRest.trim());
        });

        it('covers vi: the end-week confirm, its body and both of its actions', async () => {
            const user = userEvent.setup();
            await renderLoadedIn();
            await stepBack(user);

            await user.click(screen.getByRole('button', { name: viCatalog.weekHeader.endWeek }));

            expect(screen.getByText(app.endUnfinishedTitle)).toBeInTheDocument();
            expect(screen.getByText(app.endUnfinishedBody)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: app.clearAllLabel })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: app.carryForward })).toBeInTheDocument();
            expect(screen.queryByText(en.app.endUnfinishedTitle)).not.toBeInTheDocument();
        });

        it('covers vi: the reopen confirm, the one that argues with you', async () => {
            const user = userEvent.setup();
            await renderLoadedIn();
            await stepBack(user);
            await user.click(screen.getByRole('button', { name: viCatalog.weekHeader.endWeek }));
            await user.click(screen.getByRole('button', { name: app.clearAllLabel }));
            await stepBack(user);

            await user.click(screen.getByRole('button', { name: viCatalog.weekHeader.reopen }));

            expect(screen.getByText(app.reopenTitle)).toBeInTheDocument();
            expect(screen.getByText(app.reopenBody)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: app.reopenConfirm })).toBeInTheDocument();
            expect(screen.queryByText(en.app.reopenTitle)).not.toBeInTheDocument();
        });

        it('covers vi: the ended note, once the week is actually frozen', async () => {
            const user = userEvent.setup();
            await renderLoadedIn();
            await stepBack(user);
            await user.click(screen.getByRole('button', { name: viCatalog.weekHeader.endWeek }));
            await user.click(screen.getByRole('button', { name: app.clearAllLabel }));
            await stepBack(user);

            // Jul 26 is that week's Sunday, in the numeric Vietnamese form.
            expect(screen.getByText(app.endedNote('26/07'))).toBeInTheDocument();
            expect(
                screen.queryByText(en.app.endedNote(monthAndDay('2026-07-26', 'en'))),
            ).not.toBeInTheDocument();
        });

        it('covers vi: the clear-board confirm, reached through the Manage sheet', async () => {
            const user = userEvent.setup();
            await renderLoadedIn();
            await stepBack(user);

            await user.click(screen.getByRole('button', { name: viCatalog.weekHeader.manage }));
            // A sheet row's accessible name is its heading AND its sentence, so
            // the heading alone has to match loosely.
            await user.click(
                screen.getByRole('button', {
                    name: new RegExp(viCatalog.weekActionsSheet.clear),
                }),
            );

            expect(screen.getByText(app.clearBoardTitle)).toBeInTheDocument();
            expect(screen.getByText(app.clearBoardBody)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: app.clearBoardConfirm })).toBeInTheDocument();
            expect(screen.queryByText(en.app.clearBoardTitle)).not.toBeInTheDocument();
        });
    });
});
