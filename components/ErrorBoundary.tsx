import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log to localStorage for debugging in MiniPay
    if (typeof window !== 'undefined') {
      try {
        const errorLog = localStorage.getItem('diversifi-error-log') || '[]';
        const errors = JSON.parse(errorLog);
        errors.push({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('diversifi-error-log', JSON.stringify(errors.slice(-5))); // Keep last 5 errors
      } catch (e) {
        console.error('Failed to log error to localStorage', e);
      }
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <details className="text-sm text-red-700">
            <summary>Error details (click to expand)</summary>
            <p className="mt-2 whitespace-pre-wrap">{this.state.error?.toString()}</p>
            <p className="mt-2 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</p>
          </details>
          <div className="mt-4">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
