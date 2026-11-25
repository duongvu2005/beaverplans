import { createContext, useContext } from 'react';
import { DEFAULT_FONT, type FontPref } from './font';

/** What FontProvider hands down: the current look, and a way to change it. */
export type FontValue = {
    readonly font: FontPref;
    readonly setFont: (font: FontPref) => void;
};

// Defaulting rather than throwing on a missing provider is what lets a component
// be rendered, and tested, without one.
export const FontContext = createContext<FontValue>({
    font: DEFAULT_FONT,
    setFont: () => {},
});

/**
 * The current type look and a setter for it.
 *
 * @returns font, and setFont, which loads the incoming faces before re-pointing
 *     the type tokens and remembers the choice — on the account when there is
 *     one, on this device otherwise. Outside a FontProvider the look is the
 *     default and setFont does nothing.
 */
export function useFont(): FontValue {
    return useContext(FontContext);
}
