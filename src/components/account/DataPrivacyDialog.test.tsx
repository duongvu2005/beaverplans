import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { DataPrivacyDialog } from './DataPrivacyDialog';
import { en } from '@/i18n/en';

const JSON_TEXT = '{"format":"beaverplans.export.v1","weeks":[]}';

function defaults(overrides: Partial<Parameters<typeof DataPrivacyDialog>[0]> = {}) {
    return {
        weekCount: 3,
        onClose: vi.fn(),
        onDownload: vi.fn(),
        exportText: vi.fn(() => JSON_TEXT),
        onClearAll: vi.fn(),
        onDeleteAccount: vi.fn(),
        onOpenImport: vi.fn(),
        ...overrides,
    };
}

function setup(overrides: Partial<Parameters<typeof DataPrivacyDialog>[0]> = {}) {
    const props = defaults(overrides);
    render(<DataPrivacyDialog {...props} />);
    return { ...props, user: userEvent.setup() };
}

const panel = () => screen.getByRole('dialog');

describe('the import route', () => {
    it('covers the button handing off rather than importing here', async () => {
        const { user, onOpenImport } = setup();
        await user.click(
            within(panel()).getByRole('button', { name: en.dataPrivacyDialog.importData }),
        );
        expect(onOpenImport).toHaveBeenCalledOnce();
    });
});
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
     *   partition on the clipboard write: resolves (Copied) | rejects (manual
     *     fallback shown, with the same text to select by hand)
     *   each action reports to its caller; erasure hands off rather than
     *     confirming in place
     */

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

    it('Back reports to the caller, which reopens the sheet this came from', async () => {
        const { user, onClose } = setup();
        await user.click(action(/^back$/i));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    /*
     * Every string on this panel comes from the catalog, so the vi render walks
     * the whole surface — and asserts the English is gone, since a Vietnamese-only
     * assertion also passes against a component that never reads the catalog.
     */
    it('renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.dataPrivacyDialog;
        renderIn('vi', <DataPrivacyDialog {...defaults()} />);

        expect(panel()).toHaveTextContent(copy.eyebrow);
        expect(panel()).toHaveTextContent(copy.title);
        expect(panel()).toHaveTextContent(copy.weeksStored(3));
        expect(panel()).toHaveTextContent(copy.dangerZone);
        expect(action(new RegExp(copy.download))).toBeInTheDocument();
        expect(action(new RegExp(copy.deleteAccount))).toBeInTheDocument();

        expect(panel()).not.toHaveTextContent(en.dataPrivacyDialog.title);
        expect(panel()).not.toHaveTextContent(en.dataPrivacyDialog.dangerZone);
        expect(panel()).not.toHaveTextContent('3 weeks stored');
    });
});
