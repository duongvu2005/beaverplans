import { useCallback, type RefCallback } from 'react';

/** The custom property the measurement is published as. Read by TopBar's bar. */
export const SCROLLBAR_WIDTH_VAR = '--scrollbar-w';

/**
 * Publishes the width a scrolling element reserves for its scrollbar as
 * `--scrollbar-w` on the document element, keeping it current as that element
 * resizes.
 *
 * The app bar is a SIBLING of the scrolling pane, not a child, so it never
 * loses the scrollbar's width; both cap their content at 1440px and centre it,
 * leaving the bar's block half a scrollbar to the right of the board's. The bar
 * pads its trailing edge by this value, and there is no CSS expression for it.
 *
 * Measures the element itself rather than a probe, so whatever the pane's own
 * `scrollbar-gutter` and scrollbar styling actually reserve is what gets
 * published. Where scrollbars overlay the content that is 0: nothing is
 * reserved, so nothing needs compensating.
 *
 * A ref CALLBACK rather than a ref object, because the pane is not mounted for
 * the whole of the app's life — App returns early while weeks are loading, and
 * an effect keyed on a ref object would run once against nothing.
 *
 * Not deterministic — it reads the DOM and writes to it.
 *
 * @returns a ref callback to put on the scrolling element.
 */
export function usePublishScrollbarWidth(): RefCallback<HTMLElement> {
    return useCallback((node: HTMLElement) => {
        // Written only on a change: this runs from a ResizeObserver callback,
        // where an unconditional style write is the shape a resize loop takes.
        let published: string | null = null;
        function publish() {
            const width = `${node.offsetWidth - node.clientWidth}px`;
            if (width === published) return;
            published = width;
            document.documentElement.style.setProperty(SCROLLBAR_WIDTH_VAR, width);
        }

        publish();

        // jsdom and older engines have no ResizeObserver. The measurement above
        // still ran, so the value is right at the mounted size and does not
        // track later resizes.
        if (typeof ResizeObserver === 'undefined') return () => {};

        const observer = new ResizeObserver(publish);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
}
