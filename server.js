import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// GET all villas (master file)
app.get("/villas", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "No villas found" });
  }
});

// GET a single villa by ID
app.get("/villa/:id", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));
    const villa = data.find((v) => v.villa_id === req.params.id);
    if (!villa) return res.status(404).json({ error: "Villa not found" });
    res.json(villa);
  } catch (err) {
    res.status(500).json({ error: "No villas found" });
  }
});

// Filter by tag and/or price
app.get("/villas/filter", (req, res) => {
  try {
    const { tag, maxPrice } = req.query;
    const data = JSON.parse(fs.readFileSync("./villas.json", "utf-8"));

    const filtered = data.filter((villa) => {
      const matchTag = tag
        ? villa.availability_tags?.includes(tag)
        : true;
      const matchPrice = maxPrice
        ? villa.price_gbp <= parseFloat(maxPrice)
        : true;
      return matchTag && matchPrice;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Filter error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Villa API running on port ${PORT}`);
});
