import { describe, it, expect } from 'vitest';
import { AuthError, authErrorText, type AuthFailure } from './authError';
import { en } from '@/i18n/en';
import { vi as viCatalog } from '@/i18n/vi';

describe('authErrorText', () => {
    /*
     * Testing strategy
     *   partition on what was thrown: an AuthError (each failure) | some other
     *     Error, which is how a Supabase message arrives | neither
     *   partition on the catalog: en | vi, since the whole point of carrying an
     *     identity instead of a sentence is that the language is chosen late
     */

    const failures: Record<AuthFailure, string> = en.authForm.failures;

    it('names an AuthError from the catalog it is handed', () => {
        expect(authErrorText(new AuthError('blank-username'), failures, 'fallback')).toBe(
            en.authForm.failures['blank-username'],
        );
        expect(authErrorText(new AuthError('no-account'), failures, 'fallback')).toBe(
            en.authForm.failures['no-account'],
        );
    });

    // The reason the hook throws an identity: the same throw reads in whichever
    // language is on screen when it is caught, not the one the session began in.
    it('the same failure reads in whichever catalog is passed', () => {
        const thrown = new AuthError('no-account');

        expect(authErrorText(thrown, viCatalog.authForm.failures, 'fallback')).toBe(
            viCatalog.authForm.failures['no-account'],
        );
    });

    // Everything Supabase relays arrives this way. It is already-written English
    // the catalog cannot reach, so it passes through rather than being replaced.
    it('passes an ordinary Error through by its message', () => {
        expect(authErrorText(new Error('Rate limit reached.'), failures, 'fallback')).toBe(
            'Rate limit reached.',
        );
    });

    it('falls back for a thrown value that is not an Error at all', () => {
        expect(authErrorText('nope', failures, 'fallback')).toBe('fallback');
        expect(authErrorText(undefined, failures, 'fallback')).toBe('fallback');
    });

    // An AuthError is still an Error, so a catch that only knows about Errors
    // keeps working — it just shows the identity instead of a sentence.
    it('an AuthError is an Error, carrying its failure', () => {
        const err = new AuthError('blank-username');

        expect(err).toBeInstanceOf(Error);
        expect(err.failure).toBe('blank-username');
    });
});
