import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';

type DialogAction = {
    label: string;
    onAction: () => void;
    tone?: 'primary' | 'ghost';
};

type ConfirmDialogProps = {
    title: string;
    eyebrow?: string;
    onClose: () => void;
    children: ReactNode;
} & (
    | { actions: ReadonlyArray<DialogAction>; confirmLabel?: undefined; onConfirm?: undefined }
    | { actions?: undefined; confirmLabel?: string; onConfirm: () => void }
);

export function ConfirmDialog(props: ConfirmDialogProps) {
    const { title, eyebrow, onClose, children } = props;
    const titleId = 'confirm-title';
    const actions: ReadonlyArray<DialogAction> =
        props.actions ?? [{ label: props.confirmLabel ?? 'Confirm', onAction: props.onConfirm }];

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                {eyebrow && <div className={shell.eyebrow}>{eyebrow}</div>}
                <h3 id={titleId} className={shell.title}>
                    {title}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>{children}</div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        className={`${shell.btn} ${action.tone === 'ghost' ? shell.ghost : shell.primary}`}
                        onClick={action.onAction}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </Dialog>
    );
}
