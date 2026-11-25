import { describe, expect, it, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderIn } from '@/test/locale';
import { en } from '@/i18n/en';
import { vi } from '@/i18n/vi';
import { LanguagePicker } from './LanguagePicker';

describe('LanguagePicker', () => {
    /*
     * Testing strategy
     *
     * partition on the language showing: en | vi
     * partition on the button pressed: the current one | the other one
     * partition on what is asserted: which segment is lit | that the choice
     *     reaches a consumer | that it is remembered
     *
     * The words are asserted through the catalogs rather than as literals: what
     * is pinned here is that the control reads the catalog at all.
     */

    afterEach(() => {
        localStorage.clear();
    });

    it('covers en: English is lit, and both languages are named in their own', () => {
        render(<LanguagePicker />);

        expect(
            screen.getByRole('button', { name: en.languagePicker.choose('English') }),
        ).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(en.languagePicker.vietnamese)).toBeInTheDocument();
    });

    it('covers vi: the caption is Vietnamese and the Vietnamese segment is lit', () => {
        renderIn('vi', <LanguagePicker />);

        expect(screen.getByText(vi.languagePicker.label)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: vi.languagePicker.choose('Tiếng Việt') }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('covers picking the other language: the control follows immediately', async () => {
        const user = userEvent.setup();
        renderIn('en', <LanguagePicker />);

        await user.click(
            screen.getByRole('button', { name: en.languagePicker.choose('Tiếng Việt') }),
        );

        // The caption is the proof: it comes from the catalog, so it can only
        // have changed if the switch reached a consumer.
        expect(screen.getByText(vi.languagePicker.label)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: vi.languagePicker.choose('Tiếng Việt') }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('covers the choice being remembered, so it survives a reload', async () => {
        const user = userEvent.setup();
        renderIn('en', <LanguagePicker />);

        await user.click(
            screen.getByRole('button', { name: en.languagePicker.choose('Tiếng Việt') }),
        );

        expect(localStorage.getItem('beaverplans:locale')).toBe('vi');
    });

    it('covers re-picking the current language: nothing changes', async () => {
        const user = userEvent.setup();
        renderIn('en', <LanguagePicker />);

        await user.click(screen.getByRole('button', { name: en.languagePicker.choose('English') }));

        expect(screen.getByText(en.languagePicker.label)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: en.languagePicker.choose('English') }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    // The group keeps its name either way: dropping the caption must not cost a
    // screen reader the only thing that says what these two buttons are.
    it('covers caption={false}: no visible caption, and the group is still named', () => {
        render(<LanguagePicker caption={false} />);

        expect(screen.queryByText(en.languagePicker.label)).toBeNull();
        expect(screen.getByRole('group', { name: en.languagePicker.label })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: en.languagePicker.choose('English') }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    // The context's no-provider default is a deliberate 'en' with an inert
    // setter, which is why a test rendering this bare passes every assertion
    // about switching without switching anything.
    it('covers no provider: renders English and the buttons do nothing', async () => {
        const user = userEvent.setup();
        render(<LanguagePicker />);

        await user.click(
            screen.getByRole('button', { name: en.languagePicker.choose('Tiếng Việt') }),
        );

        expect(screen.getByText(en.languagePicker.label)).toBeInTheDocument();
        expect(localStorage.getItem('beaverplans:locale')).toBeNull();
    });
});
