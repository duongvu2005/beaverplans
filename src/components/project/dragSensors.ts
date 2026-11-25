import { TouchSensor } from '@dnd-kit/core';
import type { TouchSensorOptions } from '@dnd-kit/core';
import type { TouchEvent } from 'react';

/** How long a finger holds still before a drag begins, and how far it may drift. */
export const TOUCH_HOLD = { delay: 150, tolerance: 8 };

// Inputs and textareas only: every editable surface in the app is one or the
// other. A contenteditable would need adding here, and nothing would fail.
function isTyping(): boolean {
    const focused = document.activeElement;
    return focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
}

/** TouchSensor, except it declines to start a drag while a text field has focus. */
export class QuietWhileTypingTouchSensor extends TouchSensor {
    static activators = TouchSensor.activators.map((activator) => ({
        ...activator,
        handler: (event: TouchEvent, options: TouchSensorOptions): boolean =>
            !isTyping() && activator.handler(event, options),
    }));
}
