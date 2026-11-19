// My Reviews: list the logged-in member's own reviews.
// The reviews (and their helpful and comment counts) come from the
// get_reviews function in the database. This page only shows them
// and opens the update or delete page for the review that was chosen.

let reviews = [];

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/auth/login";
        return;
    }
    const username = localStorage.getItem("username") || "User";
    document.getElementById("navUsername").textContent = username;

    loadReviews();

    document.getElementById("reviewList").addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        openReview(Number(btn.dataset.id), btn.dataset.action);
    });
});

async function loadReviews() {
    const loading = document.getElementById("loading");
    try {
        const res = await fetch("/api/review/retrieve/all", {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        if (isLoggedOut(res, data)) return;
        if (!data.success) {
            loading.classList.add("hidden");
            showMessage(data.message, "error");
            return;
        }
        reviews = data.reviews;
        renderReviews();
    } catch (err) {
        loading.classList.add("hidden");
        showMessage("Failed to load your reviews. Please try again.", "error");
    }
}

function renderReviews() {
    const loading = document.getElementById("loading");
    const list = document.getElementById("reviewList");

    if (reviews.length === 0) {
        loading.classList.add("hidden");
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>You haven't written any reviews yet.</h3>
                <p>Pick a bottle you bought and tell other customers what you think.</p>
                <a href="/product/retrieve" class="btn-primary">Browse Products</a>
            </div>`;
        return;
    }

    loading.textContent = `You have written ${reviews.length} review${reviews.length === 1 ? "" : "s"}`;
    list.innerHTML = reviews.map(reviewCard).join("");
}

function reviewCard(r) {
    let meta = `Posted ${formatDate(r.createdAt)}`;
    if (r.isEdited) {
        meta += ` · Edited ${formatDate(r.updatedAt)}`;
    }
    return `
        <div class="review-card">
            <div class="review-top">
                <h3 class="review-product">${escapeHtml(r.productName)}</h3>
                <span class="review-stars" title="${Number(r.rating)} out of 5 stars">${stars(r.rating)}</span>
            </div>
            <p class="review-meta">${meta}</p>
            <p class="review-text">${escapeHtml(r.reviewText)}</p>
            <div class="review-footer">
                <div class="review-badges">
                    <span class="badge">👍 ${Number(r.helpfulCount)} helpful</span>
                    <span class="badge">💬 ${Number(r.commentCount)} comment${Number(r.commentCount) === 1 ? "" : "s"}</span>
                </div>
                <div class="review-actions">
                    <button class="btn-primary" data-action="update" data-id="${Number(r.reviewId)}">Update</button>
                    <button class="btn-danger" data-action="delete" data-id="${Number(r.reviewId)}">Delete</button>
                </div>
            </div>
        </div>`;
}

// Remember the chosen review, then open the update or delete page
function openReview(reviewId, action) {
    const r = reviews.find((x) => Number(x.reviewId) === reviewId);
    if (!r) return;
    localStorage.setItem("selectedReview", JSON.stringify({
        reviewId: r.reviewId,
        productId: r.productId,
        productName: r.productName,
        rating: r.rating,
        reviewText: r.reviewText,
    }));
    window.location.href = action === "delete" ? "/review/delete" : "/review/update";
}

function stars(rating) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
        html += `<span class="${i <= rating ? "star-filled" : "star-empty"}">★</span>`;
    }
    return html;
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
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
