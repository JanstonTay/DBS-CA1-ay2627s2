// Delete a review (the one chosen on My Reviews).
// delete_review checks ownership and also deletes the review's comments,
// replies and helpful votes; this page only asks to confirm and sends the id.

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
    document.getElementById("reviewText").textContent = review.reviewText;
    const stars = document.getElementById("stars");
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement("span");
        star.textContent = "★";
        if (i <= review.rating) star.className = "filled";
        stars.appendChild(star);
    }
    document.getElementById("deleteBtn").addEventListener("click", deleteReview);
});

async function deleteReview() {
    if (!confirm("Delete this review? This cannot be undone.")) return;

    try {
        const res = await fetch("/api/review/delete", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ reviewId: review.reviewId }),
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
        showMessage("Failed to delete the review. Please try again.");
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
