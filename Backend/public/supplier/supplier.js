// DOM Elements
const addModal = document.getElementById("addInventoryModal");
const editModal = document.getElementById("editInventoryModal");
const fab = document.querySelector(".add-inventory-container");
const inventoryContainer = document.querySelector(".inventory-item-container");
const addForm = document.getElementById("addInventoryForm");
const editItemName = document.getElementById("editItemName");
const editQuantityInput = document.getElementById("editQuantity");
const addQtyBtn = document.getElementById("addQtyBtn");
const subtractQtyBtn = document.getElementById("subtractQtyBtn");
const deleteItemBtn = document.getElementById("deleteItemBtn");

let selectedItem = null;

// Utility: Close modals
function closeModal() {
  addModal.style.display = "none";
}
function closeEditModal() {
  editModal.style.display = "none";
  editQuantityInput.value = "";
}

// Show add item modal
fab.addEventListener("click", () => {
  addModal.style.display = "flex";
});

//testing 2

//After coming from Login page this takes supplierId and fetches the orders...

document.addEventListener("DOMContentLoaded", async () => {
  const supplier = JSON.parse(localStorage.getItem("supplier"));
  const supplierId = supplier?._id;

  if (!supplierId) {
    console.error("Supplier not logged in.");
    return;
  }


     // Fetch orders and inventory for the supplier
      await fetchOrdersAndInventory(supplierId);
    

  // Function to fetch orders and inventory for the supplier
  async function fetchOrdersAndInventory(supplierId) {
      try {
          // Fetch orders
          const resOrders = await fetch(`/api/orders?supplierId=${supplierId}`);
          if (!resOrders.ok) {
              throw new Error("Failed to fetch orders");
          }
          const orders = await resOrders.json();
          console.log("Fetched orders:", orders);
          // Render orders here (implement rendering logic)
          // Fetch inventory items
          const resInventory = await fetch(`/api/suppliers/${supplierId}/inventory`);
          if (!resInventory.ok) {
              throw new Error("Failed to fetch inventory");
          }
          const inventoryItems = await resInventory.json();
          console.log("Fetched inventory items:", inventoryItems);
          // Render inventory items
          const inventoryContainer = document.querySelector(".inventory-item-container");
          inventoryContainer.innerHTML = ""; // Clear existing items if any
          inventoryItems.forEach(item => {
              const itemCard = createInventoryCard(item.itemName, item.quantity, item.imageUrl || ""); // Adjust as necessary
              inventoryContainer.appendChild(itemCard);
          });
      } catch (err) {
          console.error("Error fetching data:", err);
      }
    }

  

  

  
  // this is to get orders from the vendors to supplier
  try {
    const res = await fetch(`/api/orders?supplierId=${supplierId}`);
    const orders = await res.json();
    console.log("Fetched orders:", orders);
    const orderContainer = document.getElementById("orderContainer");

    if (orders.length === 0) {
      orderContainer.innerHTML = "<p>No orders yet.</p>";
      return;
    }

  

    
    
    const groupedOrders = {};

    orders.forEach((order) => {
      const vendorName = order.vendorId?.name || "Unknown Vendor";

      if (!groupedOrders[vendorName]) {
        groupedOrders[vendorName] = {
          date: new Date(order.date).toLocaleDateString(),
          items: [],
          total: 0,
        };
      }

      groupedOrders[vendorName].items.push({
        name: order.itemName,
        quantity: order.quantity,
        price: order.price,
      });

      groupedOrders[vendorName].total += order.quantity * order.price;
    });

    
    Object.entries(groupedOrders).forEach(([vendorName, data]) => {
      const itemsList = data.items
        .map((item) => `${item.name} (x${item.quantity})`)
        .join(", ");

      const orderDiv = document.createElement("div");
      orderDiv.className = "order-incoming";
      
      orderDiv.innerHTML = `
        <div class="first-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <div class="client-name" style="font-weight: bold; font-size: 18px; color: #333;">${vendorName}</div>
          <div class="status" style="font-size: 14px; color: #888;">${data.date}</div>
        </div>
        <div class="second-row" style="margin-bottom: 10px; font-size: 15px;">${itemsList}</div>
        <div class="third-row" style="font-weight: bold; font-size: 16px; color: green;">Total: ₹${data.total}</div>
        <div class="action-btn">
          <button type="button" class= "accept-btn" style=" border-radius: 10px; background-color: green; color: white; padding: 6px 12px;" >Accept</button>
          <button type="button" class= "reject-btn" style=" border-radius: 10px; background-color: red; color: white; padding: 6px 12px;">Reject</button>
          <button type="button" style=" border-radius: 10px; background-color: orange; color: white; padding: 6px 12px;" >Chat</button>
         </div>
      `;

      const acceptbtn = orderDiv.querySelector(".accept-btn");
      const rejectbtn = orderDiv.querySelector(".reject-btn");
      const buttoncontainer = orderDiv.querySelector(".action-btn");

      acceptbtn.addEventListener("click", () => {
        buttoncontainer.innerHTML = `<p style="font-weight: bold; color: green;">Accepted</p>`;
      });
      rejectbtn.addEventListener("click", () => {
        buttoncontainer.innerHTML = `<p style="font-weight: bold; color: red;">Rejected</p>`;
      });

      orderContainer.appendChild(orderDiv);
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
  }


  
});


addForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("itemName").value.trim();
  const quantity = parseInt(document.getElementById("itemQuantity").value);
  const imageFile = document.getElementById("itemImage").files[0];

  if (!name || isNaN(quantity)) {
    alert("Please fill all fields correctly!");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const imageUrl = event.target.result;
    const itemCard = createInventoryCard(name, quantity, imageUrl);
    inventoryContainer.appendChild(itemCard);
    addForm.reset();
    closeModal();
    alert("Item added!");
  };

  reader.readAsDataURL(imageFile);
});




//For posting the inventory items to the database

document.addEventListener("DOMContentLoaded", () => {
  const addInventoryForm = document.getElementById("addInventoryForm");

  const supplier = JSON.parse(localStorage.getItem("supplier"));
  if (!supplier || !supplier._id) {
    alert("Supplier not logged in!");
    return;
  }
  const supplierId = supplier._id;
  const name = supplier.name;

  addInventoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const itemName = document.getElementById("itemName").value.trim();
    const quantity = parseInt(document.getElementById("itemQuantity").value);
    const price = parseFloat(document.getElementById("itemPrice").value);

    const category = document.getElementById("itemCategory").value;
    
    const location = document.getElementById("itemLocation").value.trim();

    if (!itemName || isNaN(quantity) || isNaN(price) || !location) {
      alert("Please fill in all fields correctly.");
      return;
    }

    const inventory = { itemName, quantity, price, category };
    const newItem = { supplierId, name, inventory, location };

    console.log("New Item:", newItem);
    try {
      const response = await fetch(`/api/suppliers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) throw new Error("Failed to add item");

      const data = await response.json();
      console.log("Updated Supplier:", data);

      alert("Item added successfully!");
      addInventoryForm.reset();
      closeModal();

    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error adding item. Check console.");
    }
  });
});

// Create inventory card
function createInventoryCard(name, quantity, imageUrl) {
  const defaultImage = "./icons/items.jpg";
  const item = document.createElement("div");
  item.classList.add("item");

  const image = document.createElement("div");
  image.classList.add("item-pic");
  image.style.backgroundImage = `url(${imageUrl || defaultImage})`;
  image.style.backgroundSize = "cover";
  image.style.backgroundPosition = "center";
  image.style.borderRadius = "15px 15px 0 0";
  image.style.width = "248px";
  image.style.height = "169px";

  const nameDiv = document.createElement("div");
  nameDiv.classList.add("item-name");
  nameDiv.textContent = `${name} ${quantity}Qty`;
  nameDiv.style.width = "248px";
  nameDiv.style.height = "40px";

  item.appendChild(image);
  item.appendChild(nameDiv);

  return item;
}

// Handle inventory card clicks
inventoryContainer.addEventListener("click", function (e) {
  const card = e.target.closest(".item");
  if (!card) return;

  const nameDiv = card.querySelector(".item-name");
  if (!nameDiv) return;

  selectedItem = card;
  editItemName.textContent = nameDiv.textContent;
  editModal.style.display = "flex";
});

// Add quantity
addQtyBtn.addEventListener("click", () => {
  updateQuantity("add");
});

// Subtract quantity
subtractQtyBtn.addEventListener("click", () => {
  updateQuantity("subtract");
});

// Delete item
deleteItemBtn.addEventListener("click", () => {
  if (selectedItem) {
    selectedItem.remove();
    closeEditModal();
  }
});

// Quantity logic
function updateQuantity(type) {
  if (!selectedItem) return;

  const qtyChange = parseInt(editQuantityInput.value);
  if (isNaN(qtyChange) || qtyChange <= 0) {
    alert("Enter a valid quantity");
    return;
  }

  const nameDiv = selectedItem.querySelector(".item-name");
  if (!nameDiv) return;

  const [itemName, currentQtyText] = nameDiv.textContent.split(" ");
  let currentQty = parseInt(currentQtyText.replace("kg", ""));

  currentQty =
    type === "add"
      ? currentQty + qtyChange
      : Math.max(0, currentQty - qtyChange);

  nameDiv.textContent = `${itemName} ${currentQty}kg`;
  closeEditModal();
}
