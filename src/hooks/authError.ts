/**
 * The failures useAuth raises on its own account, as identities rather than
 * words. Everything else reaching an auth form is an already-written Supabase
 * message.
 *
 * A hook cannot call useCopy, and a message chosen when the session started
 * would be frozen in whichever language was active then — so the naming is the
 * catching form's, done at render in the language on screen.
 */
export type AuthFailure = 'blank-username' | 'no-account';

/** A refusal from useAuth itself, carrying which one rather than its wording. */
export class AuthError extends Error {
    readonly failure: AuthFailure;

    constructor(failure: AuthFailure) {
        // The identity doubles as the message so an unhandled one is legible in
        // a stack trace. Nothing renders it — authErrorText does.
        super(failure);
        this.name = 'AuthError';
        this.failure = failure;
    }
}

/**
 * What to show a person for something an auth call threw.
 *
 * @param err whatever was caught — any value, since a catch binding is unknown
 * @param failures the catalog's `authForm.failures`, which the Record type
 *     holds exhaustive over AuthFailure: a new failure fails the build here
 *     rather than rendering undefined at the one call site that hits it
 * @param fallback what to show when the value carries no message of its own
 * @returns the caller's translation for an AuthError; otherwise the message of
 *     an Error, which for a relayed Supabase failure is its own English;
 *     otherwise `fallback`
 */
export function authErrorText(
    err: unknown,
    failures: Record<AuthFailure, string>,
    fallback: string,
): string {
    if (err instanceof AuthError) return failures[err.failure];
    if (err instanceof Error) return err.message;
    return fallback;
}
