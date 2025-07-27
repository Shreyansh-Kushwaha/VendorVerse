  document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const vendorId = user._id;
    document.getElementById("vendorName").innerText = user.name;

    // Fetch My Orders
    try {
      const res = await fetch(`/api/vendor/request?vendorId=${vendorId}`);
      const orders = await res.json();
      const ordersList = document.getElementById("orders");
      orders.forEach((order, i) => {
        const li = document.createElement("li");
        li.textContent = `#${1000 + i} – ${i === 0 ? "Out for delivery " : "Delivered "}`;
        ordersList.appendChild(li);
      });
    } catch (err) {
      console.error("Error loading orders:", err);
    }

    // Fetch Supplier Deals
    try {
      let count = 0;
      const res = await fetch("/api/suppliers");
      const suppliers = await res.json();
      const dealsList = document.getElementById("deals");

      suppliers.some(supplier => {
        return supplier.inventory.some(item => {
          if (count >= 4) return true; // break inner loop
          const li = document.createElement("li");
          li.textContent = `${item.itemName} ₹${item.price}/${item.itemName === "Oil" ? "L" : "kg"} – From ${supplier.name}`;
          dealsList.appendChild(li);
          count++;
          return false;
        });
      });
    } catch (err) {
      console.error("Error loading deals:", err);
    }
  });

// this is for filtering the items
function filterTable() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toLowerCase();
  const table = document.getElementById("itemTable");
  const rows = table.getElementsByTagName("tr");

  // Loop through all rows except the header
  for (let i = 1; i < rows.length; i++) {
    const itemCell = rows[i].getElementsByTagName("td")[0]; // 1st column: Item
    if (itemCell) {
      const txtValue = itemCell.textContent || itemCell.innerText;
      rows[i].style.display = txtValue.toLowerCase().includes(filter) ? "" : "none";
    }
  }
}


// this should fetch all the item list with prices
async function loadSupplierItems() {
  try {
    const res = await fetch("/api/suppliers");
    const suppliers = await res.json();

    console.log("Suppliers data:", suppliers);

    const tableBody = document.getElementById("tableBody");
    tableBody.innerHTML = ""; // Clear old rows

    suppliers.forEach(supplier => {
      const supplierName = supplier.name;
      const location = supplier.location || "Unknown";

      supplier.inventory.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td class="border px-4 py-2">${item.itemName}</td>
          <td class="border px-4 py-2">₹${item.price}</td>
          <td class="border px-4 py-2">${supplierName}</td>
          <td class="border px-4 py-2">${location}</td>
          <td class="border px-4 py-2 text-center">
            <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs" 
            onclick="orderItem('${supplier.supplierId}', '${item._id}', '${item.itemName}', ${item.price})"
            >
             

              Order
            </button>
          </td>
        `;


        tableBody.appendChild(row);
      });
    });
  } catch (err) {
    console.error("Error fetching supplier data:", err);
  }
}

// this is ofr ordering the item..

async function orderItem(supplierId, itemId, itemName, price) {
  const vendor = JSON.parse(localStorage.getItem("user")); // assumes vendor info is stored in localStorage
  const vendorId = vendor?._id;

  if (!vendorId) {
    alert(" You must be logged in as a vendor to place an order.");
    return;
  }

  const quantityInput = prompt(`Enter quantity for ${itemName}:`);
  const quantity = parseInt(quantityInput);

  if (!quantity || isNaN(quantity) || quantity <= 0) {
    alert("⚠️ Please enter a valid quantity.");
    return;
  }

  const orderData = {
    vendorId,
    supplierId,
    itemId,
    itemName,
    quantity,
    price
  };

  console.log("Order data:", orderData);

  try {
    const res = await fetch('/api/placeOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const data = await res.json();
    console.log("Order response:", data);

    if (res.ok) {
      alert(" Order placed successfully!");
      console.log("Order response:", data);

      const myOrders = document.getElementById("orders");
      const li = document.createElement("li");
      li.textContent = ` ${itemName} ₹${price}/${itemName === "Oil" ? "L" : "kg"} `;
      myOrders.appendChild(li);
    } else {
      alert(" Failed to place order: " + data.message);
    }
  } catch (error) {
    console.error(" Error placing order:", error);
    alert("Something went wrong while placing the order.");
  }
}




// Call the function on page load
window.onload = loadSupplierItems;
