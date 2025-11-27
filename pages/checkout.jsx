
import React, { useState } from 'react';
import ShippingSelector from '../components/ShippingSelector';

export default function Checkout() {
  const [rates, setRates] = useState([]);
  const [selected, setSelected] = useState(null);

  async function fetchRates() {
    const res = await fetch('http://localhost:4000/api/shipping/rates', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        address:{state:'FL', country:'US', postalCode:'33428'},
        weightOz:16
      })
    });
    setRates(await res.json());
  }

  return (
    <div>
      <h2>Checkout</h2>
      <button onClick={fetchRates}>Load Shipping Rates</button>
      <ShippingSelector rates={rates} onSelect={setSelected} />
      {selected && <p>Selected: {selected.serviceName}</p>}
    </div>
  );
}
