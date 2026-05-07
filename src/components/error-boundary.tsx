"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            Something went wrong. Try refreshing the page.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
