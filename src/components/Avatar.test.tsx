import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
    /*
     * Testing strategy
     *   partition on src: absent (the drawn cat) | given (an <img>)
     *   partition on alt: '' (decorative, hidden from the a11y tree) | named
     *   size drives both dimensions
     *   className is additive, never replacing the component's own class
     */

    it('no src: draws the cat', () => {
        const { container } = render(<Avatar />);
        expect(container.querySelector('svg')).not.toBeNull();
        // head + two eyes, plus the one ears-and-brow stroke
        expect(container.querySelectorAll('circle')).toHaveLength(3);
        expect(container.querySelectorAll('path')).toHaveLength(1);
    });

    it('sizes both dimensions', () => {
        const { container } = render(<Avatar size={26} />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '26');
        expect(svg).toHaveAttribute('height', '26');
    });

    // Every current call site sits inside a control that is already labelled, so
    // the default must add no second name for a screen reader to read out.
    it('no alt: hidden from assistive tech', () => {
        const { container } = render(<Avatar />);
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('an alt: becomes a named image instead', () => {
        const { container } = render(<Avatar alt="Your picture" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('role', 'img');
        expect(svg).toHaveAttribute('aria-label', 'Your picture');
        expect(svg).not.toHaveAttribute('aria-hidden');
    });

    // The escape hatch uploads would land in. Nothing sets it today, so this is
    // the only thing keeping it working.
    it('a src: renders an image at the same size', () => {
        const { container } = render(<Avatar src="/me.png" alt="Me" size={40} />);
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('src', '/me.png');
        expect(img).toHaveAttribute('alt', 'Me');
        expect(img).toHaveAttribute('width', '40');
        expect(container.querySelector('svg')).toBeNull();
    });

    it('className is added, not substituted', () => {
        const { container } = render(<Avatar className="extra" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('extra');
        // whatever the CSS-module class hashes to, there is still more than ours.
        // classList, not className: on an SVG the latter is an SVGAnimatedString.
        expect(svg?.classList.length).toBeGreaterThan(1);
    });
});
