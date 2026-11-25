/**
 * The account's copy of the chosen type look.
 *
 * Kept in `user_metadata` beside the language, so a look chosen on one device is
 * the look every other device starts in.
 */

import {
    accountPref,
    type Account as PrefAccount,
    type AccountPref,
    type AuthClient,
} from '@/prefs/accountPref';
import { isFontPref, type FontPref } from './font';

/** What a signed-in account says about the type look. */
export type Account = PrefAccount<FontPref>;

/** The account side of the font preference, as FontProvider needs it. */
export type AccountFont = AccountPref<FontPref>;

/**
 * The account's type look, over a supabase-js auth client.
 *
 * @param auth an auth client for the project the app signs into
 * @returns a watcher and a writer for the signed-in account's look.
 *     Non-deterministic: both talk to the network.
 */
export function accountFont(auth: AuthClient): AccountFont {
    return accountPref<FontPref>(auth, 'font', isFontPref);
}
