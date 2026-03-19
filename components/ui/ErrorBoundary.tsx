import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Custom module name for localized error messages */
  moduleName?: string;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Callback when error occurs (for analytics/logging) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
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

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to localStorage for debugging in MiniPay
    if (typeof window !== 'undefined') {
      try {
        const errorLog = localStorage.getItem('diversifi-error-log') || '[]';
        const errors = JSON.parse(errorLog);
        errors.push({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          module: this.props.moduleName || 'unknown',
        });
        localStorage.setItem('diversifi-error-log', JSON.stringify(errors.slice(-5))); // Keep last 5 errors
      } catch (e) {
        console.error('Failed to log error to localStorage', e);
      }
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const moduleName = this.props.moduleName || 'This component';
      
      // You can render any custom fallback UI
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-800 dark:text-red-200 mb-1">
                {moduleName} Error
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                Something went wrong. Your funds are safe — this is a display issue.
              </p>
              <details className="text-xs text-red-600 dark:text-red-400 mb-3">
                <summary className="cursor-pointer font-medium">Technical details</summary>
                <p className="mt-2 whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded">
                  {this.state.error?.toString()}
                </p>
              </details>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                  onClick={this.handleRetry}
                >
                  Try Again
                </button>
                <button
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-semibold"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
