/**
 * The account's copy of the chosen language.
 *
 * The behaviour lives in `prefs/accountPref.ts`, which the font shares; this
 * names the `user_metadata` field and the guard.
 */

import {
    accountPref,
    type Account as PrefAccount,
    type AccountPref,
    type AuthClient,
} from '@/prefs/accountPref';
import { isLocale, type Locale } from './locale';

export type { AuthClient, SessionLike } from '@/prefs/accountPref';

/** What a signed-in account says about language. */
export type Account = PrefAccount<Locale>;

/** The account side of the language preference, as LocaleProvider needs it. */
export type AccountLocale = AccountPref<Locale>;

/**
 * The account's language, over a supabase-js auth client.
 *
 * @param auth an auth client for the project the app signs into
 * @returns a watcher and a writer for the signed-in account's language.
 *     Non-deterministic: both talk to the network.
 */
export function accountLocale(auth: AuthClient): AccountLocale {
    return accountPref<Locale>(auth, 'locale', isLocale);
}
