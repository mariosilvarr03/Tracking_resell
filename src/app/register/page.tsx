"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "./../lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) return setError(error.message);

    // Se desligares "Confirm email" no Supabase, isto entra logo.
    router.push("/dashboard/mensal");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-semibold">Criar conta</h1>
          <p className="mt-1 text-sm text-gray-600">Regista-te para começar.</p>
        </div>
        <div className="card-content">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-700">Email</label>
              <input
                className="input mt-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-700">Password</label>
              <input
                className="input mt-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="mt-2 text-xs text-gray-500">Mínimo 6 caracteres.</p>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "A criar..." : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}