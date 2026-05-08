import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "hsl(0 0% 4%)" }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-6 text-center space-y-4"
          style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 72% 50% / 0.3)" }}
        >
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold" style={{ color: "hsl(0 0% 90%)" }}>
            حصل خطأ غير متوقع
          </h1>
          <p className="text-sm" style={{ color: "hsl(0 0% 55%)" }}>
            حاول إعادة تحميل الصفحة. لو استمرت المشكلة، تواصل مع المسؤول.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 40%))",
              color: "hsl(0 0% 5%)",
            }}
          >
            إعادة التحميل
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
