import { Component, type PropsWithChildren } from 'react';

type State = Readonly<{ failed: boolean }>;

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <main className="shell" role="alert">
          <h1>Aria needs a quick reset.</h1>
          <p>Ask a grown-up to reload this page.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
