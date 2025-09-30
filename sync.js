require("dotenv").config();
const fs = require("fs");
const fetch = require("node-fetch");

const { AIRTABLE_BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE, AIRTABLE_VIEW } = process.env;

async function syncVillas() {
  console.log("🚀 Starting villa sync...");

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?maxRecords=1000&view=${encodeURIComponent(
    AIRTABLE_VIEW
  )}`;
  console.log("🔗 Fetching from:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();

  if (!json.records) {
    throw new Error("No records returned from Airtable");
  }

  const villas = json.records.map((r) => {
    const f = r.fields;
    return {
      villa_id: f.villa_id || r.id,
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

  console.log(`✅ Synced ${villas.length} villas`);
  return villas;
}

module.exports = { syncVillas };
