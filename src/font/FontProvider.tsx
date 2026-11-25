import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAccountPref } from '@/prefs/useAccountPref';
import { FontContext } from './fontContext';
import { DEFAULT_FONT, type FontPref } from './font';
import { fontCache } from './fontCache';
import { ensureFaces } from './faces';
import type { AccountFont } from './accountFont';

function initial(): FontPref {
    // Nothing to detect: unlike the language, the browser has no opinion about
    // which look someone wants.
    return DEFAULT_FONT;
}

type FontProviderProps = {
    /**
     * Where the look lives for a signed-in person. Omitted, the choice is this
     * device's alone — a guest, or a test wanting a fixed look.
     */
    account?: AccountFont;
    children: ReactNode;
};

/**
 * Owns the chosen type look for everything below it.
 *
 * The context and its hook live in `fontContext.ts`, so this file exports a
 * component and nothing else and Fast Refresh keeps working.
 *
 * The look follows the ACCOUNT, like the language and unlike the theme. Ordering
 * the account against the device cache is `useAccountPref`'s job; what is left
 * here is the font-only part — waiting for the incoming faces, and the
 * `data-font` attribute.
 *
 * Non-deterministic on first render: reads localStorage.
 */
export function FontProvider({ account, children }: FontProviderProps) {
    const { value: font, choose } = useAccountPref<FontPref>({
        account,
        cache: fontCache,
        initial,
    });

    useEffect(() => {
        // index.css keys the type tokens off this. Set unconditionally rather
        // than only for Classic, so a look arriving from the account clears the
        // one this device started in.
        document.documentElement.dataset.font = font;
    }, [font]);

    const setFont = useCallback(
        (next: FontPref) => {
            // Faces first, tokens second — see faces.ts for why the order is
            // load-bearing. With both looks preloaded this settles at once; it
            // stays because it is the invariant, not the fetch: the tokens must
            // never point at a face that is not already available.
            void ensureFaces(next).then(() => choose(next));
        },
        [choose],
    );

    const value = useMemo(() => ({ font, setFont }), [font, setFont]);

    return <FontContext value={value}>{children}</FontContext>;
}
