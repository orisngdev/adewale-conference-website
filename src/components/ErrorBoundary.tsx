"use client";

import { cn } from "../lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle size={28} className="text-destructive" />
            </div>

            <h2 className="font-bebas text-3xl leading-tight text-foreground">
              Something went wrong
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              We hit an unexpected error loading this page. It&apos;s usually temporary —
              reloading often clears it. If it keeps happening, let us know at{" "}
              <a
                href="mailto:adewaleconference@gmail.com"
                className="text-primary hover:underline"
              >
                adewaleconference@gmail.com
              </a>
              .
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold",
                  "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer",
                )}
              >
                <RotateCcw size={16} />
                Reload page
              </button>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2.5 text-sm font-medium border border-foreground/15 hover:bg-foreground/5"
              >
                Go to homepage
              </a>
            </div>

            {/* Raw detail is tucked away — useful for a bug report, not shoved in
                the user's face. */}
            {this.state.error?.message ? (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer select-none text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-xs whitespace-break-spaces text-muted-foreground">
                  {this.state.error.message}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
