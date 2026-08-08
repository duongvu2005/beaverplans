import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importLegacyForUser, type LegacyClient, type LegacyStateRow } from './migrateLegacy';
import type { Weeks } from '../core/types';

class FakeLegacyClient implements LegacyClient {
    public row: LegacyStateRow | null = null;
    public selectError: unknown = null;
    public rpcError: unknown = null;
    public selectCalls = 0;
    public rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    /** makes maybeSingle throw, standing in for a client that blows up outright */
    public throwOnSelect = false;

    public from(_table: string) {
        return {
            select: (_columns: string) => ({
                eq: (_column: string, _value: string) => ({
                    maybeSingle: async () => {
                        this.selectCalls += 1;
                        if (this.throwOnSelect) throw new Error('boom');
                        if (this.selectError !== null) {
                            return { data: null, error: this.selectError };
                        }
                        return { data: this.row, error: null };
                    },
                }),
            }),
        };
    }

    public rpc(name: string, args: Record<string, unknown>) {
        this.rpcCalls.push({ name, args });
        return Promise.resolve({ error: this.rpcError });
    }
}

const oneProject = [{ id: 'p1', title: 'Thesis', deadline: null, subs: [] }];

function rowWith(overrides: Partial<LegacyStateRow> = {}): LegacyStateRow {
    return {
        tasks: oneProject,
        archives: [],
        week_start: '2026-08-03',
        migrated_at: null,
        ...overrides,
    };
}

/** the weeks the RPC was handed on the most recent call */
function sentWeeks(client: FakeLegacyClient): Weeks {
    const last = client.rpcCalls.at(-1);
    if (last === undefined) throw new Error('rpc was never called');
    return last.args['weeks'] as Weeks;
}

describe('importLegacyForUser', () => {
    let client: FakeLegacyClient;

    beforeEach(() => {
        client = new FakeLegacyClient();
    });

    // --- nothing to do ---

    it('no legacy row at all: reports false and never calls the rpc', async () => {
        client.row = null;
        expect(await importLegacyForUser(client, 'u1')).toBe(false);
        expect(client.rpcCalls).toEqual([]);
    });

    it('already migrated: reports false and never calls the rpc', async () => {
        client.row = rowWith({ migrated_at: '2026-08-08T00:00:00Z' });
        expect(await importLegacyForUser(client, 'u1')).toBe(false);
        expect(client.rpcCalls).toEqual([]);
    });

    // --- failures, all reported as false so the caller carries on ---

    it('select error: reports false, does not import', async () => {
        client.selectError = { message: 'nope' };
        expect(await importLegacyForUser(client, 'u1')).toBe(false);
        expect(client.rpcCalls).toEqual([]);
    });

    it('rpc error (e.g. lost the claim race): reports false', async () => {
        client.row = rowWith();
        client.rpcError = { message: 'already migrated, or no legacy row' };
        expect(await importLegacyForUser(client, 'u1')).toBe(false);
        expect(client.rpcCalls).toHaveLength(1);
    });

    it('a throwing client is caught, not propagated', async () => {
        client.throwOnSelect = true;
        await expect(importLegacyForUser(client, 'u1')).resolves.toBe(false);
    });

    // --- the import itself ---

    it('imports an unmigrated row and reports true', async () => {
        client.row = rowWith();
        expect(await importLegacyForUser(client, 'u1')).toBe(true);
        expect(client.rpcCalls).toHaveLength(1);
        expect(client.rpcCalls[0]?.name).toBe('migrate_old_planner');
        expect(sentWeeks(client)).toEqual([
            expect.objectContaining({ weekStart: '2026-08-03', ended: false }),
        ]);
    });

    it('carries archives across as ended weeks', async () => {
        client.row = rowWith({
            archives: [{ start: '2026-07-27T00:00:00.000Z', snapshot: oneProject }],
        });
        expect(await importLegacyForUser(client, 'u1')).toBe(true);
        const weeks = sentWeeks(client);
        expect(weeks).toHaveLength(2);
        expect(weeks.find((w) => w.weekStart === '2026-07-27')?.ended).toBe(true);
    });

    it('still calls the rpc for an empty legacy row, so the user gets marked', async () => {
        client.row = rowWith({ tasks: [], archives: [] });
        expect(await importLegacyForUser(client, 'u1')).toBe(true);
        expect(client.rpcCalls).toHaveLength(1);
    });

    it('null tasks/archives are treated as empty rather than throwing', async () => {
        client.row = rowWith({ tasks: null, archives: null });
        await expect(importLegacyForUser(client, 'u1')).resolves.toBe(true);
    });

    // --- the one clock read ---

    describe('null week_start (the old app: "not anchored, use the current week")', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // a Thursday; its Monday is 2026-08-03
            vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('anchors the active week to the current week', async () => {
            client.row = rowWith({ week_start: null });
            expect(await importLegacyForUser(client, 'u1')).toBe(true);
            expect(sentWeeks(client)[0]?.weekStart).toBe('2026-08-03');
        });
    });
});
