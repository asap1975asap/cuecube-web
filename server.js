// server.js
// CueCube API backend (ShipStation USPS + FedEx)
// Домен: https://cuecube-api.onrender.com

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

/**
 * Адрес склада CueCube (отправитель)
 */
const FROM_ADDRESS = {
  postalCode: "33428",
  country: "US",
  state: "FL",
  city: "Boca Raton"
};

/**
 * Коробка по умолчанию:
 * 10x10x10 inches, 10 lb
 */
const DEFAULT_PACKAGE = {
  weight: { value: 10, units: "pounds" },
  dimensions: {
    units: "inches",
    length: 10,
    width: 10,
    height: 10
  },
  confirmation: "delivery",
  residential: true
};

/**
 * Разрешенные origin’ы для CORS
 * (твой фронт на Render + локальная разработка)
 */
const ALLOWED_ORIGINS = [
  "https://cuecube-web.onrender.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000"
];

// USPS + FedEx
const CARRIERS = ["stamps_com", "fedex"];

// ---------- MIDDLEWARE ----------

app.use(express.json());

app.use(
  cors({
    origin(origin, callback) {
      // Разрешаем запросы без origin (Postman, curl) + указанные домены
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);

// Простой healthcheck
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "cuecube-api",
    time: new Date().toISOString()
  });
});

// ---------- ShipStation helpers ----------

function getShipStationAuthHeader() {
  const key = process.env.SHIPSTATION_KEY;
  const secret = process.env.SHIPSTATION_SECRET;

  if (!key || !secret) {
    throw new Error("Missing SHIPSTATION_KEY or SHIPSTATION_SECRET env vars");
  }

  const token = Buffer.from(`${key}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Запрос тарифов к ShipStation для конкретного carrierCode
 */
async function getRatesForCarrier(carrierCode, shipment) {
  const url = "https://ssapi.shipstation.com/shipments/getrates";

  const response = await axios.post(url, { ...shipment, carrierCode }, {
    headers: {
      Authorization: getShipStationAuthHeader(),
      "Content-Type": "application/json"
    },
    timeout: 15000
  });

  return response.data || [];
}

// ---------- /rates endpoint ----------

/**
 * POST /rates
 *
 * Body:
 * {
 *   "toPostalCode": "33442",
 *   "toState": "FL",
 *   "toCity": "Deerfield Beach",
 *   "toCountry": "US",        // опционально, по умолчанию US
 *   "residential": true       // опционально
 * }
 *
 * Ответ:
 * {
 *   "success": true,
 *   "rates": [
 *     {
 *       "carrierCode": "stamps_com",
 *       "serviceCode": "usps_priority_mail",
 *       "serviceName": "USPS Priority Mail",
 *       "shipmentCost": 12.34,
 *       "otherCost": 0,
 *       "totalCost": 12.34,
 *       "deliveryDays": null,
 *       "guaranteedDeliveryDate": null
 *     },
 *     ...
 *   ]
 * }
 */
app.post("/rates", async (req, res) => {
  try {
    const {
      toPostalCode,
      toState,
      toCity,
      toCountry = "US",
      residential
    } = req.body || {};

    if (!toPostalCode || !toState || !toCity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: toPostalCode, toState, toCity"
      });
    }

    const shipment = {
      // FROM
      fromPostalCode: FROM_ADDRESS.postalCode,
      fromState: FROM_ADDRESS.state,
      fromCountry: FROM_ADDRESS.country,
      fromCity: FROM_ADDRESS.city,

      // TO
      toPostalCode: String(toPostalCode),
      toState: String(toState),
      toCountry: String(toCountry || "US"),
      toCity: String(toCity),

      // Вес и габариты
      weight: DEFAULT_PACKAGE.weight,
      dimensions: DEFAULT_PACKAGE.dimensions,

      confirmation: DEFAULT_PACKAGE.confirmation,
      residential:
        typeof residential === "boolean"
          ? residential
          : DEFAULT_PACKAGE.residential,

      packageCode: null,
      serviceCode: null
    };

    // Дёргаем ShipStation для USPS + FedEx параллельно
    const results = await Promise.allSettled(
      CARRIERS.map((code) => getRatesForCarrier(code, shipment))
    );

    const allRates = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const carrierRates = result.value || [];
        carrierRates.forEach((r) => {
          allRates.push({
            carrierCode: r.carrierCode,
            serviceCode: r.serviceCode,
            serviceName: r.serviceName,
            shipmentCost: r.shipmentCost,
            otherCost: r.otherCost,
            totalCost:
              (typeof r.shipmentCost === "number" ? r.shipmentCost : 0) +
              (typeof r.otherCost === "number" ? r.otherCost : 0),
            deliveryDays: r.deliveryDays ?? null,
            guaranteedDeliveryDate: r.guaranteedDeliveryDate ?? null
          });
        });
      } else {
        console.error(
          "ShipStation getrates error for",
          CARRIERS[index],
          result.reason?.message
        );
      }
    });

    if (!allRates.length) {
      return res.status(502).json({
        success: false,
        error: "Could not load rates from ShipStation"
      });
    }

    // Сортировка по цене (дешёвые наверх)
    allRates.sort((a, b) => a.totalCost - b.totalCost);

    res.json({ success: true, rates: allRates });
  } catch (err) {
    console.error("Error in /rates:", err.message);
    res.status(500).json({
      success: false,
      error: "Internal error requesting ShipStation rates"
    });
  }
});

// ---------- START ----------

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CueCube API listening on port ${PORT}`);
});
