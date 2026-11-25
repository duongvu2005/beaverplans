import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { WeekWelcome } from './WeekWelcome';
import { en } from '@/i18n/en';
// `vi` is vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';

describe('WeekWelcome', () => {
    /*
     * Testing strategy
     *     partition on guiding: true (the whole guide) | false (one quiet line,
     *         and none of the guide — no steps, no button to press)
     *     partition on step: project | task | days — each owns a headline, a
     *         button label, and a position in the list that marks the steps
     *         before it done and itself current
     *     partition on the button: pressed once -> onAdvance called once
     *     partition on locale: en | vi, proving the catalog is read rather than
     *         a string being hard-coded
     *     partition on mode: full (every body and picture, one contextual
     *         button and the way out beside it) | explainer (the lede plus
     *         three bare headings, nothing lit, Get started and the way out) |
     *         guided (state marking kept, the reached step open in full — body
     *         and sample — the passed ones closed again, and no button at all)
     */

    it('covers guiding false: the quiet line, and nothing to act on', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding={false}
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(en.weekWelcome.quietTitle)).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('covers the project step: its headline, its button, and it is current', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(en.weekWelcome.titleProject)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.weekWelcome.ctaProject })).toBeInTheDocument();

        const steps = screen.getAllByRole('listitem');
        expect(steps[0]).toHaveAttribute('aria-current', 'step');
        expect(steps[1]).not.toHaveAttribute('aria-current');
        expect(steps[2]).not.toHaveAttribute('aria-current');
    });

    it('covers the task step: the headline names the project, step one is done', () => {
        render(
            <WeekWelcome
                welcome={{
                    step: 'task',
                    projectId: 'p1',
                    projectName: 'Linear Algebra',
                    unnamed: undefined,
                }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(en.weekWelcome.titleTask('Linear Algebra'))).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.weekWelcome.ctaTask })).toBeInTheDocument();

        const steps = screen.getAllByRole('listitem');
        expect(steps[1]).toHaveAttribute('aria-current', 'step');
        // the finished step says so rather than only looking different
        expect(screen.getAllByRole('img', { name: en.weekWelcome.stepDone })).toHaveLength(1);
    });

    it('covers the days step: both earlier steps are done', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'days', taskId: 't1' }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(en.weekWelcome.titleDays)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.weekWelcome.ctaDays })).toBeInTheDocument();

        const steps = screen.getAllByRole('listitem');
        expect(steps[2]).toHaveAttribute('aria-current', 'step');
        expect(screen.getAllByRole('img', { name: en.weekWelcome.stepDone })).toHaveLength(2);
    });

    // The day strip is decoration, so it carries its state as an attribute
    // rather than as anything a role query could reach.
    it('covers the day strip staying empty until the days step', () => {
        const { rerender } = render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );
        expect(document.querySelector('[data-picked]')).toHaveAttribute('data-picked', 'false');

        rerender(
            <WeekWelcome
                welcome={{
                    step: 'task',
                    projectId: 'p1',
                    projectName: 'Linear Algebra',
                    unnamed: undefined,
                }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );
        expect(document.querySelector('[data-picked]')).toHaveAttribute('data-picked', 'false');

        rerender(
            <WeekWelcome
                welcome={{ step: 'days', taskId: 't1' }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );
        expect(document.querySelector('[data-picked]')).toHaveAttribute('data-picked', 'true');
    });

    it('covers pressing the button advancing exactly once', async () => {
        const user = userEvent.setup();
        const onAdvance = vi.fn();
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={onAdvance}
                onSkip={() => {}}
            />,
        );

        await user.click(screen.getByRole('button', { name: en.weekWelcome.ctaProject }));

        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it('covers vi: the guide reads the catalog', () => {
        renderIn(
            'vi',
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(viCatalog.weekWelcome.titleProject)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: viCatalog.weekWelcome.ctaProject }),
        ).toBeInTheDocument();
        expect(screen.getByRole('list')).toHaveAccessibleName(viCatalog.weekWelcome.stepsLabel);
    });

    it('covers vi, guiding false: the quiet line reads the catalog', () => {
        renderIn(
            'vi',
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding={false}
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(viCatalog.weekWelcome.quietTitle)).toBeInTheDocument();
    });

    it('covers the explainer: the lede, three bare headings, one Get started', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="explainer"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        // the lede stays: it introduces the week
        expect(screen.getByText(en.weekWelcome.titleProject)).toBeInTheDocument();
        expect(screen.getByText(en.weekWelcome.subProject)).toBeInTheDocument();

        for (const heading of [
            en.weekWelcome.stepProject,
            en.weekWelcome.stepTask,
            en.weekWelcome.stepDays,
        ]) {
            expect(screen.getByText(heading)).toBeInTheDocument();
        }
        // a step's detail belongs to the step you have reached, and none is
        expect(screen.queryByText(en.weekWelcome.stepProjectBody)).not.toBeInTheDocument();
        expect(screen.queryByText(en.weekWelcome.stepTaskBody)).not.toBeInTheDocument();
        expect(screen.queryByText(en.weekWelcome.stepProjectSample)).not.toBeInTheDocument();
        expect(screen.queryByText(en.weekWelcome.stepTaskSample)).not.toBeInTheDocument();
        // nothing is current yet, so nothing claims to be the step you are on
        expect(document.querySelector('[aria-current="step"]')).toBeNull();

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]).toHaveAccessibleName(en.weekWelcome.getStarted);
        expect(buttons[1]).toHaveAccessibleName(en.weekWelcome.skip);
    });

    // Both modes with a button bar; guided has none, and is covered below.
    it.each(['explainer', 'full'] as const)('covers the skip in %s mode', async (mode) => {
        const onSkip = vi.fn();
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode={mode}
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={onSkip}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: en.weekWelcome.skip }));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    // Reading order is the visual order: the step to take first, the way out after.
    it('covers the full mode pairing the skip after its button', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="full"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]).toHaveAccessibleName(en.weekWelcome.ctaProject);
        expect(buttons[1]).toHaveAccessibleName(en.weekWelcome.skip);
    });

    it('covers guided offering no way out of its own', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="guided"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('covers Get started being pressed exactly once', async () => {
        const onStart = vi.fn();
        render(
            <WeekWelcome
                welcome={{ step: 'project', unnamed: undefined }}
                guiding
                mode="explainer"
                onStart={onStart}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: en.weekWelcome.getStarted }));
        expect(onStart).toHaveBeenCalledTimes(1);
    });

    // The body is the sentence naming the control the tree below has lit up.
    it('covers guided: the current step shows its body, and no button is offered', () => {
        render(
            <WeekWelcome
                welcome={{
                    step: 'task',
                    projectId: 'p1',
                    projectName: 'Linear Algebra',
                    unnamed: undefined,
                }}
                guiding
                mode="guided"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getByText(en.weekWelcome.stepTaskBody)).toBeInTheDocument();
        // the step behind the current one closes its body again
        expect(screen.queryByText(en.weekWelcome.stepProjectBody)).not.toBeInTheDocument();
        expect(screen.getByText(en.weekWelcome.stepTask).closest('li')).toHaveAttribute(
            'aria-current',
            'step',
        );
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        // the reached step opens in full — its sample comes with its body
        expect(screen.getByText(en.weekWelcome.stepTaskSample)).toBeInTheDocument();
        // and the step behind it keeps both closed
        expect(screen.queryByText(en.weekWelcome.stepProjectSample)).not.toBeInTheDocument();
    });

    it('covers guided: the steps before the current one are done', () => {
        render(
            <WeekWelcome
                welcome={{ step: 'days', taskId: 't1' }}
                guiding
                mode="guided"
                onStart={() => {}}
                onAdvance={() => {}}
                onSkip={() => {}}
            />,
        );

        expect(screen.getAllByRole('img', { name: en.weekWelcome.stepDone })).toHaveLength(2);
        expect(screen.getByText(en.weekWelcome.stepDaysBody)).toBeInTheDocument();
    });
});
