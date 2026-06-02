import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/sentry";

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
    // Forward to Sentry (no-op when DSN isn't configured) so production
    // crashes are captured even though the user only sees the fallback UI.
    reportError(error, { componentStack: info.componentStack });
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
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-[hsl(0_0%_4%)]">
        <div className="max-w-md w-full rounded-2xl p-6 text-center space-y-4 bg-[hsl(0_0%_8%)] border border-[hsl(0_72%_50%/0.3)]">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-[hsl(0_0%_90%)]">حصل خطأ غير متوقع</h1>
          <p className="text-sm text-[hsl(0_0%_55%)]">
            حاول إعادة تحميل الصفحة. لو استمرت المشكلة، تواصل مع المسؤول.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-[hsl(0_0%_5%)] bg-gradient-to-br from-[hsl(40_65%_52%)] to-[hsl(40_65%_40%)]"
          >
            إعادة التحميل
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
