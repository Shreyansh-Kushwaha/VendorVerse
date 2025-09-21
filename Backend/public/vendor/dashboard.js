  document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    let allItems = [];
    const vendorId = user._id;
    document.getElementById("vendorName").innerText = user.name;

    // Fetch My Orders
    const res = await fetch(`/api/vendor/orders?vendorId=${vendorId}`);
    const orders = await res.json();
    console.log(orders);

    const ordersList = document.getElementById("orders");
    ordersList.innerHTML = "";

    orders.forEach(order => {
      const li = document.createElement("li");
      li.textContent = `${order?.itemName} – ₹${order?.price}, Qty: ${order?.quantity} – Supplier: ${order?.supplierId?.name} – ${order.status}`;
      ordersList.appendChild(li);
    });
    


    // Fetch Supplier Deals
    try {
      let count = 0;t = 0;
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
  const searchValue = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allItems.filter(item =>
    item.itemName.toLowerCase().includes(searchValue)
  );
  renderTable(filtered);
}
function renderTable(data) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No items found</td></tr>`;
    return;
  }

  data.forEach(item => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="border px-4 py-2">${item.itemName}</td>
      <td class="border px-4 py-2">₹${item.price}</td>
      <td class="border px-4 py-2">${item.supplierName}</td>
      <td class="border px-4 py-2">${item.location}</td>
      <td class="border px-4 py-2 text-center">
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs" 
          onclick="orderItem('${item.supplierId}', '${item.itemId}', '${item.itemName}', ${item.price})"
        >
          Order
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}



// this should fetch all the item list with prices
async function loadSupplierItems() {
  try {
    const res = await fetch("/api/suppliers");
    const suppliers = await res.json();

    console.log("Suppliers data:", suppliers);

    allItems = []; // Reset global items list

    suppliers.forEach(supplier => {
      const supplierName = supplier.name;
      const location = supplier.location || "Unknown";

      supplier.inventory.forEach(item => {
        allItems.push({
          itemId: item._id,
          itemName: item.itemName,
          price: item.price,
          category: item.category || "others",
          supplierId: supplier.supplierId,
          supplierName: supplierName,
          location: location
        });
      });
    });

    renderTable(allItems); // Initially show all
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


// category filter method here ....

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("categoryButtons").addEventListener("click", (e) => {
    if (e.target.classList.contains("category-btn")) {
      const selectedCategory = e.target.dataset.category.toLowerCase();

      if (selectedCategory === "all") {
        renderTable(allItems); // Show all items
      } else {
        const filteredItems = allItems.filter(item =>
          item.category?.toLowerCase() === selectedCategory
        );
        renderTable(filteredItems);
      }
    }
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  window.location.href = "/home.html";
});




// Call the function on page load
window.onload = loadSupplierItems;
