import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectEditor } from './ProjectEditor';
import type { Project } from '../core/types';

describe('ProjectEditor', () => {
    /*
     * Testing strategy
     *     partition on project.deadline: absent | present & parseable
     *         (date-only | datetime) | present & unparseable (ignored on open --
     *         a corrupt stored value must not be silently rewritten by an
     *         open-then-save round trip)
     *     partition on interaction before Save: leave untouched | set a date
     *         only | set date and time | clear an existing date
     *     onSave payload: undefined (no date) | "YYYY-MM-DD" (date, no time)
     *         | "YYYY-MM-DDTHH:MM" (date and time)
     *     Cancel -> onClose, not onSave
     */

    function makeProject(overrides: Partial<Project> = {}): Project {
        return {
            id: 'p1',
            name: 'English',
            tasks: [],
            ...overrides,
        };
    }

    it('covers deadline absent: date field starts empty, no Clear button', () => {
        render(<ProjectEditor project={makeProject()} onClose={() => {}} onSave={() => {}} />);
        expect(screen.getByLabelText('Deadline')).toHaveValue('');
        expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('covers deadline present, date-only: date field seeded, no time', () => {
        render(
            <ProjectEditor
                project={makeProject({ deadline: '2026-08-01' })}
                onClose={() => {}}
                onSave={() => {}}
            />,
        );
        expect(screen.getByLabelText('Deadline')).toHaveValue('2026-08-01');
        expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('covers deadline present, datetime: both date and time fields seeded', () => {
        render(
            <ProjectEditor
                project={makeProject({ deadline: '2026-08-01T14:30' })}
                onClose={() => {}}
                onSave={() => {}}
            />,
        );
        expect(screen.getByLabelText('Deadline')).toHaveValue('2026-08-01');
        expect(screen.getByDisplayValue('14:30')).toBeInTheDocument();
    });

    it('covers deadline present but unparseable: ignored, draft starts empty', () => {
        render(
            <ProjectEditor
                project={makeProject({ deadline: '2026-02-30' })}
                onClose={() => {}}
                onSave={() => {}}
            />,
        );
        expect(screen.getByLabelText('Deadline')).toHaveValue('');
    });

    it('covers Save with no date set: onSave(undefined)', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ProjectEditor project={makeProject()} onClose={() => {}} onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith(undefined);
    });

    it('covers Save with a date but no time: onSave("YYYY-MM-DD")', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ProjectEditor project={makeProject()} onClose={() => {}} onSave={onSave} />);

        await user.type(screen.getByLabelText('Deadline'), '2026-08-01');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith('2026-08-01');
    });

    it('covers Save with date and time: onSave("YYYY-MM-DDTHH:MM")', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<ProjectEditor project={makeProject()} onClose={() => {}} onSave={onSave} />);

        await user.type(screen.getByLabelText('Deadline'), '2026-08-01');
        // Dialog portals its content to document.body, so the time input (which
        // has no <label>) isn't under render()'s local container -- query the
        // document instead. fireEvent.change (not user.type) because typing
        // keystrokes into a time input is locale/AM-PM-fiddly in jsdom; a real
        // browser delivers the raw "HH:MM" value to onChange the same way.
        const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '14:30' } });
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith('2026-08-01T14:30');
    });

    it('covers clicking Clear on an existing deadline: date and time reset before Save', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(
            <ProjectEditor
                project={makeProject({ deadline: '2026-08-01T14:30' })}
                onClose={() => {}}
                onSave={onSave}
            />,
        );

        await user.click(screen.getByText('Clear'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith(undefined);
    });

    it('covers Cancel: calls onClose, not onSave', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onSave = vi.fn();
        render(<ProjectEditor project={makeProject()} onClose={onClose} onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });
});
