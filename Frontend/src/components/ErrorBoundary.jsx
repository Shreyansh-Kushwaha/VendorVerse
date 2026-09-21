import { Component } from 'react';

// Has to be a class — there is no hook equivalent of componentDidCatch.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Somewhere to hook up Sentry later. Until then at least it is in the console.
    console.error('[ui] render failed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="card p-8 max-w-md text-center">
          <h1 className="font-display text-2xl text-ink dark:text-gray-100">Something broke on this page</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            That is our fault, not yours. Reloading usually sorts it out.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button className="btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn-ghost" href="/">Go home</a>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-5 text-left text-[11px] text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
