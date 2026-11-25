import type { TreeKeysApi } from '@/components/project/useTreeKeys';

/**
 * A TreeKeysApi that does nothing, for tests about anything else.
 *
 * @returns an api whose three methods are no-ops, so a row renders and takes
 *     keystrokes without any of them meaning something.
 */
export function inertTreeKeys(): TreeKeysApi {
    return {
        register: () => {},
        focus: () => {},
        onKeyDown: () => {},
    };
}
