import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
    readonly children: ReactNode;
    /** what to show in place of children once one of them has thrown */
    readonly fallback: (error: Error) => ReactNode;
};

type ErrorBoundaryState = {
    readonly error: Error | null;
};

/**
 * Catches an error thrown while rendering its children and shows `fallback`.
 * Render errors only: event handlers and promises escape to window.onerror.
 * A caught error is sticky; remount the boundary under a new key to clear it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public override state: ErrorBoundaryState = { error: null };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    // React logs a caught error itself only in development, so this is the only
    // trace left in a production console.
    public override componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('beaverplans crashed while rendering', error, info.componentStack);
    }

    public override render(): ReactNode {
        const { error } = this.state;
        return error === null ? this.props.children : this.props.fallback(error);
    }
}
