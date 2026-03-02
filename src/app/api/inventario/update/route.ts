import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const itemId = body?.id as string | undefined;

  if (!itemId) {
    return NextResponse.json({ error: "ID do item em falta" }, { status: 400 });
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

  const quantity = Number(body.quantity);
  const buyPrice = Number(body.buy_price);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
  }

  if (!Number.isFinite(buyPrice) || buyPrice < 0) {
    return NextResponse.json({ error: "Preço de compra inválido" }, { status: 400 });
  }

  const { data: existingItem, error: existingError } = await supabase
    .from("items")
    .select("id, sold_quantity_total")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .single();

  if (existingError || !existingItem) {
    return NextResponse.json({ error: existingError?.message || "Item não encontrado" }, { status: 404 });
  }

  if (quantity < existingItem.sold_quantity_total) {
    return NextResponse.json(
      { error: "Quantidade não pode ser menor que a quantidade já vendida" },
      { status: 400 }
    );
  }

  const { data: updatedItem, error: updateError } = await supabase
    .from("items")
    .update({
      title: body.title,
      buy_price: buyPrice,
      buy_date: body.buy_date,
      quantity,
    })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id, title, type, quantity, sold_quantity_total, buy_price, buy_date")
    .single();

  if (updateError || !updatedItem) {
    return NextResponse.json({ error: updateError?.message || "Erro ao atualizar item" }, { status: 400 });
  }

  return NextResponse.json({ item: updatedItem });
}
