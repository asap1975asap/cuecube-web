
import React from 'react';

export default function ShippingSelector({ rates, onSelect }) {
  return (
    <div>
      <h3>Shipping Methods</h3>
      {rates.map((r, i) => (
        <label key={i} style={{display:'block',marginBottom:'8px'}}>
          <input type="radio" name="ship" onChange={() => onSelect(r)} />
          {r.serviceName} - ${r.shipmentCost} (ETA: {r.deliveryDate})
        </label>
      ))}
    </div>
  );
}
