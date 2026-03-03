"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "./../lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") ?? "/dashboard/mensal";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) return setError(error.message);

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="mt-1 text-sm text-slate-600">Entra na tua conta.</p>
        </div>
        <div className="card-content">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-700">Email</label>
              <input
                className="input mt-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-slate-700">Password</label>
              <input
                className="input mt-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "A entrar..." : "Entrar"}
            </button>

            <p className="text-center text-sm text-slate-600">
              Não tens conta?{" "}
              <a className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800" href="/register">
                Registar
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md">A carregar...</div>}>
      <LoginForm />
    </Suspense>
  );
}
