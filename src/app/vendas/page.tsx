import { supabaseServer } from "../lib/supabase/server";
import VendasTable from "./VendasTable";

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

export default async function VendasPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("v_sales_enriched")
    .select("id, title, type, platform, sold_at, sold_quantity, sold_price, fees, buy_unit_cost")
    .order("sold_at", { ascending: false });

  if (error) {
    return <div>Erro ao carregar vendas: {error.message}</div>;
  }

  return <VendasTable sales={(data as SaleRow[]) ?? []} />;
}
