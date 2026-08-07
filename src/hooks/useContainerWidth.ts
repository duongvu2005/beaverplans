import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Marks the app shell's root box. Kept in sync with index.css's container rule. */
export const APP_CONTAINER_SELECTOR = '[data-app-container]';

/**
 * The one width at which the app stops being a phone. Kept in sync with
 * Dialog.module.css's `@container app (min-width: 640px)`, which is where the
 * same line is drawn in CSS — below it a Dialog docks to the bottom edge as a
 * sheet, at or above it centers as a modal.
 */
export const DESKTOP_MIN_WIDTH = 640;

function measureAppContainer(): number | null {
    if (typeof document === 'undefined') return null;
    const container = document.querySelector(APP_CONTAINER_SELECTOR);
    return container === null ? null : container.getBoundingClientRect().width;
}

/**
 * Whether the app's own box is wide enough to be a desktop, re-rendering when
 * that changes.
 *
 * For the case a stylesheet genuinely cannot cover: not "style this differently
 * at width X" (a container query does that better), but "render a different
 * component at width X" — where the two form factors want different markup
 * entirely and mounting both to hide one is not free. Reach for `@container` in
 * CSS first; this is the escape hatch when the choice is which component exists.
 *
 * Measures `[data-app-container]` rather than the viewport, for the same reason
 * useContainerWidth does: the app can be rendered inside a box narrower than the
 * page. Needs no ref, because that box is a fixed landmark in the document —
 * which also lets the first value be measured during the first render rather
 * than after it, so nothing renders the wrong form factor even for one frame.
 *
 * @returns true iff the app container is at least DESKTOP_MIN_WIDTH wide.
 *          False where there is nothing to measure (no container, or no DOM at
 *          all), which makes the phone layout the fallback.
 */
export function useIsDesktop(): boolean {
    const [width, setWidth] = useState<number | null>(measureAppContainer);

    useLayoutEffect(() => {
        const container = document.querySelector(APP_CONTAINER_SELECTOR);
        if (container === null) return;

        // No measurement here: the initial state above already took one during
        // render, and observe() delivers a callback with the current size
        // immediately, which covers any change since. Where ResizeObserver is
        // missing (jsdom, older engines) that render-time reading is the only
        // one, so the hook is correct at its mounted size and simply will not
        // track later resizes — the same trade useContainerWidth makes.
        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry === undefined) return;
            const box = entry.contentBoxSize?.[0];
            setWidth(box ? box.inlineSize : entry.contentRect.width);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return width !== null && width >= DESKTOP_MIN_WIDTH;
}

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
