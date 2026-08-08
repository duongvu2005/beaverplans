import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataPrivacyDialog } from './DataPrivacyDialog';

const JSON_TEXT = '{"format":"beaverplans.export.v1","weeks":[]}';

function setup(overrides: Partial<Parameters<typeof DataPrivacyDialog>[0]> = {}) {
    const props = {
        email: 'you@example.com',
        weekCount: 3,
        onClose: vi.fn(),
        onDownload: vi.fn(),
        exportText: vi.fn(() => JSON_TEXT),
        onClearAll: vi.fn(),
        ...overrides,
    };
    render(<DataPrivacyDialog {...props} />);
    return { ...props, user: userEvent.setup() };
}

const panel = () => screen.getByRole('dialog');
const action = (name: RegExp) => within(panel()).getByRole('button', { name });

// jsdom exposes navigator.clipboard as a getter-only property, so it cannot be
// assigned over — each test that cares defines its own in place instead. Must be
// called AFTER userEvent.setup(), which installs a clipboard stub of its own and
// would otherwise replace this one.
function stubClipboard(writeText: (() => Promise<void>) | undefined) {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: writeText === undefined ? undefined : { writeText },
    });
}

describe('DataPrivacyDialog', () => {
    beforeEach(() => {
        stubClipboard(undefined);
    });

    /*
     * Testing strategy
     *   partition on weekCount: 0 (nothing to act on) | more
     *   partition on email: given (named in the notes) | undefined
     *   partition on the clipboard write: resolves (Copied) | rejects (manual
     *     fallback shown, with the same text to select by hand)
     *   each action reports to its caller; erasure hands off rather than
     *     confirming in place
     */

    it('names the account the data is filed under', () => {
        setup();
        expect(panel()).toHaveTextContent('you@example.com');
    });

    it('no email: the notes still read, just without an address', () => {
        setup({ email: undefined });
        expect(panel()).toHaveTextContent(/under your account/i);
        expect(panel()).not.toHaveTextContent('@');
    });

    it('says how many weeks are stored', () => {
        setup({ weekCount: 1 });
        expect(panel()).toHaveTextContent('1 week stored');
    });

    it('nothing stored: says so, and every action is disabled', () => {
        const { onDownload, onClearAll } = setup({ weekCount: 0 });
        expect(panel()).toHaveTextContent(/nothing stored yet/i);
        expect(action(/download as json/i)).toBeDisabled();
        expect(action(/copy as json/i)).toBeDisabled();
        expect(action(/delete all my data/i)).toBeDisabled();
        expect(onDownload).not.toHaveBeenCalled();
        expect(onClearAll).not.toHaveBeenCalled();
    });

    it('download reports to the caller', async () => {
        const { user, onDownload } = setup();
        await user.click(action(/download as json/i));
        expect(onDownload).toHaveBeenCalledTimes(1);
    });

    it('copy puts the export text on the clipboard and says so', async () => {
        const { user } = setup();
        const writeText = vi.fn(() => Promise.resolve());
        stubClipboard(writeText);

        await user.click(action(/copy as json/i));

        expect(writeText).toHaveBeenCalledWith(JSON_TEXT);
        expect(action(/copy as json/i)).toHaveTextContent(/copied/i);
    });

    // A refused write is a real outcome, not a broken one — the button must not
    // just sit there looking like the click missed.
    it('a refused clipboard write falls back to text to copy by hand', async () => {
        const { user } = setup();
        stubClipboard(() => Promise.reject(new Error('denied')));

        await user.click(action(/copy as json/i));

        const box = within(panel()).getByRole('textbox', { name: /your data as json/i });
        expect(box).toHaveValue(JSON_TEXT);
        expect(action(/copy as json/i)).not.toHaveTextContent(/copied/i);
    });

    it('no fallback text is shown before anything is tried', () => {
        setup();
        expect(within(panel()).queryByRole('textbox')).toBeNull();
    });

    it('erasure is announced as its own section, not just another action', () => {
        setup();
        expect(panel()).toHaveTextContent(/danger zone/i);
    });

    it('delete hands off to the caller rather than confirming here', async () => {
        const { user, onClearAll } = setup();
        await user.click(action(/delete all my data/i));
        expect(onClearAll).toHaveBeenCalledTimes(1);
        // no second confirm inside this panel — App owns that dialog
        expect(within(panel()).queryByRole('button', { name: /delete everything/i })).toBeNull();
    });

    it('Close reports to the caller', async () => {
        const { user, onClose } = setup();
        await user.click(action(/^close$/i));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
