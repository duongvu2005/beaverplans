import { describe, it, expect, afterEach } from 'vitest';
import type { TouchEvent } from 'react';
import type { TouchSensorOptions } from '@dnd-kit/core';
import { TOUCH_HOLD, QuietWhileTypingTouchSensor } from './dragSensors';

// The shape the activator reads: one touch, and an onActivation it may call.
function touchStart(): TouchEvent {
    return { nativeEvent: { touches: [{}] } } as unknown as TouchEvent;
}
const options = { onActivation: undefined } as unknown as TouchSensorOptions;

function activate(): boolean {
    return QuietWhileTypingTouchSensor.activators.every((activator) =>
        activator.handler(touchStart(), options),
    );
}

function focus(tag: 'input' | 'textarea' | 'button'): HTMLElement {
    const element = document.createElement(tag);
    document.body.append(element);
    element.focus();
    return element;
}

afterEach(() => {
    document.body.replaceChildren();
});

describe('QuietWhileTypingTouchSensor', () => {
    /*
     * Testing strategy:
     *   partition on the focused element: nothing | input | textarea |
     *       a focusable element that is neither
     *
     * The delegation itself is not partitioned: what the wrapped handler decides
     * about multi-touch is dnd-kit's business, and asserting it here would pin
     * their internals rather than ours.
     */

    it('activates when nothing is focused', () => {
        expect(activate()).toBe(true);
    });

    it('activates when the focused element is not a text field', () => {
        focus('button');
        expect(activate()).toBe(true);
    });

    it('refuses while an input is focused', () => {
        focus('input');
        expect(activate()).toBe(false);
    });

    it('refuses while a textarea is focused', () => {
        focus('textarea');
        expect(activate()).toBe(false);
    });

    it('activates again once the field is blurred', () => {
        const field = focus('input');
        expect(activate()).toBe(false);
        field.blur();
        expect(activate()).toBe(true);
    });
});

describe('TOUCH_HOLD', () => {
    it('is the one constraint both drag surfaces share', () => {
        expect(TOUCH_HOLD).toEqual({ delay: 150, tolerance: 8 });
    });
});
