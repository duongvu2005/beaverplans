import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyTextDialog } from './CopyTextDialog';
import { renderIn } from '@/test/locale';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { en } from '@/i18n/en';

/*
 * Testing strategy
 *     partition on the way out: the Done button | Cancel
 *     partition on focus: untouched | focused, which must select the whole text
 */

const TEXT = '{\n  "format": "beaverplans.week",\n  "weekStart": "2026-08-03"\n}';

describe('CopyTextDialog', () => {
    it('shows the text in full, read-only', () => {
        render(<CopyTextDialog eyebrow="Archive" text={TEXT} onClose={() => {}} />);

        const box = screen.getByLabelText(en.copyTextDialog.boxLabel);
        expect(box).toHaveValue(TEXT);
        expect(box).toHaveAttribute('readonly');
    });

    it('selects the whole text on focus, so the recovery is one keystroke', async () => {
        render(<CopyTextDialog eyebrow="Archive" text={TEXT} onClose={() => {}} />);

        const box = screen.getByLabelText<HTMLTextAreaElement>('The copied plan, as text');
        await userEvent.click(box);

        expect(box.selectionStart).toBe(0);
        expect(box.selectionEnd).toBe(TEXT.length);
    });

    it('closes from Done', async () => {
        const onClose = vi.fn();
        render(<CopyTextDialog eyebrow="Archive" text={TEXT} onClose={onClose} />);

        await userEvent.click(screen.getByRole('button', { name: en.common.done }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // The eyebrow is a prop, so it stays English while the dialog's own words
    // move.
    it('covers vi: the title, the body and the box are named from the catalog', () => {
        renderIn('vi', <CopyTextDialog eyebrow="Archive" text={TEXT} onClose={() => {}} />);

        expect(screen.getByText(viCatalog.copyTextDialog.title)).toBeInTheDocument();
        expect(screen.getByText(viCatalog.copyTextDialog.body)).toBeInTheDocument();
        expect(screen.getByLabelText(viCatalog.copyTextDialog.boxLabel)).toHaveValue(TEXT);
        expect(screen.getByRole('button', { name: viCatalog.common.done })).toBeInTheDocument();

        expect(screen.queryByLabelText(en.copyTextDialog.boxLabel)).toBeNull();
    });
});
