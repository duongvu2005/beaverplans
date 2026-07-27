import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';

type DialogTone = 'primary' | 'ghost' | 'danger';

type DialogAction = {
    label: string;
    onAction: () => void;
    tone?: DialogTone;
};

type ConfirmDialogProps = {
    title: string;
    eyebrow?: string;
    onClose: () => void;
    children: ReactNode;
} & (
    | {
          actions: ReadonlyArray<DialogAction>;
          confirmLabel?: undefined;
          confirmTone?: undefined;
          onConfirm?: undefined;
      }
    | {
          actions?: undefined;
          confirmLabel?: string;
          confirmTone?: DialogTone;
          onConfirm: () => void;
      }
);

function toneClass(tone: DialogTone | undefined) {
    if (tone === 'ghost') return shell.ghost;
    if (tone === 'danger') return shell.danger;
    return shell.primary;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
    const { title, eyebrow, onClose, children } = props;
    const titleId = 'confirm-title';
    const actions: ReadonlyArray<DialogAction> = props.actions ?? [
        {
            label: props.confirmLabel ?? 'Confirm',
            onAction: props.onConfirm,
            tone: props.confirmTone,
        },
    ];

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
                        className={`${shell.btn} ${toneClass(action.tone)}`}
                        onClick={action.onAction}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </Dialog>
    );
}
