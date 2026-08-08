import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorState from './ErrorState';

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

      return (
        <ErrorState
          title={`${moduleName} Error`}
          message="Something went wrong. Your funds are safe — this is a display issue."
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
