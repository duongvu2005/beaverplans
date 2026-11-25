import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Marks the app shell's root box. Kept in sync with index.css's container rule. */
export const APP_CONTAINER_SELECTOR = '[data-app-container]';

/**
 * The first width at which the app stops being a phone. Kept in sync with the
 * app's one form-factor line, `@container app (max-width: 680px)` and its
 * `min-width: 681px` counterpart, which every stylesheet switching between the
 * two shapes uses.
 */
export const DESKTOP_MIN_WIDTH = 681;

/**
 * The first width at which the plan board is two panes side by side. Kept in
 * sync with `@container app (min-width: 1000px)` in App.css, where
 * `.plan-layout` grows its second column. A separate question from
 * DESKTOP_MIN_WIDTH: that one is the form factor, this one is only whether
 * there is room for both panes at once.
 */
export const TWO_PANE_MIN_WIDTH = 1000;

function measureAppContainer(): number | null {
    if (typeof document === 'undefined') return null;
    const container = document.querySelector(APP_CONTAINER_SELECTOR);
    return container === null ? null : container.getBoundingClientRect().width;
}

/**
 * Whether the app's own box is wide enough to be a desktop, re-rendering when
 * that changes. For choosing WHICH component exists at a width; reach for
 * `@container` in CSS where it is only a matter of styling.
 *
 * Measures `[data-app-container]` rather than the viewport: the app can be
 * rendered inside a box narrower than the page. Needs no ref, because that box
 * is a fixed landmark in the document, so the first value is measured during
 * the first render rather than after it.
 *
 * @returns true iff the app container is at least DESKTOP_MIN_WIDTH wide.
 *          False where there is nothing to measure (no container, or no DOM at
 *          all), which makes the phone layout the fallback.
 */
export function useIsDesktop(): boolean {
    return useAppWidthAtLeast(DESKTOP_MIN_WIDTH);
}

/**
 * Whether the app's own box is at least `min` wide.
 *
 * @param min  any width in px. Callers pass a constant shared with the
 *     stylesheet asking the same question, so the two switch together.
 * @returns true iff the container measures at least `min`; false when there is
 *     nothing to measure, so the NARROW branch is what an unmeasurable
 *     container falls back to.
 */
export function useAppWidthAtLeast(min: number): boolean {
    const width = useAppWidth();
    return width !== null && width >= min;
}

/**
 * Whether the app's own box is narrower than `max`.
 *
 * The mirror of `useAppWidthAtLeast`, and it exists for the fallback rather than
 * for the comparison: both answer false with nothing to measure, so which one a
 * caller picks decides which branch an unmeasurable container gets. This one
 * takes a positive measurement to enter the narrow branch.
 *
 * A width of 0 is read as no answer rather than as the narrowest possible one:
 * it means detached, display:none, or an environment that does not lay out at
 * all (jsdom reports every element that way).
 *
 * @param max  any width in px, shared with the stylesheet asking the same thing.
 * @returns true iff the container measures strictly between 0 and `max`.
 */
export function useAppWidthUnder(max: number): boolean {
    const width = useAppWidth();
    return width !== null && width > 0 && width < max;
}

/**
 * The app container's measured width, re-rendering when it changes, or null
 * where there is nothing to measure at all.
 */
function useAppWidth(): number | null {
    const [width, setWidth] = useState<number | null>(measureAppContainer);

    useLayoutEffect(() => {
        const container = document.querySelector(APP_CONTAINER_SELECTOR);
        if (container === null) return;

        // No measurement here: the initial state above already took one during
        // render, and observe() delivers the current size immediately. Where
        // ResizeObserver is missing (jsdom, older engines) that render-time
        // reading is the only one, so the hook is correct at its mounted size
        // and does not track later resizes.
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

    return width;
}

/**
 * The measured inline size of the app's own container, re-rendering when it
 * changes.
 *
 * The JS counterpart to a CSS `@container app` query, for the layout decisions
 * a stylesheet cannot express — chiefly how many items a chart should be given,
 * where CSS could only hide the extras.
 *
 * Measures the nearest `[data-app-container]` ancestor rather than the viewport
 * — the same box the stylesheets query, so a JS breakpoint and a CSS one
 * written with the same number always agree, including where the app is
 * rendered inside a box narrower than the page. With no such ancestor (a
 * component rendered standalone, in a preview or a test) it measures the
 * attached element itself.
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

        // jsdom and older engines have no ResizeObserver. The measurement above
        // still ran, so the component is correct at its mounted size and does
        // not track later resizes.
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
