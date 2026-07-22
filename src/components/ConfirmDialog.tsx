import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';

type ConfirmDialogProps = {
    title: string;
    eyebrow?: string;
    label?: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
    children: ReactNode;
};

export function ConfirmDialog({
    title,
    eyebrow,
    label,
    confirmLabel = 'Confirm',
    onConfirm,
    onClose,
    children,
}: ConfirmDialogProps) {
    const titleId = 'confirm-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                {eyebrow && <div className={shell.eyebrow}>{eyebrow}</div>}
                <h3 id={titleId} className={shell.title}>
                    {title}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    {label && <div className={shell.label}>{label}</div>}
                    {children}
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </button>
            </div>
        </Dialog>
    );
}
