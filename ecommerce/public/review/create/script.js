// Create a review.
// All the rules (bought the product, order completed, one review per
// product, rating 1-5, text not empty) are checked by the create_review
// stored procedure. This page only sends the form and shows the result.

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/auth/login";
        return;
    }
    const username = localStorage.getItem("username") || "User";
    document.getElementById("navUsername").textContent = username;

    loadProducts();

    document.getElementById("reviewText").addEventListener("input", updateCharCount);
    document.querySelectorAll('input[name="rating"]').forEach((radio) => {
        radio.addEventListener("change", updateRatingText);
    });
    document.getElementById("reviewForm").addEventListener("submit", createReview);
});

// Fill the product drop-down, pre-selecting the product chosen on the products page
async function loadProducts() {
    const select = document.getElementById("productSelect");
    try {
        const res = await fetch("/api/product/retrieve/all", {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        if (isLoggedOut(res, data)) return;
        if (!data.success) {
            showMessage(data.message, "error");
            return;
        }
        select.innerHTML = `<option value="">Choose a product...</option>` +
            data.products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

        const selectedId = localStorage.getItem("selectedProductId");
        if (selectedId) {
            select.value = selectedId;
        }
    } catch (err) {
        showMessage("Failed to load products. Please try again.", "error");
    }
}

async function createReview(event) {
    event.preventDefault();

    const productId = document.getElementById("productSelect").value;
    const checked = document.querySelector('input[name="rating"]:checked');
    const reviewText = document.getElementById("reviewText").value;
    const submitBtn = document.getElementById("submitBtn");

    if (!productId) {
        showMessage("Please choose a product.", "error");
        return;
    }

    submitBtn.disabled = true;
    try {
        const res = await fetch("/api/review/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
                productId: Number(productId),
                rating: checked ? Number(checked.value) : null,
                reviewText,
            }),
        });
        const data = await res.json();
        if (isLoggedOut(res, data)) return;

        if (data.success) {
            showMessage('Your review has been posted. <a href="/review/retrieve/all">View my reviews</a>', "success", true);
            document.getElementById("reviewForm").reset();
            localStorage.removeItem("selectedProductId");
            localStorage.removeItem("selectedProductName");
            updateCharCount();
            updateRatingText();
        } else {
            // the message comes straight from the stored procedure
            showMessage(data.message, "error");
        }
    } catch (err) {
        showMessage("Failed to post the review. Please try again.", "error");
    } finally {
        submitBtn.disabled = false;
    }
}

// Missing or expired login token: send the member back to the login page
function isLoggedOut(res, data) {
    if (res.status === 401 || data.message === "Invalid or expired token.") {
        localStorage.clear();
        window.location.href = "/auth/login";
        return true;
    }
    return false;
}

function updateCharCount() {
    document.getElementById("charCount").textContent = document.getElementById("reviewText").value.trim().length;
}

function updateRatingText() {
    const checked = document.querySelector('input[name="rating"]:checked');
    document.getElementById("ratingText").textContent = checked
        ? `${checked.value} out of 5 stars`
        : "No rating chosen";
}

function showMessage(msg, type, allowHtml = false) {
    const el = document.getElementById("message");
    if (allowHtml) {
        el.innerHTML = msg;
    } else {
        el.textContent = msg;
    }
    el.className = `message ${type}`;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

function logout() {
    localStorage.clear();
    window.location.href = "/auth/login";
}
