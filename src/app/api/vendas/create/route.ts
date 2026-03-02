import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();

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

  const itemId = body?.item_id as string | undefined;
  const soldQuantity = Number(body?.sold_quantity);
  const soldPriceUnit = Number(body?.sold_price_unit);
  const fees = Number(body?.fees ?? 0);
  const soldAt = body?.sold_at as string | undefined;
  const platformName = String(body?.platform ?? "").trim().toLowerCase();

  if (!itemId) {
    return NextResponse.json({ error: "Item inválido" }, { status: 400 });
  }

  if (!Number.isFinite(soldQuantity) || soldQuantity < 1) {
    return NextResponse.json({ error: "Quantidade vendida inválida" }, { status: 400 });
  }

  if (!Number.isFinite(soldPriceUnit) || soldPriceUnit < 0) {
    return NextResponse.json({ error: "Preço unitário de venda inválido" }, { status: 400 });
  }

  if (!Number.isFinite(fees) || fees < 0) {
    return NextResponse.json({ error: "Frete inválido" }, { status: 400 });
  }

  if (!soldAt) {
    return NextResponse.json({ error: "Data da venda é obrigatória" }, { status: 400 });
  }

  if (!platformName) {
    return NextResponse.json({ error: "Plataforma é obrigatória" }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, quantity, sold_quantity_total")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  if (item.user_id !== user.id) {
    return NextResponse.json({ error: "Não tens acesso a este item" }, { status: 403 });
  }

  const stockAvailable = item.quantity - item.sold_quantity_total;
  if (soldQuantity > stockAvailable) {
    return NextResponse.json({ error: "Quantidade excede o stock disponível" }, { status: 400 });
  }

  const { data: platform, error: platformError } = await supabase
    .from("platforms")
    .upsert({ name: platformName }, { onConflict: "name" })
    .select("id")
    .single();

  if (platformError || !platform) {
    return NextResponse.json({ error: platformError?.message || "Erro na plataforma" }, { status: 400 });
  }

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      user_id: user.id,
      item_id: itemId,
      sold_quantity: soldQuantity,
      platform_id: platform.id,
      sold_at: soldAt,
      sold_price: soldPriceUnit,
      fees,
    })
    .select("id")
    .single();

  if (saleError || !sale) {
    return NextResponse.json({ error: saleError?.message || "Erro ao registar venda" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, saleId: sale.id });
}
