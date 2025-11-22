# CueCube Wholesale (ShipStation)

- Logo added to header (image: `public/img/logo-cuecube.png`)
- Login page leaves fields **empty** on first visit (browser can autofill later).
- Demo credentials (local-only): `demo@cuecube.com` / `Qwerty142536`
- Products + cart + modal gallery
- Checkout with **ShipStation live rates** via server proxy

## Run locally
```bash
npm install
SHIPSTATION_API_KEY=your_key SHIPSTATION_API_SECRET=your_secret npm start
# open http://localhost:3000
```

## Render.com
- Language: **Node**
- Build: `npm install`
- Start: `node server.js`
- Add Environment Variables:
  - `SHIPSTATION_API_KEY`
  - `SHIPSTATION_API_SECRET`

## API
`POST /api/rates`

Body:
```json
{
  "toAddress": {
    "name":"John",
    "street1":"1 Main St", "city":"Miami", "state":"FL", "postalCode":"33101", "country":"US"
  },
  "parcel": { "length":10, "width":10, "height":10, "weightLbs":10 }
}
```

The server calls ShipStation's **/shipments/rates** and returns a list of rates.
