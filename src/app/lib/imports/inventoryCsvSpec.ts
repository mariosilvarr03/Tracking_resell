export type InventoryCsvCanonicalHeader =
  | "title"
  | "type"
  | "buy_price"
  | "buy_date"
  | "quantity"
  | "size"
  | "brand"
  | "condition"
  | "size_eu"
  | "model"
  | "event_name"
  | "event_date"
  | "location"
  | "seat_info"
  | "game"
  | "set_name"
  | "card_name"
  | "grade"
  | "language"
  | "extra";

export const INVENTORY_ALLOWED_TYPES = ["CARTAS", "ROUPA", "SAPATILHAS", "BILHETES", "RANDOM"] as const;

export const INVENTORY_CSV_REQUIRED_HEADERS: InventoryCsvCanonicalHeader[] = [
  "title",
  "type",
  "buy_price",
  "buy_date",
  "quantity",
];

export const INVENTORY_CSV_TEMPLATE_HEADERS: InventoryCsvCanonicalHeader[] = [
  "title",
  "type",
  "buy_price",
  "buy_date",
  "quantity",
  "size",
  "brand",
  "condition",
  "size_eu",
  "model",
  "event_name",
  "event_date",
  "location",
  "seat_info",
  "game",
  "set_name",
  "card_name",
  "grade",
  "language",
  "extra",
];

const INVENTORY_CSV_HEADER_ALIASES: Record<InventoryCsvCanonicalHeader, string[]> = {
  title: ["title", "nome", "produto", "item", "name"],
  type: ["type", "tipo", "categoria", "category"],
  buy_price: ["buy_price", "preco_compra", "preco_de_compra", "purchase_price", "cost_price", "cost"],
  buy_date: ["buy_date", "data_compra", "data_de_compra", "purchase_date"],
  quantity: ["quantity", "quantidade", "qty", "qtd", "units", "unidades"],
  size: ["size", "tamanho"],
  brand: ["brand", "marca"],
  condition: ["condition", "condicao", "estado"],
  size_eu: ["size_eu", "tamanho_eu", "eu_size"],
  model: ["model", "modelo"],
  event_name: ["event_name", "nome_evento", "evento"],
  event_date: ["event_date", "data_evento"],
  location: ["location", "local", "venue"],
  seat_info: ["seat_info", "lugar", "assento", "seat"],
  game: ["game", "colecao", "franchise"],
  set_name: ["set_name", "set", "colecao_set"],
  card_name: ["card_name", "carta", "nome_carta"],
  grade: ["grade", "grading"],
  language: ["language", "idioma", "lang"],
  extra: ["extra", "extras", "metadata", "json"],
};

export function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getInventoryCsvAliasesMap(): Map<string, InventoryCsvCanonicalHeader> {
  const map = new Map<string, InventoryCsvCanonicalHeader>();

  (Object.entries(INVENTORY_CSV_HEADER_ALIASES) as Array<[InventoryCsvCanonicalHeader, string[]]>).forEach(
    ([canonical, aliases]) => {
      aliases.forEach((alias) => {
        map.set(normalizeCsvHeader(alias), canonical);
      });
    }
  );

  return map;
}

export function mapInventoryCsvHeaders(headers: string[]) {
  const aliasesMap = getInventoryCsvAliasesMap();
  const canonicalByIndex: Array<InventoryCsvCanonicalHeader | null> = headers.map((header) => {
    const normalized = normalizeCsvHeader(header);
    return aliasesMap.get(normalized) ?? null;
  });

  const foundCanonical = new Set<InventoryCsvCanonicalHeader>(
    canonicalByIndex.filter((value): value is InventoryCsvCanonicalHeader => Boolean(value))
  );

  const missingRequired = INVENTORY_CSV_REQUIRED_HEADERS.filter((required) => !foundCanonical.has(required));

  return {
    canonicalByIndex,
    unknownHeaders: headers.filter((_, index) => canonicalByIndex[index] === null),
    missingRequired,
  };
}
