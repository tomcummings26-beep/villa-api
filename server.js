// server.js
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { syncVillas } from "./sync.js";

const app = express();
const PORT = process.env.PORT || 3000;
const VILLA_SECRET = process.env.VILLA_SECRET;

app.use(cors());

// in-memory cache
let VILLAS = [];
let lastSync = null;

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

// health
app.get("/", (_req, res) => res.status(200).send("OK"));
app.get("/healthz", (_req, res) =>
  res.status(200).json({ status: "ok", lastSync, count: VILLAS.length })
);

// data endpoints (serve from memory)
app.get("/villas", (_req, res) => {
  if (!VILLAS.length) return res.status(503).json({ error: "No villas (warming up)" });
  res.json(VILLAS);
});

app.get("/villa/:id", (req, res) => {
  if (!VILLAS.length) return res.status(503).json({ error: "No villas (warming up)" });
  const v = VILLAS.find((x) => x.villa_id === req.params.id);
  if (!v) return res.status(404).json({ error: "Villa not found" });
  res.json(v);
});

app.get("/villas/filter", (req, res) => {
  if (!VILLAS.length) return res.status(503).json({ error: "No villas (warming up)" });
  const { tag, maxPrice } = req.query;
  const out = VILLAS.filter((v) => {
    const t = tag ? v.availability_tags?.includes(tag) : true;
    const p = maxPrice ? Number(v.price_gbp) <= Number(maxPrice) : true;
    return t && p;
  });
  res.json(out);
});

// admin on-demand sync
app.post("/admin/sync", async (req, res) => {
  const auth = req.headers["authorization"] || "";
  if (!VILLA_SECRET) return res.status(403).json({ error: "No VILLA_SECRET set" });
  if (auth !== `Bearer ${VILLA_SECRET}`) return res.status(401).json({ error: "Unauthorized" });
  await refresh("manual");
  res.json({ ok: true, lastSync, count: VILLAS.length });
});

// start server
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Villa API running on port ${PORT}`);
  await refresh("startup"); // warm up once

  // schedule nightly refresh at 01:30 UTC
  cron.schedule("30 1 * * *", () => {
    refresh("cron");
  });
});

