import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
// `vi` is already vitest's here, so the Vietnamese catalog comes in renamed.
import { vi as viCatalog } from '@/i18n/vi';
import { ThemePicker } from './ThemePicker';

describe('ThemePicker', () => {
    /*
     * Testing strategy
     *   partition on pref: each of the three, since the lit segment is the
     *     PREFERENCE and not the resolved theme
     *   partition on the press: a different option (reports) | the current one
     *     (deliberately inert)
     */

    it('lights the preference, not the resolved theme', () => {
        render(<ThemePicker pref="system" onPick={vi.fn()} />);

        expect(screen.getByRole('button', { name: en.themePicker.options.system })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: en.themePicker.options.dark })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
    });

    it('picking another option reports it', async () => {
        const onPick = vi.fn();
        const user = userEvent.setup();
        render(<ThemePicker pref="light" onPick={onPick} />);

        await user.click(screen.getByRole('button', { name: en.themePicker.options.dark }));

        expect(onPick).toHaveBeenCalledWith('dark');
    });

    it('re-picking the current one writes nothing', async () => {
        const onPick = vi.fn();
        const user = userEvent.setup();
        render(<ThemePicker pref="light" onPick={onPick} />);

        await user.click(screen.getByRole('button', { name: en.themePicker.options.light }));

        expect(onPick).not.toHaveBeenCalled();
    });

    /*
     * A record of English inside the component would be invisible to any search
     * for a rendered string, so this walks all three segments and asserts the
     * English is gone.
     */
    it('renders in Vietnamese under a vi provider', () => {
        renderIn('vi', <ThemePicker pref="system" onPick={vi.fn()} />);
        const group = screen.getByRole('group', { name: viCatalog.themePicker.label });

        expect(group).toHaveTextContent(viCatalog.themePicker.options.light);
        expect(group).toHaveTextContent(viCatalog.themePicker.options.dark);
        expect(group).toHaveTextContent(viCatalog.themePicker.options.system);

        expect(group).not.toHaveTextContent(en.themePicker.options.light);
        expect(group).not.toHaveTextContent(en.themePicker.options.system);
        expect(screen.queryByRole('group', { name: en.themePicker.label })).toBeNull();
    });
});
