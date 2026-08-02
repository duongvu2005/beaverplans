import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Marks the app shell's root box. Kept in sync with index.css's container rule. */
export const APP_CONTAINER_SELECTOR = '[data-app-container]';

/**
 * The measured inline size of the app's own container, re-rendering when it
 * changes.
 *
 * The JS counterpart to a CSS `@container app` query: for the few layout
 * decisions a stylesheet cannot express — chiefly "how many items should this
 * chart be given", where CSS could only hide the extras and the component needs
 * to not receive them in the first place.
 *
 * Deliberately NOT `window.matchMedia`: the browser viewport is the wrong thing
 * to measure whenever the app is rendered inside a box narrower than the page
 * (an embedded panel, a design tool's phone frame). Those are exactly the cases
 * where the viewport says "desktop" and the app's own box says otherwise.
 *
 * It measures the nearest `[data-app-container]` ancestor — the same box the
 * stylesheets query — so a JS breakpoint and a CSS one written with the same
 * number always agree. With no such ancestor (a component rendered standalone,
 * e.g. in a preview or a test) it measures the attached element itself, which
 * is the closest available stand-in for "the space this component was given".
 *
 * The first measurement is taken in a layout effect, before paint, so the first
 * painted frame already reflects the real width rather than flashing a fallback.
 *
 * @returns a ref to attach to the component's own root, and the container's
 *          width in px — `null` only until that element is attached and measured.
 */
export function useContainerWidth<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number | null>(null);

    useLayoutEffect(() => {
        const node = ref.current;
        if (node === null) return;
        const target = node.closest(APP_CONTAINER_SELECTOR) ?? node;

        setWidth(target.getBoundingClientRect().width);

        // Guard: jsdom and older engines have no ResizeObserver. The measurement
        // above still ran, so the component is correct at its mounted size and
        // simply won't track later resizes.
        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry === undefined) return;
            // contentBoxSize is the resize-loop-safe reading; contentRect is the
            // fallback for engines that only populate the older field.
            const box = entry.contentBoxSize?.[0];
            setWidth(box ? box.inlineSize : entry.contentRect.width);
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    return [ref, width];
}
