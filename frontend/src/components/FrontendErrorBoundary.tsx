import { Component, type ErrorInfo, type ReactNode } from "react";

import { UnexpectedErrorPage } from "./ErrorStatePage";

export class FrontendErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Технические сведения не выводятся в пользовательский интерфейс.
  }

  render() {
    return this.state.hasError ? <UnexpectedErrorPage /> : this.props.children;
  }
}
