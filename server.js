import express from "express";
import fs from "fs";
import cors from "cors";
import { syncVillas } from "./sync.js";

const app = express();
const PORT = process.env.PORT || 3000;
const VILLA_SECRET = process.env.VILLA_SECRET;

app.use(cors());

// health
app.get("/", (_req, res) => res.status(200).send("OK"));
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

// data endpoints
app.get("/villas", (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));
    res.json(data);
  } catch {
    res.status(503).json({ error: "No villas found (warming up)" });
  }
});

app.get("/villa/:id", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));
    const villa = data.find((v) => v.villa_id === req.params.id);
    if (!villa) return res.status(404).json({ error: "Villa not found" });
    res.json(villa);
  } catch {
    res.status(503).json({ error: "No villas found (warming up)" });
  }
});

app.get("/villas/filter", (req, res) => {
  try {
    const { tag, maxPrice } = req.query;
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));
    const filtered = data.filter((v) => {
      const t = tag ? v.availability_tags?.includes(tag) : true;
      const p = maxPrice ? Number(v.price_gbp) <= Number(maxPrice) : true;
      return t && p;
    });
    res.json(filtered);
  } catch {
    res.status(503).json({ error: "No villas found (warming up)" });
  }
});

// protected sync endpoint
app.post("/admin/sync", async (req, res) => {
  try {
    if (!VILLA_SECRET) return res.status(403).json({ error: "No sync secret set" });
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${VILLA_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

    await syncVillas();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully…");
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Villa API running on port ${PORT}`);
});
