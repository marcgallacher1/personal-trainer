import { resetAppCache } from './BootScreen'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full flex-col justify-center gap-4 px-safe pt-safe pb-safe text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted">
          Your logged sets are stored on this device and are safe. Reloading usually fixes this.
        </p>
        <pre className="max-h-40 overflow-auto rounded-lg bg-surface p-3 text-left text-xs text-muted">
          {this.state.error.message}
        </pre>
        <button
          className="h-14 rounded-xl bg-accent text-lg font-semibold text-accent-fg"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
        <button
          className="h-12 rounded-xl bg-surface font-semibold"
          onClick={() => void resetAppCache()}
        >
          Reset app (keeps your workouts)
        </button>
      </div>
    )
  }
}
