import { describe, it, expect } from 'vitest';
import { toNFC, normalizeProjects } from './text';
import type { Project } from './types';

// Built with normalize('NFD') rather than written out: a decomposed literal in
// a source file is at the mercy of whatever editor or tool touches it next.
const NFD = (s: string): string => s.normalize('NFD');

describe('toNFC', () => {
    /*
     * Testing strategy:
     *   partition on input: already NFC | decomposed | no marks at all | empty
     *   partition on the mark: base-letter (breve, circumflex, horn) | tone | both stacked
     */

    it('composes a decomposed base-letter mark', () => {
        expect(toNFC(NFD('ă'))).toBe('ă');
        expect(toNFC(NFD('â'))).toBe('â');
        expect(toNFC(NFD('ơ'))).toBe('ơ');
    });

    it('composes a base-letter mark with a tone stacked on it', () => {
        expect(toNFC(NFD('Tuần'))).toBe('Tuần');
        expect([...toNFC(NFD('ắ'))]).toHaveLength(1);
    });

    it('leaves already-composed text alone', () => {
        expect(toNFC('Tuần')).toBe('Tuần');
    });

    it('leaves text with no marks alone', () => {
        expect(toNFC('week one')).toBe('week one');
        expect(toNFC('')).toBe('');
    });
});

describe('normalizeProjects', () => {
    /*
     * Testing strategy:
     *   partition on which field carries the mark: project name | task name |
     *       task description | subtask description
     *   partition on the collection: needs normalizing | already NFC
     */

    const decomposed: ReadonlyArray<Project> = [
        {
            id: 'p0',
            name: NFD('Học kỳ'),
            tasks: [
                {
                    id: 't0',
                    name: NFD('Đọc sách'),
                    description: NFD('chương một'),
                    subtasks: [
                        {
                            id: 's0',
                            isDone: false,
                            assignedDay: 'mon',
                            missedDays: [],
                            weight: 1,
                            description: NFD('trang đầu'),
                        },
                    ],
                },
            ],
        },
    ];

    it('composes every text field it reaches', () => {
        const [project] = normalizeProjects(decomposed);
        const task = project?.tasks[0];
        expect(project?.name).toBe('Học kỳ');
        expect(task?.name).toBe('Đọc sách');
        expect(task?.description).toBe('chương một');
        expect(task?.subtasks[0]?.description).toBe('trang đầu');
    });

    it('leaves the rest of each node untouched', () => {
        const [project] = normalizeProjects(decomposed);
        const subtask = project?.tasks[0]?.subtasks[0];
        expect(project?.id).toBe('p0');
        expect(subtask?.assignedDay).toBe('mon');
        expect(subtask?.weight).toBe(1);
    });

    it('does not mutate its argument', () => {
        normalizeProjects(decomposed);
        expect(decomposed[0]?.name).toBe(NFD('Học kỳ'));
    });

    it('omits a description that was absent rather than adding an empty one', () => {
        const bare: ReadonlyArray<Project> = [
            { id: 'p0', name: 'Week', tasks: [{ id: 't0', name: 'Read', subtasks: [] }] },
        ];
        expect(normalizeProjects(bare)[0]?.tasks[0]).not.toHaveProperty('description');
    });
});
