let storedPassword = "password123"; // Hidden password (you can connect this to backend later)

function toggleEdit() {
    const form = document.getElementById('editForm');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';

    // Pre-fill values from displayed data
    document.getElementById('editName').value = document.getElementById('name').textContent;
    document.getElementById('editEmail').value = document.getElementById('email').textContent;
    document.getElementById('editLocation').value = document.getElementById('location').textContent;
    document.getElementById('editBusiness').value = document.getElementById('business').textContent;
    document.getElementById('editPassword').value = '';
}

function saveProfile() {
    document.getElementById('name').textContent = document.getElementById('editName').value;
    document.getElementById('email').textContent = document.getElementById('editEmail').value;
    document.getElementById('location').textContent = document.getElementById('editLocation').value;
    document.getElementById('business').textContent = document.getElementById('editBusiness').value;

    const newPassword = document.getElementById('editPassword').value;
    if (newPassword.trim() !== '') {
        storedPassword = newPassword; // Update password
        alert("Password updated successfully!");
    }

    document.getElementById('editForm').style.display = 'none';
}
