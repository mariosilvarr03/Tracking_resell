import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID;
const SEED_MARKER = process.env.SEED_MARKER ?? "beta-seed";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_USER_ID) {
  console.error("Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function getSeededItemIds() {
  const marker = `[SEED:${SEED_MARKER}]`;
  const ids = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("items")
      .select("id")
      .eq("user_id", TEST_USER_ID)
      .eq("notes", marker)
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    ids.push(...data.map((row) => row.id));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function deleteSalesByItemIds(itemIds) {
  let deleted = 0;
  for (const idsPart of chunk(itemIds, 200)) {
    const { data, error } = await supabase
      .from("sales")
      .delete()
      .eq("user_id", TEST_USER_ID)
      .in("item_id", idsPart)
      .select("id");
    if (error) throw error;
    deleted += (data ?? []).length;
  }
  return deleted;
}

async function deleteItems(itemIds) {
  let deleted = 0;
  for (const idsPart of chunk(itemIds, 200)) {
    const { data, error } = await supabase
      .from("items")
      .delete()
      .eq("user_id", TEST_USER_ID)
      .in("id", idsPart)
      .select("id");
    if (error) throw error;
    deleted += (data ?? []).length;
  }
  return deleted;
}

async function main() {
  console.log(`Cleaning seed data for user ${TEST_USER_ID} with marker ${SEED_MARKER}...`);
  const itemIds = await getSeededItemIds();
  if (itemIds.length === 0) {
    console.log("Nothing to clean.");
    return;
  }

  const salesDeleted = await deleteSalesByItemIds(itemIds);
  const itemsDeleted = await deleteItems(itemIds);
  console.log(`Done. Deleted ${salesDeleted} sales and ${itemsDeleted} items.`);
}

main().catch((error) => {
  console.error("Cleanup failed:", error.message ?? error);
  process.exit(1);
});
