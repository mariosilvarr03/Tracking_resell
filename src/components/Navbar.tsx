import Link from "next/link";
import { supabaseServer } from "./../app/lib/supabase/server";

export async function Navbar() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
          ResellTracker
        </Link>

        <nav className="hidden gap-6 md:flex">
          <Link className="text-sm text-gray-700 hover:text-black" href="/dashboard/mensal">
            Dashboard
          </Link>
          <Link className="text-sm text-gray-700 hover:text-black" href="/inventario">
            Inventário
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