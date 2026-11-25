/**
 * Bounds how long a promise is waited on, resolving with a fallback rather than
 * hanging when it overruns.
 *
 * The work is not cancelled — nothing here can cancel a request in flight — so
 * a late promise still settles and its effects still land. The caller is the
 * one that stops waiting.
 *
 * @param promise the work to bound.
 * @param ms how long to wait before giving up, > 0.
 * @param fallback what to resolve with when the deadline wins.
 * @returns what `promise` settled with if it beat the deadline, otherwise
 *          `fallback`. Not deterministic: it reads the clock.
 * @throws whatever `promise` rejected with, but only when that rejection beat
 *         the deadline. A late rejection is swallowed — by then the caller has
 *         its fallback and there is nobody left to hand an error to.
 */
export function withDeadline<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            settled = true;
            resolve(fallback);
        }, ms);

        let settled = false;
        promise.then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}
