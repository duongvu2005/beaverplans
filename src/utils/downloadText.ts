/**
 * Save `text` to the user's downloads as `filename`.
 *
 * The object URL must be revoked or the blob stays pinned for the life of the
 * document — but not synchronously. Only Chrome reliably takes hold of the blob
 * during the click's own dispatch; elsewhere an early revoke has cancelled the
 * download outright, so it is deferred to a later task.
 */
export function downloadText(filename: string, text: string, type: string): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
