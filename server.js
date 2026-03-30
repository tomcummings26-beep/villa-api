import express from "express";
import cors from "cors";
import cron from "node-cron";
import fetch from "node-fetch";
import { syncVillas } from "./sync.js";

const app = express();
const PORT = process.env.PORT || 3000;
const VILLA_SECRET = process.env.VILLA_SECRET;
const OT_API_KEY = process.env.OT_API_KEY;

app.use(cors());

// in-memory cache
let VILLAS = [];
let lastSync = null;

// --- Oliver's Travels live helpers ---
async function fetchDwellingDetailsLive(id) {
  const res = await fetch(`https://feeds.oliverstravels.com/v1/dwellings/${id}.json`, {
    headers: {
      "X-Affiliate-Authentication": OT_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`OT details error: ${res.status}`);
  }

  const json = await res.json();
  return json?.data?.[0] || null;
}

async function fetchAvailabilityLive(id) {
  const res = await fetch(
    `https://feeds.oliverstravels.com/v1/dwellings/${id}/availability.json`,
    {
      headers: {
        "X-Affiliate-Authentication": OT_API_KEY,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`OT availability error: ${res.status}`);
  }

  const json = await res.json();
  return json?.data || [];
}

// --- Refresh cache from Airtable ---
async function refresh(reason = "startup") {
  try {
    console.log(`🚀 Starting villa sync... (${reason})`);

    const data = await syncVillas();

    VILLAS = data;
    lastSync = new Date().toISOString();

    console.log(`✅ Refreshed ${VILLAS.length} villas (${reason})`);
  } catch (e) {
    console.error("❌ Refresh failed:", e.message);
  }
}

// --- health endpoints ---
app.get("/", (_req, res) => res.status(200).send("OK"));

app.get("/healthz", (_req, res) =>
  res.status(200).json({
    status: "ok",
    lastSync,
    count: VILLAS.length,
  })
);

// --- return all villas ---
app.get("/villas", (req, res) => {
  if (!VILLAS.length) {
    return res.status(503).json({ error: "No villas (warming up)" });
  }

  // optional lightweight mode
  if (req.query.lite === "true") {
    const lite = VILLAS.map((v) => ({
      villa_id: v.villa_id,
      name: v.name,
      region: v.region,
      sub_region: v.sub_region,
      country: v.country,
      capacity: v.capacity,
      bedrooms: v.bedrooms,
      main_photo: v.main_photo,
      price_gbp_min: v.price_gbp_min,
      price_gbp_max: v.price_gbp_max,
    }));

    return res.json(lite);
  }

  res.json(VILLAS);
});

// --- single villa ---
app.get("/villa/:id", (req, res) => {
  if (!VILLAS.length) {
    return res.status(503).json({ error: "No villas (warming up)" });
  }

  const v = VILLAS.find((x) => String(x.villa_id) === String(req.params.id));

  if (!v) {
    return res.status(404).json({ error: "Villa not found" });
  }

  res.json(v);
});

// --- live OT availability + pricing ---
app.get("/villa/:id/live", async (req, res) => {
  try {
    if (!OT_API_KEY) {
      return res.status(500).json({ error: "OT_API_KEY not configured" });
    }

    const id = req.params.id;

    const [details, availability] = await Promise.all([
      fetchDwellingDetailsLive(id),
      fetchAvailabilityLive(id),
    ]);

    if (!details) {
      return res.status(404).json({ error: "Villa not found in OT feed" });
    }

    res.json({
      villa_id: details.id,
      availability_last_updated: details.availability_last_updated || "",
      pricing_last_updated: details.pricing_last_updated || "",
      availability,
      rates: details.rates || [],
    });
  } catch (err) {
    console.error("❌ Live villa endpoint error:", err.message);
    res.status(500).json({ error: "Failed to fetch live villa data" });
  }
});

// --- filtering endpoint ---
app.get("/villas/filter", (req, res) => {
  if (!VILLAS.length) {
    return res.status(503).json({ error: "No villas (warming up)" });
  }

  const {
    tag,
    maxPrice,
    region,
    sub_region,
    has_pool,
    has_heated_pool,
    has_aircon,
    pets_on_request,
    is_family_villa,
    is_large_villa,
    is_luxury_villa,
    minCapacity,
    minBedrooms,
    amenity,
  } = req.query;

  const toBool = (val) => val === "true";

  const out = VILLAS.filter((v) => {
    const matchesTag = tag ? v.availability_tags?.includes(tag) : true;

    const matchesMaxPrice = maxPrice
      ? Number(v.price_gbp || 0) <= Number(maxPrice)
      : true;

    const matchesRegion = region
      ? String(v.region || "").toLowerCase() === String(region).toLowerCase()
      : true;

    const matchesSubRegion = sub_region
      ? String(v.sub_region || "").toLowerCase() === String(sub_region).toLowerCase()
      : true;

    const matchesPool = has_pool ? v.has_pool === toBool(has_pool) : true;

    const matchesHeatedPool = has_heated_pool
      ? v.has_heated_pool === toBool(has_heated_pool)
      : true;

    const matchesAircon = has_aircon
      ? v.has_aircon === toBool(has_aircon)
      : true;

    const matchesPets = pets_on_request
      ? v.pets_on_request === toBool(pets_on_request)
      : true;

    const matchesFamily = is_family_villa
      ? v.is_family_villa === toBool(is_family_villa)
      : true;

    const matchesLarge = is_large_villa
      ? v.is_large_villa === toBool(is_large_villa)
      : true;

    const matchesLuxury = is_luxury_villa
      ? v.is_luxury_villa === toBool(is_luxury_villa)
      : true;

    const matchesCapacity = minCapacity
      ? Number(v.capacity || 0) >= Number(minCapacity)
      : true;

    const matchesBedrooms = minBedrooms
      ? Number(v.bedrooms || 0) >= Number(minBedrooms)
      : true;

    const matchesAmenity = amenity
      ? v.amenities_list?.some(
          (a) =>
            a.toLowerCase() === String(amenity).trim().toLowerCase()
        )
      : true;

    return (
      matchesTag &&
      matchesMaxPrice &&
      matchesRegion &&
      matchesSubRegion &&
      matchesPool &&
      matchesHeatedPool &&
      matchesAircon &&
      matchesPets &&
      matchesFamily &&
      matchesLarge &&
      matchesLuxury &&
      matchesCapacity &&
      matchesBedrooms &&
      matchesAmenity
    );
  });

  res.json(out);
});

// --- manual admin sync ---
app.post("/admin/sync", async (req, res) => {
  const auth = req.headers["authorization"] || "";

  if (!VILLA_SECRET) {
    return res.status(403).json({ error: "No VILLA_SECRET set" });
  }

  if (auth !== `Bearer ${VILLA_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await refresh("manual");

  res.json({
    ok: true,
    lastSync,
    count: VILLAS.length,
  });
});

// --- start server ---
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Villa API running on port ${PORT}`);

  await refresh("startup");

  // nightly refresh
  cron.schedule("03 19 * * *", () => {
    refresh("cron");
  });
});
