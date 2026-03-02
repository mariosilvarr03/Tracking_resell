import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RelatedItem = {
  title: string;
  type: string;
  buy_price: number;
};

function pickRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function PATCH(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const saleId = body?.id as string | undefined;
  const soldQuantity = Number(body?.sold_quantity);
  const soldPriceUnit = Number(body?.sold_price_unit);
  const fees = Number(body?.fees ?? 0);
  const soldAt = body?.sold_at as string | undefined;
  const platformName = String(body?.platform ?? "").trim().toLowerCase();

  if (!saleId) {
    return NextResponse.json({ error: "ID da venda em falta" }, { status: 400 });
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
    .select("id, user_id, item_id, sold_quantity")
    .eq("id", saleId)
    .single();

  if (existingSaleError || !existingSale) {
    return NextResponse.json({ error: existingSaleError?.message || "Venda não encontrada" }, { status: 404 });
  }

  if (existingSale.user_id !== user.id) {
    return NextResponse.json({ error: "Não tens acesso a esta venda" }, { status: 403 });
  }

  const { data: existingItem, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, quantity, sold_quantity_total")
    .eq("id", existingSale.item_id)
    .single();

  if (itemError || !existingItem) {
    return NextResponse.json({ error: itemError?.message || "Item da venda não encontrado" }, { status: 404 });
  }

  if (existingItem.user_id !== user.id) {
    return NextResponse.json({ error: "Não tens acesso ao item desta venda" }, { status: 403 });
  }

  const stockDisponivelParaEdicao =
    Number(existingItem.quantity) - Number(existingItem.sold_quantity_total) + Number(existingSale.sold_quantity);

  if (soldQuantity > stockDisponivelParaEdicao) {
    return NextResponse.json(
      { error: "Quantidade excede o stock disponível para esta edição" },
      { status: 400 }
    );
  }

  const { data: platformRow, error: platformError } = await supabase
    .from("platforms")
    .upsert({ name: platformName }, { onConflict: "name" })
    .select("id")
    .single();

  if (platformError || !platformRow) {
    return NextResponse.json({ error: platformError?.message || "Erro na plataforma" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("sales")
    .update({
      sold_quantity: soldQuantity,
      sold_price: soldPriceUnit,
      fees,
      sold_at: soldAt,
      platform_id: platformRow.id,
    })
    .eq("id", saleId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Erro ao atualizar venda" }, { status: 400 });
  }

  const { data: saleView, error: saleViewError } = await supabase
    .from("sales")
    .select("id, sold_at, sold_quantity, sold_price, fees, platform_id, item:items(title, type, buy_price)")
    .eq("id", saleId)
    .single();

  if (saleViewError || !saleView) {
    return NextResponse.json({ error: saleViewError?.message || "Venda atualizada mas não foi possível carregar os dados" }, { status: 400 });
  }

  const saleItem = pickRelated(saleView.item as RelatedItem | RelatedItem[] | null | undefined);
  let salePlatformName: string | null = null;

  if (saleView.platform_id) {
    const { data: platformData } = await supabase
      .from("platforms")
      .select("name")
      .eq("id", saleView.platform_id)
      .single();

    salePlatformName = platformData?.name ?? null;
  }

  return NextResponse.json({
    sale: {
      id: saleView.id,
      title: saleItem?.title ?? "-",
      type: saleItem?.type ?? "SEM_CATEGORIA",
      platform: salePlatformName,
      sold_at: saleView.sold_at,
      sold_quantity: Number(saleView.sold_quantity ?? 0),
      sold_price: Number(saleView.sold_price ?? 0),
      fees: Number(saleView.fees ?? 0),
      buy_unit_cost: Number(saleItem?.buy_price ?? 0),
    },
  });
}
