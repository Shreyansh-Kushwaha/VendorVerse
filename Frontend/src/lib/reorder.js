import api from '../api.js';

// Rebuilds a cart line from a past order. The order only says what and from
// whom — price, name and unit are read off the live listing, the same way
// checkout does, so a reorder can never resurrect a stale price.
export async function reorderLine(order, cart) {
  const supplierId = order.supplierId?._id || order.supplierId;
  if (!supplierId) throw new Error('This supplier account no longer exists');

  const { data: inventory } = await api.get(`/suppliers/${supplierId}/inventory`);
  const item = (inventory || []).find((i) => String(i._id) === String(order.itemId));
  if (!item) throw new Error(`${order.itemName} is no longer listed by this supplier`);
  if (item.quantity < 1) throw new Error(`${item.itemName} is out of stock right now`);

  // Ask for what was ordered last time, capped by what is actually there.
  const qty = Math.min(order.quantity || 1, item.quantity);
  cart.add({
    itemId: item._id,
    itemName: item.itemName,
    price: item.price,
    unit: item.unit,
    imageUrl: item.imageUrl,
    supplierId,
    supplierName: order.supplierId?.name || '',
    location: order.supplierId?.location || '',
  }, qty);

  return { qty, item, priceChanged: item.price !== order.price };
}
