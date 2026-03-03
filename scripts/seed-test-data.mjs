import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID;
const SEED_MARKER = process.env.SEED_MARKER ?? "beta-seed";
const ITEM_COUNT = Number(process.env.SEED_ITEM_COUNT ?? 500);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_USER_ID) {
  console.error("Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID");
  process.exit(1);
}

if (!Number.isInteger(ITEM_COUNT) || ITEM_COUNT < 1) {
  console.error("SEED_ITEM_COUNT must be a positive integer.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const itemTypes = ["CARTAS", "ROUPA", "SAPATILHAS", "BILHETES", "RANDOM"];
const platformNames = ["vinted", "ebay", "stockx", "grailed", "olx", "instagram"];

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function dateToIso(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseIso, days) {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToIso(d);
}

function buildItems() {
  const today = new Date();
  const items = [];

  for (let i = 0; i < ITEM_COUNT; i += 1) {
    const type = itemTypes[randomInt(0, itemTypes.length - 1)];
    const quantity = randomInt(1, 4);
    const buyPrice = Number(randomNumber(10, 350).toFixed(2));
    const buyDate = new Date(today);
    buyDate.setUTCDate(today.getUTCDate() - randomInt(2, 180));

    items.push({
      user_id: TEST_USER_ID,
      type,
      title: `[SEED:${SEED_MARKER}] Item ${i + 1} (${type})`,
      buy_date: dateToIso(buyDate),
      buy_price: buyPrice,
      quantity,
      notes: `[SEED:${SEED_MARKER}]`,
    });
  }

  return items;
}

async function loadPlatformMap() {
  const { data, error } = await supabase.from("platforms").select("id, name").in("name", platformNames);
  if (error) throw error;
  const map = new Map((data ?? []).map((row) => [row.name, row.id]));
  return map;
}

async function insertItems(items) {
  const inserted = [];
  for (const part of chunk(items, 100)) {
    const { data, error } = await supabase
      .from("items")
      .insert(part)
      .select("id, buy_date, buy_price, quantity");
    if (error) throw error;
    inserted.push(...(data ?? []));
  }
  return inserted;
}

function buildSales(insertedItems, platformMap) {
  const sales = [];

  insertedItems.forEach((item) => {
    if (Math.random() > 0.65) return;

    const soldQuantity = randomInt(1, Number(item.quantity));
    const soldPrice = Number((Number(item.buy_price) * randomNumber(0.9, 1.6)).toFixed(2));
    const fees = Number(randomNumber(0, 8).toFixed(2));
    const soldAt = addDays(item.buy_date, randomInt(1, 120));
    const platformName = platformNames[randomInt(0, platformNames.length - 1)];
    const platformId = platformMap.get(platformName) ?? null;

    sales.push({
      user_id: TEST_USER_ID,
      item_id: item.id,
      sold_quantity: soldQuantity,
      sold_price: soldPrice,
      fees,
      sold_at: soldAt,
      platform_id: platformId,
    });
  });

  return sales;
}

async function insertSales(sales) {
  for (const part of chunk(sales, 100)) {
    const { error } = await supabase.from("sales").insert(part);
    if (error) throw error;
  }
}

async function main() {
  console.log(`Seeding ${ITEM_COUNT} items for user ${TEST_USER_ID} with marker ${SEED_MARKER}...`);
  const items = buildItems();
  const platformMap = await loadPlatformMap();
  const insertedItems = await insertItems(items);
  const sales = buildSales(insertedItems, platformMap);
  await insertSales(sales);
  console.log(`Done. Inserted ${insertedItems.length} items and ${sales.length} sales.`);
}

main().catch((error) => {
  console.error("Seed failed:", error.message ?? error);
  process.exit(1);
});
