import { supabaseServer } from "../lib/supabase/server";
import InventarioTable from "./InventarioTable";

export default async function InventarioPage() {
  const supabase = await supabaseServer();
  const { data: items, error } = await supabase
    .from("items")
    .select("id, title, type, quantity, sold_quantity_total, buy_price, buy_date")
    .order("buy_date", { ascending: false });

  if (error) {
    return <div>Erro ao carregar inventário: {error.message}</div>;
  }

  return <InventarioTable items={items ?? []} />;
}