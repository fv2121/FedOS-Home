import { MemoryDigestConsole } from "@/features/memory-digest/components/memory-digest-console";
import { ErrorBoundary } from "@/components/error-boundary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Memory Digest — FedOS Admin",
};

export default function MemoryDigestPage() {
  return (
    <ErrorBoundary>
      <MemoryDigestConsole />
    </ErrorBoundary>
  );
}
