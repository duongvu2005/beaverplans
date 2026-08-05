import { CloudBackend } from './cloudBackend';
import { LocalBackend } from './localBackend';
import { Store } from './store';
import { supabase } from './supabaseClient';

export const cloudBackend = new CloudBackend(supabase, window.localStorage);

export const store = new Store(new LocalBackend(window.localStorage), cloudBackend);
