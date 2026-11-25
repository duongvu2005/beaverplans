import { useRef, type KeyboardEvent } from 'react';
import type { Project } from '@/core/types';
import { keyAction, rowSequence, type TreeRow } from './treeKeys';

export type TreeKeysApi = {
    /** Ref callback for a row's name input, so the tree can move focus between fields it does not own. */
    register: (id: string, element: HTMLInputElement | null) => void;
    /** Put the caret in a row's name field. The row need not exist yet: a request is applied when its input mounts. */
    focus: (id: string, caret?: 'start' | 'end') => void;
    onKeyDown: (row: TreeRow, event: KeyboardEvent<HTMLInputElement>) => void;
};

type UseTreeKeysOptions = {
    projects: ReadonlyArray<Project>;
    /** afterTaskId null appends to the end of the project's tasks */
    onInsertTask: (projectId: string, afterTaskId: string | null) => void;
    onAddProject: () => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

/** Wire the tree keymap to real inputs. Creating a row does NOT focus it from in here: only the callbacks' owner knows the new id. */
export function useTreeKeys({
    projects,
    onInsertTask,
    onAddProject,
    onRemoveProject,
    onRemoveTask,
}: UseTreeKeysOptions): TreeKeysApi {
    const elements = useRef(new Map<string, HTMLInputElement>());
    // A row that does not exist yet. Creating one is a state update, so its
    // input mounts a render later — register applies the request when it does.
    const pending = useRef<{ id: string; caret: 'start' | 'end' } | null>(null);

    const sequence = rowSequence(projects);

    function place(element: HTMLInputElement, caret: 'start' | 'end') {
        element.focus();
        const at = caret === 'start' ? 0 : element.value.length;
        element.setSelectionRange(at, at);
    }

    function register(id: string, element: HTMLInputElement | null): void {
        if (element === null) {
            elements.current.delete(id);
            return;
        }
        elements.current.set(id, element);
        if (pending.current?.id === id) {
            const { caret } = pending.current;
            pending.current = null;
            place(element, caret);
        }
    }

    function focus(id: string, caret: 'start' | 'end' = 'start'): void {
        const element = elements.current.get(id);
        if (element === undefined) {
            pending.current = { id, caret };
            return;
        }
        place(element, caret);
    }

    function onKeyDown(row: TreeRow, event: KeyboardEvent<HTMLInputElement>): void {
        const element = event.currentTarget;
        const action = keyAction({
            key: event.key,
            // Both, rather than by platform: Ctrl+Enter is unclaimed on a Mac too.
            mod: event.metaKey || event.ctrlKey,
            shift: event.shiftKey,
            atStart: element.selectionStart === 0 && element.selectionEnd === 0,
            atEnd:
                element.selectionStart === element.value.length &&
                element.selectionEnd === element.value.length,
            row,
            sequence,
        });
        if (action === undefined) return;
        event.preventDefault();

        switch (action.kind) {
            case 'blur':
                element.blur();
                return;
            case 'focus':
                focus(action.id, action.caret);
                return;
            case 'insertTask':
                onInsertTask(action.projectId, action.afterTaskId);
                return;
            case 'addProject':
                onAddProject();
                return;
            case 'removeRow':
                // Before the row goes, so focus is never left on a detached
                // element, and a confirm dialog receives it instead.
                element.blur();
                if (action.row.kind === 'project') onRemoveProject(action.row.id);
                else onRemoveTask(action.row.id);
                return;
        }
    }

    return { register, focus, onKeyDown };
}
