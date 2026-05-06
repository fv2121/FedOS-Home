import { LoginForm } from "@/components/login-form";

type SearchParamMap = Record<string, string | string[] | undefined>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamMap>;
}) {
  const params = (await searchParams) ?? {};
  const nextRaw = params.next;
  const nextPath = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#f7e8c8_0%,#f1f5f9_45%,#e8f0ff_100%)] px-6 py-10">
      <LoginForm nextPath={nextPath || "/"} />
    </main>
  );
}
