import "dotenv/config";
import fetch from "node-fetch";

const {
  AIRTABLE_BASE_ID,
  AIRTABLE_API_KEY,
  AIRTABLE_TABLE,
  AIRTABLE_VIEW,
} = process.env;

async function fetchAllRecords() {
  let allRecords = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("view", AIRTABLE_VIEW);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    allRecords = allRecords.concat(json.records);
    offset = json.offset;
  } while (offset);

  return allRecords;
}

function parsePhotos(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function parseAvailabilityTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  return String(value)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseAmenities(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [...new Set(value.map((a) => String(a).trim()).filter(Boolean))];
  }

  return [
    ...new Set(
      String(value)
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    ),
  ];
}

function parseCheckbox(value) {
  return value === true;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function syncVillas() {
  console.log("🚀 Starting villa sync...");

  const records = await fetchAllRecords();

  const villas = records.map((r) => {
    const f = r.fields;

    const amenitiesList = parseAmenities(f.amenities);

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
      photos: parsePhotos(f.photos),
      url: f.url || "",
      description: f.description || "",

      availability_tags: parseAvailabilityTags(f.availability_tags),

      price_eur: f.price_eur || 0,
      price_gbp: f.price_gbp || 0,
      price_gbp_min: f.price_gbp_min || 0,
      price_gbp_max: f.price_gbp_max || 0,

      has_pool: parseCheckbox(f.has_pool),
      is_family_villa: parseCheckbox(f.is_family_villa),
      is_large_villa: parseCheckbox(f.is_large_villa),
      is_luxury_villa: parseCheckbox(f.is_luxury_villa),

      latitude: parseNumber(f.latitude),
      longitude: parseNumber(f.longitude),

      amenities: amenitiesList.join(", "),
      amenities_list: amenitiesList,

      last_update: f.last_update || "",
    };
  });

  console.log(`✅ Synced ${villas.length} villas`);
  return villas;
}
