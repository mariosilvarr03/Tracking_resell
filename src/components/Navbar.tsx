import Link from "next/link";
import { supabaseServer } from "./../app/lib/supabase/server";

export async function Navbar() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header className="border-b border-blue-100 bg-gradient-to-r from-white to-blue-50/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold text-slate-900 transition-colors hover:text-blue-700">
          ResellTracker
        </Link>

        <nav className="hidden gap-6 md:flex">
          <Link className="text-sm text-slate-700 transition-colors hover:text-blue-700" href="/dashboard/mensal">
            Dashboard Mensal
          </Link>
          <Link className="text-sm text-slate-700 transition-colors hover:text-blue-700" href="/dashboard/anual">
            Dashboard Anual
          </Link>
          <Link className="text-sm text-slate-700 transition-colors hover:text-blue-700" href="/dashboard/global">
            Dashboard Global
          </Link>
          <Link className="text-sm text-slate-700 transition-colors hover:text-blue-700" href="/inventario">
            Inventário
          </Link>
          <Link className="text-sm text-slate-700 transition-colors hover:text-blue-700" href="/vendas">
            Vendas
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <form action="/auth/logout" method="post">
              <button className="btn btn-ghost" type="submit">
                Sair
              </button>
            </form>
          ) : (
            <Link className="btn btn-ghost" href="/login">
              Login
            </Link>
          )}
        </div>

        <details className="relative md:hidden">
          <summary className="btn btn-ghost list-none cursor-pointer px-3 py-2">Menu</summary>
          <div className="absolute right-0 z-20 mt-2 min-w-56 rounded-xl border border-blue-100 bg-white p-2 shadow-lg">
            <nav className="grid gap-1">
              <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/dashboard/mensal">
                Dashboard Mensal
              </Link>
              <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/dashboard/anual">
                Dashboard Anual
              </Link>
              <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/dashboard/global">
                Dashboard Global
              </Link>
              <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/inventario">
                Inventário
              </Link>
              <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/vendas">
                Vendas
              </Link>
              {user ? (
                <form action="/auth/logout" method="post" className="pt-1">
                  <button className="w-full rounded-lg border border-blue-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" type="submit">
                    Sair
                  </button>
                </form>
              ) : (
                <Link className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="/login">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
