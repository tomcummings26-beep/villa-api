import fs from "fs";
import dotenv from "dotenv";
import fetch from "node-fetch";

// Load env: prefer .env, fallback to keys.env
if (fs.existsSync(".env")) {
  dotenv.config();
} else if (fs.existsSync("keys.env")) {
  dotenv.config({ path: "keys.env" });
} else {
  console.warn("⚠️ No .env or keys.env found at project root");
}

async function syncVillas() {
  console.log("🚀 Starting villa sync...");

  // Debug (safe): shows if values are present, not the keys
  console.log("ENV CHECK:", {
    baseId: process.env.AIRTABLE_BASE_ID,
    apiKeyLoaded: !!process.env.AIRTABLE_API_KEY,
    table: process.env.AIRTABLE_TABLE,
    view: process.env.AIRTABLE_VIEW,
  });

  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE || "Villas";
  const viewName = process.env.AIRTABLE_VIEW;

  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}?maxRecords=1500`;
  if (viewName) url += `&view=${encodeURIComponent(viewName)}`;

  console.log("🔗 Fetching from:", url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    });
    const data = await response.json();
    if (!data.records) throw new Error(JSON.stringify(data));

    const villas = data.records.map((r) => {
      const f = r.fields || {};
      return {
        villa_id: r.id,
        name: f.name || "",
        region: f.region || "",
        sub_region: f.sub_region || "",
        country: f.country || "",
        capacity: Number(f.capacity || 0),
        bedrooms: Number(f.bedrooms || 0),
        bathrooms: Number(f.bathrooms || 0),
        main_photo: f.image?.[0]?.url || "",
        url: f.url || "",
        description: f.description || "",
        availability_tags: Array.isArray(f.tags)
          ? f.tags
          : (f.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
        price_eur: Number(f.price_eur || 0),
        price_gbp: Number(f.price_gbp || 0),
        last_update: f.last_update || new Date().toISOString(),
      };
    });

    fs.writeFileSync("./villas.json", JSON.stringify(villas, null, 2));
    console.log(`✅ Synced ${villas.length} villas to villas.json`);
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
  }
}

syncVillas();
