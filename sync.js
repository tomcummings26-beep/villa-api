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

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePhotos(value) {
  return parseJsonArray(value);
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

function parseText(value) {
  return value == null ? "" : String(value);
}

export async function syncVillas() {
  console.log("🚀 Starting villa sync...");

  const records = await fetchAllRecords();

  const villas = records.map((r) => {
    const f = r.fields;

    const amenitiesList = parseJsonArray(f.amenities_json).length
      ? parseJsonArray(f.amenities_json)
      : parseAmenities(f.amenities);

    const photos = parsePhotos(f.photos);
    const terms = parseJsonArray(f.terms_and_conditions_json);
    const videos = parseJsonArray(f.videos_json);

    return {
      villa_id: f.villa_id || r.id,
      name: parseText(f.name),

      // existing taxonomy fields kept compatible
      region: parseText(f.region),
      sub_region: parseText(f.sub_region),
      country: parseText(f.country),

      // extended taxonomy / address
      parent_region: parseText(f.parent_region),
      address1: parseText(f.address1),
      address2: parseText(f.address2),
      city: parseText(f.city),
      zip_code: parseNumber(f.zip_code),

      // core specs
      dwelling_type: parseText(f.dwelling_type),
      capacity: parseNumber(f.capacity) || 0,
      base_capacity: parseNumber(f.base_capacity),
      maximum_capacity: parseNumber(f.maximum_capacity),
      bedrooms: parseNumber(f.bedrooms) || 0,
      bathrooms: parseNumber(f.bathrooms) || 0,

      // media
      main_photo: parseText(f.main_photo),
      photos,
      photo_count: parseNumber(f.photo_count) || (parseText(f.main_photo) ? photos.length + 1 : photos.length),
      videos,

      // content
      url: parseText(f.url),
      description: parseText(f.description),
      location_description: parseText(f.location_description),
      interior_grounds: parseText(f.interior_grounds),
      catering_services: parseText(f.catering_services),

      // availability / pricing
      availability_tags: parseAvailabilityTags(f.availability_tags),

      price_eur: parseNumber(f.price_eur) || 0,
      price_gbp: parseNumber(f.price_gbp) || 0,
      price_gbp_min: parseNumber(f.price_gbp_min) || 0,
      price_gbp_max: parseNumber(f.price_gbp_max) || 0,

      weekly_price_gbp_min: parseNumber(f.weekly_price_gbp_min),
      weekly_price_gbp_max: parseNumber(f.weekly_price_gbp_max),
      short_break_price_gbp_min: parseNumber(f.short_break_price_gbp_min),
      short_break_additional_day_price_gbp_min: parseNumber(
        f.short_break_additional_day_price_gbp_min
      ),
      minimum_stay_nights: parseNumber(f.minimum_stay_nights),
      short_break_allowed: parseCheckbox(f.short_break_allowed),
      min_short_break_duration: parseNumber(f.min_short_break_duration),
      changeover_days: parseText(f.changeover_days),
      weekly_blocks_only: parseCheckbox(f.weekly_blocks_only),

      // derived category booleans
      has_pool: parseCheckbox(f.has_pool),
      is_family_villa: parseCheckbox(f.is_family_villa),
      is_large_villa: parseCheckbox(f.is_large_villa),
      is_luxury_villa: parseCheckbox(f.is_luxury_villa),

      // granular feature booleans
      has_private_pool: parseCheckbox(f.has_private_pool),
      has_heated_pool: parseCheckbox(f.has_heated_pool),
      has_aircon: parseCheckbox(f.has_aircon),
      has_wifi: parseCheckbox(f.has_wifi),
      pets_on_request: parseCheckbox(f.pets_on_request),
      ideal_for_kids: parseCheckbox(f.ideal_for_kids),
      ideal_for_teens: parseCheckbox(f.ideal_for_teens),
      parking_space: parseCheckbox(f.parking_space),
      ev_charging: parseCheckbox(f.ev_charging),

      // geo
      latitude: parseNumber(f.latitude),
      longitude: parseNumber(f.longitude),

      // amenities
      amenities: amenitiesList.join(", "),
      amenities_list: amenitiesList,

      // terms / practical info
      terms_and_conditions_list: terms,
      security_deposit: parseText(f.security_deposit),
      arrival_time: parseText(f.arrival_time),
      departure_time: parseText(f.departure_time),
      minimum_stay_note: parseText(f.minimum_stay_note),
      pets_allowed_note: parseText(f.pets_allowed_note),
      pool_heating_note: parseText(f.pool_heating_note),
      pool_opening_dates_note: parseText(f.pool_opening_dates_note),
      smoking_allowed_note: parseText(f.smoking_allowed_note),
      end_of_stay_cleaning_note: parseText(f.end_of_stay_cleaning_note),
      other_ts_and_cs: parseText(f.other_ts_and_cs),

      // feed freshness
      availability_last_updated: parseText(f.availability_last_updated),
      pricing_last_updated: parseText(f.pricing_last_updated),
      last_update: parseText(f.last_update),
    };
  });

  console.log(`✅ Synced ${villas.length} villas`);
  return villas;
}
