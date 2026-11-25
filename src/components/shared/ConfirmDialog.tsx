import { useId, useState, type ReactNode } from 'react';
import { useCopy } from '@/i18n/localeContext';
import { Dialog } from './Dialog';
import shell from './dialogShell.module.css';

type DialogTone = 'primary' | 'ghost' | 'danger';

type DialogAction = {
    label: string;
    onAction: () => void;
    tone?: DialogTone;
    disabled?: boolean;
};

type ConfirmDialogProps = {
    title: string;
    eyebrow?: string;
    onClose: () => void;
    children: ReactNode;
    /** Hold every action until this exact text is typed back. The value is shown beside the field. */
    requireTyped?: { readonly value: string };
    /** What the ghost button says. Defaults to Cancel; pass Back where close returns to the screen it was opened from. */
    cancelLabel?: string;
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
    const { common, confirmDialog } = useCopy();
    const { title, eyebrow, onClose, children, requireTyped, cancelLabel } = props;
    const titleId = useId();
    const gateId = useId();
    const [typed, setTyped] = useState('');
    // Case-insensitive: the value is on screen to be copied.
    const held =
        requireTyped !== undefined &&
        typed.trim().toLocaleLowerCase() !== requireTyped.value.trim().toLocaleLowerCase();
    const actions: ReadonlyArray<DialogAction> = props.actions ?? [
        {
            label: props.confirmLabel ?? confirmDialog.confirm,
            onAction: props.onConfirm,
            tone: props.confirmTone,
        },
    ];

    return (
        // A typed gate means something irreversible is being agreed to, and a
        // stray click on the scrim should not throw the typing away.
        <Dialog
            open
            onClose={onClose}
            labelledBy={titleId}
            closeOnScrimClick={requireTyped === undefined}
        >
            <div className={shell.head}>
                {eyebrow && <div className={shell.eyebrow}>{eyebrow}</div>}
                <h3 id={titleId} className={shell.title}>
                    {title}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>{children}</div>
                {requireTyped !== undefined && (
                    <div className={shell.field}>
                        <label className={shell.gateLabel} htmlFor={gateId}>
                            {confirmDialog.typeToConfirmLead}
                            <b>{requireTyped.value}</b>
                            {confirmDialog.typeToConfirmRest}
                        </label>
                        <input
                            id={gateId}
                            type="text"
                            className={shell.input}
                            value={typed}
                            autoComplete="off"
                            onChange={(event) => setTyped(event.target.value)}
                        />
                    </div>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    {cancelLabel ?? common.cancel}
                </button>
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        className={`${shell.btn} ${toneClass(action.tone)}`}
                        disabled={action.disabled === true || held}
                        onClick={action.onAction}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </Dialog>
    );
}
