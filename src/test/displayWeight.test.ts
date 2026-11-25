/// <reference types="node" />
// Holds every heading drawn in --display to the --w-title / --w-row tokens.
//
// The bug this exists to catch is invisible in the look it was written in.
// :root sets --w-title: 600, so a rule that writes `font: 600 ... var(--display)`
// renders identically to one that writes `var(--w-title)` — until Classic swaps
// in Fraunces at 500 and the literal stays behind at 600. Nothing type-checks a
// stylesheet, and the symptom is one look's headings a step heavier than the
// look asked for.

import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The wordmark is a logotype, not a heading: it is 600 in both looks by choice. */
const EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
    'src/components/shell/TopBar.module.css': ['.mark'],
};

type Rule = {
    readonly file: string;
    readonly selector: string;
    /** The weight the rule pins, or undefined where it pins none. */
    readonly weight: string | undefined;
};

/** The leading component of a `font:` shorthand, which is where a weight can hide. */
function shorthandWeight(body: string): string | undefined {
    const decl = /(?:^|[;{])\s*font:\s*([^;]+)/.exec(body)?.[1];
    return decl === undefined ? undefined : /^\s*(\d+|var\(--w-[a-z]+\))/.exec(decl)?.[1];
}

/** Every rule that draws in --display, with whatever weight it pins. */
function displayRules(file: string): readonly Rule[] {
    const css = readFileSync(resolve(file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .map((rule) => ({ selector: (rule[1] ?? '').trim(), body: rule[2] ?? '' }))
        .filter(({ body }) => body.includes('var(--display)'))
        .map(({ selector, body }) => ({
            file,
            selector,
            weight: /font-weight:\s*([^;]+)/.exec(body)?.[1]?.trim() ?? shorthandWeight(body),
        }));
}

describe('display headings', () => {
    const rules = globSync('src/components/**/*.module.css')
        .map((file) => file.replaceAll('\\', '/'))
        .flatMap(displayRules);

    it('finds the rules to check', () => {
        expect(rules.length).toBeGreaterThan(10);
    });

    it('pins no literal weight, so both looks get their own step', () => {
        const literal = rules.filter(
            ({ file, selector, weight }) =>
                weight !== undefined &&
                !weight.startsWith('var(--w-') &&
                !(EXCEPTIONS[file] ?? []).includes(selector),
        );
        expect(literal.map(({ file, selector }) => `${file} ${selector}`)).toEqual([]);
    });
});
