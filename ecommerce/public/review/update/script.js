// Update a review (the one chosen on My Reviews).
// update_review checks ownership, rating and text; this page only sends the form.

let review = null;

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/auth/login";
        return;
    }
    const username = localStorage.getItem("username") || "User";
    document.getElementById("navUsername").textContent = username;

    review = JSON.parse(localStorage.getItem("selectedReview") || "null");
    if (!review) {
        window.location.href = "/review/retrieve/all";
        return;
    }

    document.getElementById("productName").textContent = review.productName;
    document.getElementById(`star${review.rating}`).checked = true;
    document.getElementById("reviewText").value = review.reviewText;
    document.getElementById("reviewForm").addEventListener("submit", updateReview);
});

async function updateReview(event) {
    event.preventDefault();
    const checked = document.querySelector('input[name="rating"]:checked');
    const reviewText = document.getElementById("reviewText").value;

    try {
        const res = await fetch("/api/review/update", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ reviewId: review.reviewId, rating: Number(checked.value), reviewText }),
        });
        const data = await res.json();
        if (res.status === 401 || data.message === "Invalid or expired token.") return logout();

        if (data.success) {
            localStorage.removeItem("selectedReview");
            window.location.href = "/review/retrieve/all";
        } else {
            showMessage(data.message); // message from the stored procedure
        }
    } catch (err) {
        showMessage("Failed to update the review. Please try again.");
    }
}

function showMessage(msg) {
    const el = document.getElementById("message");
    el.textContent = msg;
    el.className = "message error";
}

function logout() {
    localStorage.clear();
    window.location.href = "/auth/login";
}
