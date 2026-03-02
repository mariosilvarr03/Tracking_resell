import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const body = await request.json();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

  const itemBase = {
    title: body.title,
    type: body.type,
    buy_price: Number(body.buy_price),
    buy_date: body.buy_date,
    quantity: Number(body.quantity),
    user_id: user.id,
    notes: "",
  };

  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert([itemBase])
    .select()
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: itemError?.message || "Erro ao inserir item" }, { status: 400 });
  }

  let subError = null;
  switch (body.type) {
    case "ROUPA":
      ({ error: subError } = await supabase
        .from("item_roupa")
        .insert([{
          item_id: item.id,
          size: body.size,
          brand: body.brand,
          condition: body.condition,
        }]));
      break;
    case "SAPATILHAS":
      ({ error: subError } = await supabase
        .from("item_sapatilhas")
        .insert([{
          item_id: item.id,
          size_eu: Number(body.size_eu),
          brand: body.brand,
          model: body.model,
          condition: body.condition,
        }]));
      break;
    case "BILHETES":
      ({ error: subError } = await supabase
        .from("item_bilhetes")
        .insert([{
          item_id: item.id,
          event_name: body.event_name,
          event_date: body.event_date,
          location: body.location,
          seat_info: body.seat_info,
        }]));
      break;
    case "CARTAS":
      ({ error: subError } = await supabase
        .from("item_cartas")
        .insert([{
          item_id: item.id,
          game: body.game,
          set_name: body.set_name,
          card_name: body.card_name,
          grade: body.grade,
          language: body.language,
        }]));
      break;
    case "RANDOM": {
      let parsedExtra: Record<string, unknown> = {};
      if (body.extra) {
        try {
          parsedExtra = JSON.parse(body.extra);
        } catch {
          return NextResponse.json({ error: "Campo Extra tem de ser um JSON válido." }, { status: 400 });
        }
      }
      ({ error: subError } = await supabase
        .from("item_random")
        .insert([{
          item_id: item.id,
          extra: parsedExtra,
        }]));
      break;
    }
  }

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 400 });
  }

  return NextResponse.json({ item });
}