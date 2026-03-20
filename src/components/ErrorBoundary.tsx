import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 p-10 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Display Glitch Detected</h2>
          <p className="mb-6 max-w-md">The 3D renderer encountered a momentary data error. The system is still running in the background.</p>
          <button
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry Display
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
