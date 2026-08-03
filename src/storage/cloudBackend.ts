import type { Weeks } from '../core/types';
import type { Backend } from './backend';

export class CloudBackend implements Backend {
    /**
     * @inheritdoc
     */
    public async load(): Promise<void> {
        throw new Error('unimplemented');
    }

    public getWeeks(): Weeks {
        throw new Error('unimplemented');
    }

    public setWeeks(_weeks: Weeks): void {
        throw new Error('unimplemented');
    }

    public reset(): void {
        throw new Error('unimplemented');
    }
}
