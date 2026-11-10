import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error:", error?.message || error);
    console.error("ErrorBoundary componentStack:\n" + (errorInfo?.componentStack || ''));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 20px 20px 20px', backgroundColor: '#18181b', color: '#f87171', minHeight: '100vh', fontFamily: 'monospace', zIndex: 99999 }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong.</h2>
          <div style={{ margin: '12px 0', fontSize: '13px', color: '#fca5a5' }}>
            {this.state.error && this.state.error.toString()}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#9ca3af', background: '#09090b', padding: '12px', borderRadius: '8px' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
