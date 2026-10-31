import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Last-resort guard: a render crash should not leave a blank screen on a
 * phone that is being used as a keyboard. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AirType render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fatal-error" role="alert">
        <h1>Terjadi kesalahan</h1>
        <p>Aplikasi berhenti karena error tak terduga. Muat ulang untuk mencoba lagi.</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    )
  }
}
