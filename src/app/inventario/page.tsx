import { supabaseServer } from "../lib/supabase/server";
import InventarioTable from "./InventarioTable";

type SearchParamsInput = {
  query?: string;
  status?: string;
  category?: string;
  orderBy?: string;
  page?: string;
  pageSize?: string;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>;
}) {
  const params = (await searchParams) ?? {};
  const query = String(params.query ?? "").trim();
  const status = String(params.status ?? "ALL");
  const category = String(params.category ?? "ALL");
  const orderBy = String(params.orderBy ?? "buy_date_desc");
  const page = parsePositiveInt(params.page, 1);
  const pageSizeRaw = parsePositiveInt(params.pageSize, 25);
  const pageSize = [25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 25;

  const supabase = await supabaseServer();

  let queryBuilder = supabase
    .from("items")
    .select("id, title, type, quantity, sold_quantity_total, buy_price, buy_date, status", { count: "exact" });

  if (query.length > 0) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query}%,type.ilike.%${query}%`);
  }

  if (status === "EM_STOCK" || status === "VENDIDO") {
    queryBuilder = queryBuilder.eq("status", status);
  }

  if (category !== "ALL") {
    queryBuilder = queryBuilder.eq("type", category);
  }

  switch (orderBy) {
    case "buy_date_asc":
      queryBuilder = queryBuilder.order("buy_date", { ascending: true });
      break;
    case "title_asc":
      queryBuilder = queryBuilder.order("title", { ascending: true });
      break;
    case "title_desc":
      queryBuilder = queryBuilder.order("title", { ascending: false });
      break;
    case "price_asc":
      queryBuilder = queryBuilder.order("buy_price", { ascending: true });
      break;
    case "price_desc":
      queryBuilder = queryBuilder.order("buy_price", { ascending: false });
      break;
    case "stock_asc":
      queryBuilder = queryBuilder.order("quantity", { ascending: true }).order("sold_quantity_total", { ascending: false });
      break;
    case "stock_desc":
      queryBuilder = queryBuilder.order("quantity", { ascending: false }).order("sold_quantity_total", { ascending: true });
      break;
    case "buy_date_desc":
    default:
      queryBuilder = queryBuilder.order("buy_date", { ascending: false });
      break;
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: items, error, count } = await queryBuilder.range(from, to);

  if (error) {
    return <div>Erro ao carregar inventário: {error.message}</div>;
  }

  const totalCount = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <InventarioTable
      items={items ?? []}
      initialFilters={{ query, status, category, orderBy }}
      pagination={{ page, pageSize, totalCount, totalPages }}
    />
  );
}