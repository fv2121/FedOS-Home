import { DebugConsole } from "@/features/debug-console/components/debug-console";
import { ErrorBoundary } from "@/components/error-boundary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Debug Console — FedOS Admin",
};

export default function DebugPage() {
  return (
    <ErrorBoundary>
      <DebugConsole />
    </ErrorBoundary>
  );
}
