// Minimal Express server with ShipStation rates proxy
const express = require("express");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Health
app.get("/healthz", (_, res) => res.json({ ok: true }));

// ShipStation live rates proxy
// Expects: { toAddress: {...}, parcel: { length, width, height, weightLbs } }
app.post("/api/rates", async (req, res) => {
  try {
    const { toAddress, parcel } = req.body || {};
    if (!toAddress || !parcel) {
      return res.status(400).json({ error: "Missing toAddress or parcel" });
    }

    const from = {
      name: "CueCube",
      street1: "11435 West Palmetto Park Rd.",
      street2: "Unit H",
      city: "Boca Raton",
      state: "FL",
      postalCode: "33428",
      country: "US"
    };

    const shipment = {
      // Not specifying carrierCode allows ShipStation to return all connected carriers (where supported)
      fromPostalCode: from.postalCode,
      fromCity: from.city,
      fromState: from.state,
      fromCountry: from.country,
      toPostalCode: String(toAddress.postalCode || ""),
      toCity: toAddress.city || "",
      toState: toAddress.state || "",
      toCountry: toAddress.country || "US",
      weight: { value: Number(parcel.weightLbs || 10), units: "pounds" },
      dimensions: {
        units: "inches",
        length: Number(parcel.length || 10),
        width: Number(parcel.width || 10),
        height: Number(parcel.height || 10),
      },
      confirmation: "none",
      residential: true
    };

    const apiKey = process.env.SHIPSTATION_API_KEY;
    const apiSecret = process.env.SHIPSTATION_API_SECRET;
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: "Server missing ShipStation API credentials" });
    }
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    // Attempt the official "Rates" endpoint
    const url = "https://ssapi.shipstation.com/shipments/rates";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify(shipment)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.Message || "ShipStation request failed", detail: data });
    }
    // Expecting an array of rates
    const rates = Array.isArray(data) ? data : (data?.rates || []);
    return res.json({ rates });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Fallback to index
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
