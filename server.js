const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ShipStation credentials must be set as environment variables
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
  console.warn("WARNING: ShipStation API credentials are not set. Shipping rate lookup will fail.");
}

app.use(express.json());

// Serve static files (frontend)
app.use(express.static(__dirname));

// Simple helper for ShipStation auth header
function getShipStationAuthHeader() {
  const token = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

// Proxy endpoint: calculate shipping rates via ShipStation
app.post("/api/shipping-rates", async (req, res) => {
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    return res.status(500).json({ error: "ShipStation API is not configured on the server." });
  }

  const { toCity, toState, toPostalCode, toCountry } = req.body || {};

  if (!toPostalCode || !toCountry) {
    return res.status(400).json({ error: "Destination ZIP/postal code and country are required." });
  }

  // Default from address: 11435 West Palmetto Park Rd. Unit H, 33428 FL
  const fromAddress = {
    postalCode: "33428",
    city: "Boca Raton",
    state: "FL",
    country: "US"
  };

  // For now every order is 10x10x10 in, 10 lb
  const payload = {
    carrierCode: null, // null = let ShipStation return all available services
    fromPostalCode: fromAddress.postalCode,
    fromCity: fromAddress.city,
    fromState: fromAddress.state,
    fromCountry: fromAddress.country,
    toPostalCode,
    toCity: toCity || "",
    toState: toState || "",
    toCountry,
    weight: {
      value: 10,
      units: "pounds"
    },
    dimensions: {
      length: 10,
      width: 10,
      height: 10,
      units: "inches"
    },
    confirmation: "delivery",
    residential: true
  };

  try {
    const resp = await fetch("https://ssapi.shipstation.com/shipments/getrates", {
      method: "POST",
      headers: {
        "Authorization": getShipStationAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("ShipStation error:", data);
      return res.status(502).json({ error: "ShipStation returned an error", details: data });
    }

    const rates = (Array.isArray(data) ? data : []).map(rate => {
      const shipmentCost = Number(rate.shipmentCost || 0);
      const otherCost = Number(rate.otherCost || 0);
      const totalCost = shipmentCost + otherCost;
      return {
        carrier: rate.carrierFriendlyName || rate.carrierCode,
        serviceName: rate.serviceName,
        serviceCode: rate.serviceCode,
        shipmentCost,
        otherCost,
        totalCost,
        currency: "USD",
        deliveryDays: rate.deliveryDays,
        guaranteedService: !!rate.guaranteedService
      };
    }).sort((a, b) => a.totalCost - b.totalCost);

    return res.json({ rates });
  } catch (err) {
    console.error("Error talking to ShipStation:", err);
    return res.status(500).json({ error: "Failed to fetch rates from ShipStation." });
  }
});

// Fallback: serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`CueCube wholesale site with ShipStation running on port ${PORT}`);
});
