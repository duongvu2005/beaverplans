// Type declarations for @dragdroptouch/drag-drop-touch, which ships bundled
// JavaScript with no types of its own. Only the entry point we call is declared.
declare module '@dragdroptouch/drag-drop-touch' {
    export type DragDropTouchOptions = {
        /** Let a drag near the viewport edge scroll the page. Default true. */
        allowDragScroll: boolean;
        /** Delay before the context menu is allowed through, ms. Default 900. */
        contextMenuDelayMS: number;
        /** Opacity of the floating drag image, 0 to 1. Default 0.5. */
        dragImageOpacity: number;
        /** How near the edge, as a percentage, before scrolling. Default 10. */
        dragScrollPercentage: number;
        /** Pixels scrolled per step while edge-scrolling. Default 10. */
        dragScrollSpeed: number;
        /** Movement before a touch counts as a drag, px. Default 5. */
        dragThresholdPixels: number;
        /** Attach even when the device reports no touch support. Default false. */
        forceListen: boolean;
        /** Require a press and hold to start a drag. Default false. */
        isPressHoldMode: boolean;
        /** Hold time before a press-hold drag begins, ms. Default 400. */
        pressHoldDelayMS: number;
        /** Movement tolerated during the hold before it cancels, px. Default 25. */
        pressHoldMargin: number;
        /** Movement before a press-hold drag starts moving, px. Default 0. */
        pressHoldThresholdPixels: number;
    };

    /**
     * Listen for touch events under dragRoot and translate them into the native
     * HTML5 drag events that dropRoot's existing listeners already handle.
     */
    export function enableDragDropTouch(
        dragRoot?: Document | HTMLElement,
        dropRoot?: Document | HTMLElement,
        options?: Partial<DragDropTouchOptions>,
    ): void;
}
