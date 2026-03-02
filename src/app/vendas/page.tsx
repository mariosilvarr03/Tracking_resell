import { supabaseServer } from "../lib/supabase/server";
import VendasTable from "./VendasTable";
import { createClient } from "@supabase/supabase-js";

type RelatedItem = {
  title: string;
  type: string;
  buy_price: number;
};

type SaleRow = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  sold_at: string;
  sold_quantity: number;
  sold_price: number;
  fees: number;
  buy_unit_cost: number;
};

type SaleRowRaw = {
  id: string;
  sold_at: string;
  sold_quantity: number;
  sold_price: number;
  fees: number;
  platform_id: number | string | null;
  item: RelatedItem[] | RelatedItem | null;
};

function pickRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function VendasPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("sales")
    .select("id, sold_at, sold_quantity, sold_price, fees, platform_id, item:items(title, type, buy_price)")
    .order("sold_at", { ascending: false });

  if (error) {
    return <div>Erro ao carregar vendas: {error.message}</div>;
  }

  const rows = (data ?? []) as SaleRowRaw[];
  const platformIds = Array.from(
    new Set(
      rows
        .map((sale) => (sale.platform_id == null ? null : Number(sale.platform_id)))
        .filter((value): value is number => Number.isFinite(value))
    )
  );

  let platformById = new Map<number, string>();
  if (platformIds.length > 0) {
    const adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null;

    const clientForPlatforms = adminClient ?? supabase;

    const { data: platforms } = await clientForPlatforms
      .from("platforms")
      .select("id, name")
      .in("id", platformIds);

    platformById = new Map(
      (platforms ?? []).map((platform) => [Number(platform.id), platform.name])
    );
  }

  const normalizedSales = rows.map((sale) => {
    const item = pickRelated(sale.item);

    return {
      id: sale.id,
      title: item?.title ?? "-",
      type: item?.type ?? "SEM_CATEGORIA",
      platform:
        sale.platform_id == null ? null : platformById.get(Number(sale.platform_id)) ?? null,
      sold_at: sale.sold_at,
      sold_quantity: Number(sale.sold_quantity ?? 0),
      sold_price: Number(sale.sold_price ?? 0),
      fees: Number(sale.fees ?? 0),
      buy_unit_cost: Number(item?.buy_price ?? 0),
    } satisfies SaleRow;
  });

  return <VendasTable sales={normalizedSales} />;
}
