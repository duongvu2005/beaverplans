/**
 * This device's copy of the chosen type look. While someone is signed in the
 * account is the source of truth; for a guest this is the only copy. It has to
 * be known before first paint, because the preload links are built at build time.
 */

import { prefCache } from '@/prefs/prefCache';
import { isFontPref, type FontPref } from './font';

export const fontCache = prefCache<FontPref>('font', isFontPref);
