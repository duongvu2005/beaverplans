/**
 * This device's copy of the chosen language. While someone is signed in the
 * account is the source of truth; for a guest this is the only copy.
 *
 * The keys are a persistence contract: renaming one strands every device that
 * already wrote it.
 */

import { prefCache } from '@/prefs/prefCache';
import { isLocale, type Locale } from './locale';

export const localeCache = prefCache<Locale>('locale', isLocale);
