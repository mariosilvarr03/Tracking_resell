import { supabaseServer } from "../../../lib/supabase/server";
import VendaFormClient from "./VendaFormClient";

type VenderPageProps = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function VenderItemPage({ params }: VenderPageProps) {
  const resolvedParams = await params;
  const itemId = resolvedParams.id;

  const supabase = await supabaseServer();

  const { data: item, error } = await supabase
    .from("items")
    .select("id, title, quantity, sold_quantity_total")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    return <div>Item não encontrado.</div>;
  }

  const stockAvailable = item.quantity - item.sold_quantity_total;

  if (stockAvailable <= 0) {
    return <div>Este item já não tem stock disponível para venda.</div>;
  }

  return (
    <VendaFormClient
      itemId={item.id}
      itemTitle={item.title}
      stockAvailable={stockAvailable}
    />
  );
}
