import type { Archive, WeekPlan } from "../core/types";
import type { Backend } from "./backend";

export class CloudBackend implements Backend {
    /**
     * @inheritdoc
     */
    public async load(): Promise<void> {
        throw new Error('unimplemented');
    }

    public getWeekPlan(): WeekPlan {
        throw new Error('unimplemented');
    }

    public getArchive(): Archive {
        throw new Error('unimplemented');
    }

    public setWeekPlan(_plan: WeekPlan): void {
        throw new Error('unimplemented');
    }

    public setArchive(_archive: Archive): void {
        throw new Error('unimplemented');
    }

    public reset(): void {
        throw new Error('unimplemented');
    }
}
