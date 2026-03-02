import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const saleId = url.searchParams.get("id");

  if (!saleId) {
    return NextResponse.json({ error: "ID da venda em falta" }, { status: 400 });
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
    error: userError,
  } = await anonClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: existingSale, error: existingSaleError } = await supabase
    .from("sales")
    .select("id, user_id")
    .eq("id", saleId)
    .single();

  if (existingSaleError || !existingSale) {
    return NextResponse.json({ error: existingSaleError?.message || "Venda não encontrada" }, { status: 404 });
  }

  if (existingSale.user_id !== user.id) {
    return NextResponse.json({ error: "Não tens acesso a esta venda" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("sales")
    .delete()
    .eq("id", saleId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || "Erro ao apagar venda" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
