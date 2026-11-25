import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { GuestMergeDialog } from './GuestMergeDialog';
import { GuestMergeSheet } from './GuestMergeSheet';

/*
 * One file for both: App picks between them on viewport alone, and they share a
 * single `guestMerge` catalog block, so one file is what catches them drifting.
 *
 * What each DOES — merging, discarding, deciding later — is App's to wire and
 * is covered there. This covers the words.
 */

const handlers = () => ({ onClose: vi.fn(), onMerge: vi.fn(), onDiscard: vi.fn() });
const panel = () => screen.getByRole('dialog');

describe('the guest-merge prompt', () => {
    it('the dialog asks in English by default', () => {
        render(<GuestMergeDialog {...handlers()} />);

        expect(panel()).toHaveTextContent(en.guestMerge.title);
        expect(panel()).toHaveTextContent(en.guestMerge.explain);
        expect(
            within(panel()).getByRole('button', { name: en.guestMerge.merge }),
        ).toBeInTheDocument();
        expect(
            within(panel()).getByRole('button', { name: en.guestMerge.decideLater }),
        ).toBeInTheDocument();
    });

    it('the sheet asks the same question, with a sentence on each row', () => {
        render(<GuestMergeSheet {...handlers()} />);

        expect(panel()).toHaveTextContent(en.guestMerge.title);
        expect(panel()).toHaveTextContent(en.guestMerge.mergeNote);
        expect(panel()).toHaveTextContent(en.guestMerge.discardNote);
        // The paragraph is the dialog's way of saying it; the sheet uses rows.
        expect(panel()).not.toHaveTextContent(en.guestMerge.explain);
    });

    it('the dialog renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.guestMerge;
        renderIn('vi', <GuestMergeDialog {...handlers()} />);

        expect(panel()).toHaveTextContent(copy.eyebrow);
        expect(panel()).toHaveTextContent(copy.title);
        expect(panel()).toHaveTextContent(copy.explain);
        expect(within(panel()).getByRole('button', { name: copy.discard })).toBeInTheDocument();

        expect(panel()).not.toHaveTextContent(en.guestMerge.title);
        expect(panel()).not.toHaveTextContent(en.guestMerge.decideLater);
    });

    it('the sheet renders in Vietnamese under a vi provider', () => {
        const copy = viCatalog.guestMerge;
        renderIn('vi', <GuestMergeSheet {...handlers()} />);

        expect(panel()).toHaveTextContent(copy.title);
        expect(panel()).toHaveTextContent(copy.mergeNote);
        expect(panel()).toHaveTextContent(copy.discardNote);
        expect(panel()).toHaveTextContent(copy.decideLater);

        expect(panel()).not.toHaveTextContent(en.guestMerge.merge);
        expect(panel()).not.toHaveTextContent('for good');
    });
});
