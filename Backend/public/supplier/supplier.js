// ===================================================================
// DOM Elements
// ===================================================================
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

// ===================================================================
// Utility Functions
// ===================================================================
function closeModal() {
  addModal.style.display = "none";
}

function closeEditModal() {
  editModal.style.display = "none";
  editQuantityInput.value = "";
}

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

// ===================================================================
// Main Application Logic (Runs after page has loaded)
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  const supplier = JSON.parse(localStorage.getItem("supplier"));
  const supplierId = supplier?._id;

  if (!supplierId) {
    console.error("Supplier not logged in.");
    // Optional: redirect to login page
    // window.location.href = '/login.html';
    return;
  }

  // --- Initial Data Fetching ---
  fetchOrdersAndInventory(supplierId);
  fetchAndDisplayOrders(supplierId);

  // --- Event Listeners Setup ---
  fab.addEventListener("click", () => {
    addModal.style.display = "flex";
  });

  inventoryContainer.addEventListener("click", function (e) {
    const card = e.target.closest(".item");
    if (!card) return;

    const nameDiv = card.querySelector(".item-name");
    if (!nameDiv) return;

    selectedItem = card;
    editItemName.textContent = nameDiv.textContent;
    editModal.style.display = "flex";
  });

  addQtyBtn.addEventListener("click", () => updateQuantity("add"));
  subtractQtyBtn.addEventListener("click", () => updateQuantity("subtract"));
  deleteItemBtn.addEventListener("click", () => {
    if (selectedItem) {
      selectedItem.remove();
      closeEditModal();
    }
  });


  // ===================================================================
  // ## THE CORRECT, COMBINED FORM SUBMISSION HANDLER ##
  // This single listener replaces the two old ones.
  // ===================================================================
  addForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // STEP 1: Get all data from the form
    const itemName = document.getElementById("itemName").value.trim();
    const quantity = parseInt(document.getElementById("itemQuantity").value);
    const price = parseFloat(document.getElementById("itemPrice").value);
    const category = document.getElementById("itemCategory").value;
    const location = document.getElementById("itemLocation").value.trim();
    const imageFile = document.getElementById("itemImage").files[0];

    if (!itemName || isNaN(quantity) || isNaN(price) || !location || !imageFile) {
      alert("Please fill in all fields and select an image.");
      return;
    }

    // STEP 2: Upload the image to get the URL
    let cloudinaryImageUrl = "";
    try {
      console.log("Uploading image...");
      const imageFormData = new FormData();
      imageFormData.append('myImage', imageFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: imageFormData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Image upload failed! Check the server for errors.');
      }

      const uploadData = await uploadResponse.json();
      cloudinaryImageUrl = uploadData.imageUrl;
      console.log("Image uploaded successfully. URL:", cloudinaryImageUrl);

    } catch (error) {
      console.error("Error during image upload:", error);
      alert("Could not upload the image. Please try again.");
      return; // Stop if the upload fails
    }

    // STEP 3: Save the complete item data (with the new URL) to the database
    try {
      console.log("Saving new item to database...");

      const inventory = { itemName, quantity, price, category, imageUrl: cloudinaryImageUrl };
      const newItem = {
        supplierId: supplier._id,
        name: supplier.name,
        inventory,
        location
      };

      const response = await fetch(`/api/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) throw new Error("Failed to save the item.");

      // STEP 4: Update the UI on final success
      const itemCard = createInventoryCard(itemName, quantity, cloudinaryImageUrl);
      inventoryContainer.appendChild(itemCard);

      alert("Item added successfully!");
      addForm.reset();
      closeModal();

    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error adding item. Check the console for details.");
    }
  });


  // ===================================================================
  // Async Data Fetching Functions
  // ===================================================================

  // Function to fetch and display inventory
  async function fetchOrdersAndInventory(supplierId) {
    try {
      const resInventory = await fetch(`/api/suppliers/${supplierId}/inventory`);
      if (!resInventory.ok) {
        throw new Error("Failed to fetch inventory");
      }
      const inventoryItems = await resInventory.json();
      console.log("Fetched inventory items:", inventoryItems);
      
      inventoryContainer.innerHTML = ""; // Clear existing items
      inventoryItems.forEach(item => {
        const itemCard = createInventoryCard(item.itemName, item.quantity, item.imageUrl || "");
        inventoryContainer.appendChild(itemCard);
      });
    } catch (err) {
      console.error("Error fetching inventory data:", err);
    }
  }

  // Function to fetch and display orders
  async function fetchAndDisplayOrders(supplierId) {
    try {
      const res = await fetch(`/api/orders?supplierId=${supplierId}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const orders = await res.json();
      console.log("Fetched orders:", orders);
      
      const orderContainer = document.getElementById("orderContainer");
      orderContainer.innerHTML = ""; // Clear existing orders

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
        const itemsList = data.items.map((item) => `${item.name} (x${item.quantity})`).join(", ");
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
            <button type="button" class="accept-btn" style="border-radius: 10px; background-color: green; color: white; padding: 6px 12px;">Accept</button>
            <button type="button" class="reject-btn" style="border-radius: 10px; background-color: red; color: white; padding: 6px 12px;">Reject</button>
            <button type="button" style="border-radius: 10px; background-color: orange; color: white; padding: 6px 12px;">Chat</button>
          </div>`;
        
        const acceptBtn = orderDiv.querySelector(".accept-btn");
        const rejectBtn = orderDiv.querySelector(".reject-btn");
        const buttonContainer = orderDiv.querySelector(".action-btn");

        acceptBtn.addEventListener("click", () => {
          buttonContainer.innerHTML = `<p style="font-weight: bold; color: green;">Accepted</p>`;
          updateOrderStatus(supplierId, { "status": "Accepted" });
        });
        rejectBtn.addEventListener("click", () => {
          buttonContainer.innerHTML = `<p style="font-weight: bold; color: red;">Rejected</p>`;
          updateOrderStatus(supplierId, { "status": "Rejected" });
        });
        orderContainer.appendChild(orderDiv);
      });
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  }

  // Helper function to update order status
  async function updateOrderStatus(supplierId, status) {
    try {
      const response = await fetch(`/api/orders?supplierId=${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status)
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log('Update successful:', data);
    } catch (error) {
      console.error('Error during update:', error);
    }
  }
});