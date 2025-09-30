require("dotenv").config();
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

const { AIRTABLE_BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE, AIRTABLE_VIEW } = process.env;

async function runSync() {
  console.log("🚀 Starting villa sync...");

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?maxRecords=1000&view=${encodeURIComponent(
    AIRTABLE_VIEW
  )}`;

  console.log("🔗 Fetching from:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    console.error("❌ Sync failed:", await res.text());
    process.exit(1);
  }

  const json = await res.json();

  if (!json.records) {
    console.error("❌ Sync failed: No records returned");
    process.exit(1);
  }

  const villas = json.records.map((r) => {
    const f = r.fields;
    return {
      villa_id: f.dwelling_id || r.id,
      name: f.name || "",
      region: f.region || "",
      sub_region: f.sub_region || "",
      country: f.country || "",
      capacity: f.capacity || 0,
      bedrooms: f.bedrooms || 0,
      bathrooms: f.bathrooms || 0,
      main_photo: f.main_photo || "",
      url: f.url || "",
      description: f.description || "",
      availability_tags: Array.isArray(f.availability_tags)
        ? f.availability_tags
        : (f.availability_tags || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
      price_eur: f.price_eur || 0,
      price_gbp: f.price_gbp || 0,
      last_update: f.last_update || "",
    };
  });

  const file = path.join(__dirname, "villas.json");
  fs.writeFileSync(file, JSON.stringify(villas, null, 2));
  console.log(`✅ Wrote ${villas.length} villas to villas.json`);
}

if (require.main === module) {
  runSync().catch((err) => {
    console.error("❌ Sync error:", err);
    process.exit(1);
  });
}
