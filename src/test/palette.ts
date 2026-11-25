/// <reference types="node" />
// Reads the two palettes out of index.css and measures them, so a colour
// invariant can be asserted against the file that actually ships rather than
// against a copy of the values kept in a test.
//
// Read off disk rather than imported: vitest does not process CSS, so an
// `?raw` import of a stylesheet comes back as the empty string.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest runs from the repo root.
const css = readFileSync(resolve('src/index.css'), 'utf8');

/** A colour token name without its leading dashes, e.g. `ink-faint`. */
export type Token = string;

/** Token name to `#rrggbb`, lowercased. */
export type Palette = Readonly<Record<Token, string>>;

/** Every `--name: #hex;` declaration inside one brace-delimited block. */
function hexesIn(block: string): Record<Token, string> {
    const out: Record<Token, string> = {};
    for (const m of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
        // Both captures exist whenever the pattern matched.
        out[m[1]!] = m[2]!.toLowerCase();
    }
    return out;
}

/** The text between `selector {` and the next `}` at the top level of the file. */
function blockFor(selector: string): string {
    const start = css.indexOf(selector);
    if (start === -1) throw new Error(`no ${selector} block in index.css`);
    const open = css.indexOf('{', start);
    const close = css.indexOf('\n}', open);
    return css.slice(open, close);
}

/**
 * The light and dark colour palettes as index.css declares them.
 *
 * @returns  `{ light, dark }`. `light` is the `:root` block; `dark` is `:root`
 *           overridden by `:root[data-theme='dark']`, which is how the cascade
 *           resolves it in the browser — so a token the dark block does not
 *           restate keeps its light value in both.
 * @throws   if either block is missing from index.css.
 */
export function palettes(): { readonly light: Palette; readonly dark: Palette } {
    const light = hexesIn(blockFor(':root {'));
    return { light, dark: { ...light, ...hexesIn(blockFor(":root[data-theme='dark'] {")) } };
}

function channels(hex: string): readonly [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance: sRGB channels linearised, then weighted. */
function luminance(hex: string): number {
    const [r, g, b] = channels(hex).map((c) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The WCAG 2.1 contrast ratio between two opaque colours.
 *
 * @param a  a `#rrggbb` colour.
 * @param b  a `#rrggbb` colour.
 * @returns  a ratio in [1, 21], rounded to 2 decimals. Symmetric in its
 *           arguments: which one is the text and which the background does not
 *           change the number.
 */
export function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * A colour's HSL saturation.
 *
 * @param hex  a `#rrggbb` colour.
 * @returns  a percentage in [0, 100], rounded to the nearest whole number. 0 is
 *           grey.
 */
export function saturation(hex: string): number {
    const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    return Math.round(s * 100);
}
