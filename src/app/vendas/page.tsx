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
  item_id: string;
  sold_at: string;
  sold_quantity: number;
  sold_price: number;
  fees: number;
  platform_id: number | string | null;
  item: RelatedItem[] | RelatedItem | null;
};

type SearchParamsInput = {
  query?: string;
  category?: string;
  platform?: string;
  orderBy?: string;
  page?: string;
  pageSize?: string;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function pickRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>;
}) {
  const params = (await searchParams) ?? {};
  const query = String(params.query ?? "").trim();
  const queryNormalized = query.toLowerCase();
  const category = String(params.category ?? "all");
  const platform = String(params.platform ?? "all");
  const orderBy = String(params.orderBy ?? "sold_at_desc");
  const page = parsePositiveInt(params.page, 1);
  const pageSizeRaw = parsePositiveInt(params.pageSize, 25);
  const pageSize = [25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 25;

  const supabase = await supabaseServer();
  const adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

  const clientForPlatforms = adminClient ?? supabase;

  let filteredItemIds: string[] | null = null;
  let filteredPlatformIds: number[] | null = null;

  if (category !== "all") {
    const { data: categoryItems } = await supabase
      .from("items")
      .select("id")
      .eq("type", category);

    filteredItemIds = (categoryItems ?? []).map((row) => row.id as string);
  }

  if (platform !== "all") {
    const { data: platformRows } = await clientForPlatforms
      .from("platforms")
      .select("id")
      .eq("name", platform)
      .limit(1);

    filteredPlatformIds = (platformRows ?? []).map((row) => Number(row.id));
  }

  if (queryNormalized.length > 0) {
    const [{ data: queryItems }, { data: queryPlatforms }] = await Promise.all([
      supabase
        .from("items")
        .select("id")
        .or(`title.ilike.%${queryNormalized}%,type.ilike.%${queryNormalized}%`),
      clientForPlatforms
        .from("platforms")
        .select("id")
        .ilike("name", `%${queryNormalized}%`),
    ]);

    const queryItemIds = (queryItems ?? []).map((row) => row.id as string);
    const queryPlatformIds = (queryPlatforms ?? []).map((row) => Number(row.id));

    filteredItemIds = filteredItemIds ? filteredItemIds.filter((id) => queryItemIds.includes(id)) : queryItemIds;
    filteredPlatformIds = filteredPlatformIds
      ? filteredPlatformIds.filter((id) => queryPlatformIds.includes(id))
      : queryPlatformIds;
  }

  const shouldReturnEmpty =
    (filteredItemIds !== null && filteredItemIds.length === 0) &&
    (filteredPlatformIds !== null && filteredPlatformIds.length === 0);

  if (shouldReturnEmpty) {
    return (
      <VendasTable
        sales={[]}
        initialFilters={{ query, category, platform, orderBy }}
        pagination={{ page, pageSize, totalCount: 0, totalPages: 1 }}
      />
    );
  }

  let queryBuilder = supabase
    .from("sales")
    .select("id, item_id, sold_at, sold_quantity, sold_price, fees, platform_id, item:items(title, type, buy_price)", {
      count: "exact",
    });

  if (filteredItemIds && filteredItemIds.length > 0) {
    queryBuilder = queryBuilder.in("item_id", filteredItemIds);
  }

  if (filteredPlatformIds && filteredPlatformIds.length > 0) {
    queryBuilder = queryBuilder.in("platform_id", filteredPlatformIds);
  }

  switch (orderBy) {
    case "sold_at_asc":
      queryBuilder = queryBuilder.order("sold_at", { ascending: true });
      break;
    case "price_asc":
      queryBuilder = queryBuilder.order("sold_price", { ascending: true });
      break;
    case "price_desc":
      queryBuilder = queryBuilder.order("sold_price", { ascending: false });
      break;
    case "quantity_asc":
      queryBuilder = queryBuilder.order("sold_quantity", { ascending: true });
      break;
    case "quantity_desc":
      queryBuilder = queryBuilder.order("sold_quantity", { ascending: false });
      break;
    case "sold_at_desc":
    default:
      queryBuilder = queryBuilder.order("sold_at", { ascending: false });
      break;
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await queryBuilder.range(from, to);

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

  const totalCount = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <VendasTable
      sales={normalizedSales}
      initialFilters={{ query, category, platform, orderBy }}
      pagination={{ page, pageSize, totalCount, totalPages }}
    />
  );
}
