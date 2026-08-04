import { CloudBackend } from './cloudBackend';
import { LocalBackend } from './localBackend';
import { Store } from './store';

export const store = new Store(new LocalBackend(window.localStorage), new CloudBackend());
