import { CloudBackend, type RemoteWatcher } from './cloudBackend';
import { LocalBackend } from './localBackend';
import { Store } from './store';
import { supabase } from './supabaseClient';

/**
 * The one place the app binds to Supabase Realtime. RLS already scopes the
 * feed to the signed-in user; the filter narrows it again so the socket does
 * not carry rows this client would only discard.
 */
const watchPlannerWeeks: RemoteWatcher = (userId, onChange) => {
    const channel = supabase
        .channel(`planner_weeks:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'planner_weeks',
                filter: `user_id=eq.${userId}`,
            },
            () => {
                onChange();
            },
        )
        .subscribe();
    return () => {
        void supabase.removeChannel(channel);
    };
};

export const cloudBackend = new CloudBackend(supabase, window.localStorage, watchPlannerWeeks);

export const store = new Store(new LocalBackend(window.localStorage), cloudBackend);
