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

        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}