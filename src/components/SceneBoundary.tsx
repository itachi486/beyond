import { Component, type ReactNode } from "react";
export class SceneBoundary extends Component<
  { children: ReactNode; message: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="fallback-note" role="status">
        {this.props.message}
      </p>
    ) : (
      this.props.children
    );
  }
}
