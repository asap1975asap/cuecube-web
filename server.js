
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Env vars
const SS_API_KEY = process.env.SHIPSTATION_API_KEY;
const SS_API_SECRET = process.env.SHIPSTATION_API_SECRET;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/healthz', (_req,res)=>res.send('ok'));

app.post('/api/rates', async (req, res) => {
  try{
    if(!SS_API_KEY || !SS_API_SECRET){
      return res.status(500).json({error:"ShipStation credentials not configured"});
    }
    const to = req.body?.to || {};
    const pkg = req.body?.package || { weightLb: 10, dimIn: { length: 10, width: 10, height: 10 } };

    const shipment = {
      shipFrom: {
        name: "CueCube",
        company: "CueCube",
        street1: "11435 West Palmetto Park Rd.",
        street2: "Unit H",
        city: "Boca Raton",
        state: "FL",
        postalCode: "33428",
        country: "US",
        phone: "0000000000"
      },
      shipTo: {
        name: to.name || "Dealer",
        company: to.company || undefined,
        street1: to.address1,
        street2: to.address2 || undefined,
        city: to.city,
        state: to.state,
        postalCode: to.postalCode,
        country: to.country || "US",
        phone: to.phone || "0000000000"
      },
      packages: [
        {
          weight: { value: pkg.weightLb, units: "pounds" },
          dimensions: { units: "inches", length: pkg.dimIn?.length || 10, width: pkg.dimIn?.width || 10, height: pkg.dimIn?.height || 10 }
        }
      ]
    };

    const resp = await fetch('https://ssapi.shipstation.com/rates/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(SS_API_KEY + ':' + SS_API_SECRET).toString('base64')
      },
      body: JSON.stringify({ shipment })
    });

    if(!resp.ok){
      const text = await resp.text();
      return res.status(502).json({error:'ShipStation error', status: resp.status, body: text});
    }

    const data = await resp.json();
    const out = (Array.isArray(data) ? data : (data.rates || [])).map(r=> ({
      carrier: r.carrierCode || r.carrier || 'Carrier',
      service: r.serviceCode || r.serviceName || r.service,
      amount: Number(r.shipmentCost || r.amount || r.rate || 0),
      eta: r.deliveryDays ? (r.deliveryDays + ' days') : (r.guaranteedDeliveryDate || r.estimatedDeliveryDate || null)
    })).filter(r => !isNaN(r.amount));

    out.sort((a,b)=>a.amount-b.amount);
    res.json(out);
  }catch(err){
    res.status(500).json({error:'Proxy failure'});
  }
});

app.listen(PORT, ()=> console.log('CueCube server on :' + PORT));
