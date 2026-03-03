import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { INVENTORY_ALLOWED_TYPES } from "../../../lib/imports/inventoryCsvSpec";

type ImportRow = {
  title?: unknown;
  type?: unknown;
  buy_price?: unknown;
  buy_date?: unknown;
  quantity?: unknown;
  size?: unknown;
  brand?: unknown;
  condition?: unknown;
  size_eu?: unknown;
  model?: unknown;
  event_name?: unknown;
  event_date?: unknown;
  location?: unknown;
  seat_info?: unknown;
  game?: unknown;
  set_name?: unknown;
  card_name?: unknown;
  grade?: unknown;
  language?: unknown;
  extra?: unknown;
};

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toTrimmedString(value: unknown) {
  return String(value ?? "").trim();
}

function validateRow(row: ImportRow) {
  const messages: string[] = [];
  const title = toTrimmedString(row.title);
  const type = toTrimmedString(row.type).toUpperCase();
  const buyPriceRaw = toTrimmedString(row.buy_price);
  const buyDateRaw = toTrimmedString(row.buy_date);
  const quantityRaw = toTrimmedString(row.quantity);
  const eventDateRaw = toTrimmedString(row.event_date);

  if (!title) messages.push("title em falta");
  if (!type) {
    messages.push("type em falta");
  } else if (!INVENTORY_ALLOWED_TYPES.includes(type as (typeof INVENTORY_ALLOWED_TYPES)[number])) {
    messages.push(`type inválido (${type})`);
  }

  const buyPrice = parseDecimal(buyPriceRaw);
  if (!buyPriceRaw) {
    messages.push("buy_price em falta");
  } else if (!Number.isFinite(buyPrice) || buyPrice < 0) {
    messages.push("buy_price inválido");
  }

  const quantity = Number(quantityRaw);
  if (!quantityRaw) {
    messages.push("quantity em falta");
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    messages.push("quantity inválida");
  }

  const buyDate = parseDateOnly(buyDateRaw);
  if (!buyDateRaw) {
    messages.push("buy_date em falta");
  } else if (!buyDate) {
    messages.push("buy_date inválida (formato YYYY-MM-DD)");
  }

  if (eventDateRaw) {
    const eventDate = parseDateOnly(eventDateRaw);
    if (!eventDate) {
      messages.push("event_date inválida (formato YYYY-MM-DD)");
    } else if (type === "BILHETES" && buyDate && eventDate < buyDate) {
      messages.push("event_date não pode ser anterior a buy_date");
    }
  }

  if (type === "RANDOM") {
    const extraRaw = toTrimmedString(row.extra);
    if (extraRaw) {
      try {
        JSON.parse(extraRaw);
      } catch {
        messages.push("extra inválido (JSON esperado)");
      }
    }
  }

  return messages;
}

function toItemPayload(row: ImportRow, userId: string) {
  return {
    title: toTrimmedString(row.title),
    type: toTrimmedString(row.type).toUpperCase(),
    buy_price: parseDecimal(toTrimmedString(row.buy_price)),
    buy_date: toTrimmedString(row.buy_date),
    quantity: Number(toTrimmedString(row.quantity)),
    user_id: userId,
    notes: "",
  };
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : null;
  const validateOnly = Boolean(body?.validateOnly);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha para importar" }, { status: 400 });
  }

  if (rows.length > 2000) {
    return NextResponse.json({ error: "Limite máximo: 2000 linhas por import" }, { status: 400 });
  }

  const rowErrors = rows
    .map((row, index) => ({
      rowNumber: index + 2,
      messages: validateRow(row),
    }))
    .filter((entry) => entry.messages.length > 0);

  const invalidRows = rowErrors.length;
  const validRows = rows.length - invalidRows;

  if (validateOnly || invalidRows > 0) {
    return NextResponse.json(
      {
        ok: invalidRows === 0,
        mode: "validate_only",
        summary: {
          totalRows: rows.length,
          validRows,
          invalidRows,
        },
        rowErrors,
      },
      invalidRows > 0 ? { status: 400 } : undefined
    );
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

  const batchSize = 200;
  let insertedItems = 0;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batchRows = rows.slice(start, start + batchSize);
    const itemPayload = batchRows.map((row) => toItemPayload(row, user.id));

    const { data: insertedBatch, error: insertError } = await supabase
      .from("items")
      .insert(itemPayload)
      .select("id, type");

    if (insertError || !insertedBatch) {
      return NextResponse.json({ error: insertError?.message || "Erro ao inserir items" }, { status: 400 });
    }

    insertedItems += insertedBatch.length;

    const roupaRows: Array<{ item_id: string; size: string; brand: string; condition: string }> = [];
    const sapatilhasRows: Array<{ item_id: string; size_eu: number | null; brand: string; model: string; condition: string }> = [];
    const bilhetesRows: Array<{ item_id: string; event_name: string; event_date: string | null; location: string; seat_info: string }> = [];
    const cartasRows: Array<{ item_id: string; game: string; set_name: string; card_name: string; grade: string; language: string }> = [];
    const randomRows: Array<{ item_id: string; extra: Record<string, unknown> }> = [];

    insertedBatch.forEach((item, index) => {
      const row = batchRows[index];
      const type = toTrimmedString(row.type).toUpperCase();

      if (type === "ROUPA") {
        roupaRows.push({
          item_id: item.id,
          size: toTrimmedString(row.size),
          brand: toTrimmedString(row.brand),
          condition: toTrimmedString(row.condition),
        });
      } else if (type === "SAPATILHAS") {
        const sizeEuRaw = toTrimmedString(row.size_eu);
        const sizeEu = sizeEuRaw ? parseDecimal(sizeEuRaw) : null;
        sapatilhasRows.push({
          item_id: item.id,
          size_eu: Number.isFinite(sizeEu) ? sizeEu : null,
          brand: toTrimmedString(row.brand),
          model: toTrimmedString(row.model),
          condition: toTrimmedString(row.condition),
        });
      } else if (type === "BILHETES") {
        const eventDate = toTrimmedString(row.event_date);
        bilhetesRows.push({
          item_id: item.id,
          event_name: toTrimmedString(row.event_name),
          event_date: eventDate || null,
          location: toTrimmedString(row.location),
          seat_info: toTrimmedString(row.seat_info),
        });
      } else if (type === "CARTAS") {
        cartasRows.push({
          item_id: item.id,
          game: toTrimmedString(row.game),
          set_name: toTrimmedString(row.set_name),
          card_name: toTrimmedString(row.card_name),
          grade: toTrimmedString(row.grade),
          language: toTrimmedString(row.language),
        });
      } else if (type === "RANDOM") {
        const extraRaw = toTrimmedString(row.extra);
        let extraValue: Record<string, unknown> = {};
        if (extraRaw) {
          extraValue = JSON.parse(extraRaw) as Record<string, unknown>;
        }
        randomRows.push({
          item_id: item.id,
          extra: extraValue,
        });
      }
    });

    if (roupaRows.length > 0) {
      const { error } = await supabase.from("item_roupa").insert(roupaRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (sapatilhasRows.length > 0) {
      const { error } = await supabase.from("item_sapatilhas").insert(sapatilhasRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (bilhetesRows.length > 0) {
      const { error } = await supabase.from("item_bilhetes").insert(bilhetesRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (cartasRows.length > 0) {
      const { error } = await supabase.from("item_cartas").insert(cartasRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (randomRows.length > 0) {
      const { error } = await supabase.from("item_random").insert(randomRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "import",
    summary: {
      totalRows: rows.length,
      validRows,
      invalidRows,
      insertedItems,
    },
    rowErrors: [],
  });
}
