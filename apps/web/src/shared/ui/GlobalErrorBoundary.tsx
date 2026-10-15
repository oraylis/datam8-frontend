import React from "react";
import { publishAppError } from "./appErrorBridge";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    publishAppError("Unexpected error", error.message || "An unexpected rendering error occurred.");
    console.error("[DataM8] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">Something went wrong</p>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
          <button
            className="rounded border px-4 py-2 text-sm"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
