import "dotenv/config";
import fs from "fs";
import fetch from "node-fetch";

export async function syncVillas() {
  console.log("🚀 Sync starting…");

  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE || "Villas";
  const view  = process.env.AIRTABLE_VIEW;

  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?maxRecords=1000`;
  if (view) url += `&view=${encodeURIComponent(view)}`;

  console.log("🔗", url);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
  });
  const data = await resp.json();
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
        : (f.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      price_eur: Number(f.price_eur || 0),
      price_gbp: Number(f.price_gbp || 0),
      last_update: f.last_update || new Date().toISOString(),
    };
  });

  fs.writeFileSync("./villas.json", JSON.stringify(villas, null, 2));
  console.log(`✅ Synced ${villas.length} villas → villas.json`);
}

if (process.argv[1]?.endsWith("sync.js")) {
  syncVillas().catch((e) => {
    console.error("❌ Sync failed:", e.message);
    process.exit(1);
  });
}
