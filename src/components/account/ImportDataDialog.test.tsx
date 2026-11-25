import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportDataDialog } from './ImportDataDialog';
import { en } from '@/i18n/en';
import { exportJson } from '@/storage/exportData';
import { sampleWeek } from '@/fixtures/sampleWeek';

describe('ImportDataDialog', () => {
    /*
     * Testing strategy
     *     partition on route in: pasted into the box | chosen as a file
     *     partition on what arrives: nothing yet; unreadable; not ours; a valid
     *       backup
     *     partition on the action: held while unreadable | live once valid
     */
    function setup() {
        const onImport = vi.fn();
        const onClose = vi.fn();
        render(<ImportDataDialog onImport={onImport} onClose={onClose} />);
        return { onImport, onClose, user: userEvent.setup() };
    }

    const panel = () => screen.getByRole('dialog');
    const box = () => within(panel()).getByLabelText(en.importDataDialog.placeholder);
    const continueButton = () =>
        within(panel()).getByRole('button', { name: en.importDataDialog.continueLabel });

    const chooseFile = async (contents: string) => {
        const input = panel().querySelector('input[type="file"]');
        if (input === null) throw new Error('no file input');
        fireEvent.change(input, {
            target: { files: [new File([contents], 'backup.json', { type: 'application/json' })] },
        });
        await waitFor(() => expect(box()).toHaveValue(contents));
    };

    const validBackup = exportJson([sampleWeek], new Date('2026-08-18T00:00:00Z'));

    it('covers nothing entered yet: no verdict, and the action is held', () => {
        setup();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(continueButton()).toBeDisabled();
    });

    it('covers pasting something unreadable', async () => {
        const { user } = setup();
        await user.type(box(), 'not json{{');
        expect(screen.getByRole('alert')).toHaveTextContent(
            en.importDataDialog.reasons['not-json'],
        );
        expect(continueButton()).toBeDisabled();
    });

    it('covers pasting something that is not ours', async () => {
        const { user } = setup();
        await user.type(box(), '{{"hello":"world"}');
        expect(screen.getByRole('alert')).toHaveTextContent(
            en.importDataDialog.reasons['not-beaverplans'],
        );
    });

    it('covers pasting a valid backup, then handing it up', async () => {
        const { onImport, user } = setup();
        await user.click(box());
        await user.paste(validBackup);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText(en.importDataDialog.found(1))).toBeInTheDocument();
        await user.click(continueButton());
        expect(onImport).toHaveBeenCalledWith([sampleWeek]);
    });

    it('covers choosing a file, which fills the same box', async () => {
        const { onImport, user } = setup();
        await chooseFile(validBackup);
        expect(screen.getByText(en.importDataDialog.found(1))).toBeInTheDocument();
        await user.click(continueButton());
        expect(onImport).toHaveBeenCalledWith([sampleWeek]);
    });

    it('covers a file whose bytes cannot be read at all', async () => {
        const { onImport } = setup();
        const unreadable = new File([''], 'backup.json', { type: 'application/json' });
        vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('unreadable'));
        const input = panel().querySelector('input[type="file"]');
        if (input === null) throw new Error('no file input');
        fireEvent.change(input, { target: { files: [unreadable] } });
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                en.importDataDialog.reasons['not-json'],
            ),
        );
        // The box stays empty rather than holding bytes that were never read.
        expect(box()).toHaveValue('');
        expect(continueButton()).toBeDisabled();
        expect(onImport).not.toHaveBeenCalled();
    });

    it('covers typing after an unreadable file clearing that verdict', async () => {
        const { user } = setup();
        const unreadable = new File([''], 'backup.json', { type: 'application/json' });
        vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('unreadable'));
        const input = panel().querySelector('input[type="file"]');
        if (input === null) throw new Error('no file input');
        fireEvent.change(input, { target: { files: [unreadable] } });
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        await user.click(box());
        await user.paste(validBackup);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(continueButton()).toBeEnabled();
    });

    it('covers a bad file reporting in the same place a bad paste does', async () => {
        const { onImport } = setup();
        await chooseFile('not json{{');
        expect(screen.getByRole('alert')).toHaveTextContent(
            en.importDataDialog.reasons['not-json'],
        );
        expect(onImport).not.toHaveBeenCalled();
    });
});
