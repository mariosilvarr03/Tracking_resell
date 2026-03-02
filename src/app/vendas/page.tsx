import { supabaseServer } from "../lib/supabase/server";
import VendasTable from "./VendasTable";

type RelatedItem = {
  title: string;
  type: string;
  buy_price: number;
};

type RelatedPlatform = {
  name: string;
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
  item: RelatedItem[] | RelatedItem | null;
  platform: RelatedPlatform[] | RelatedPlatform | null;
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
    .select("id, sold_at, sold_quantity, sold_price, fees, item:items(title, type, buy_price), platform:platforms(name)")
    .order("sold_at", { ascending: false });

  if (error) {
    return <div>Erro ao carregar vendas: {error.message}</div>;
  }

  const normalizedSales = ((data ?? []) as SaleRowRaw[]).map((sale) => {
    const item = pickRelated(sale.item);
    const platform = pickRelated(sale.platform);

    return {
      id: sale.id,
      title: item?.title ?? "-",
      type: item?.type ?? "SEM_CATEGORIA",
      platform: platform?.name ?? null,
      sold_at: sale.sold_at,
      sold_quantity: Number(sale.sold_quantity ?? 0),
      sold_price: Number(sale.sold_price ?? 0),
      fees: Number(sale.fees ?? 0),
      buy_unit_cost: Number(item?.buy_price ?? 0),
    } satisfies SaleRow;
  });

  return <VendasTable sales={normalizedSales} />;
}
