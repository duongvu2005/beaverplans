/**
 * Save `text` to the user's downloads as `filename`.
 *
 * There is no browser API for "save this string", so this goes the usual way
 * round: wrap it in a Blob, point an anchor at a temporary object URL, and
 * click it.
 *
 * The URL has to be revoked or the blob stays pinned in memory for the life of
 * the document — but NOT synchronously after the click. Only Chrome reliably
 * takes hold of the blob during the click's own dispatch; revoking that early
 * has historically cancelled the download outright elsewhere. Deferring to a
 * later task costs nothing and takes the browser difference out of it.
 */
export function downloadText(filename: string, text: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
