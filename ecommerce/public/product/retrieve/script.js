let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username") || "User";
  document.getElementById("navUsername").textContent = username;

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/auth/login";
    return;
  }
  loadProducts();
});

// =============================================================
// Reviews & comments panel
// The rules (author can only reply, no replying to deleted comments,
// only delete your own) are checked by the stored procedures;
// this page only shows the threads and sends the forms.
// =============================================================
let currentProductId = null;
const replyTo = {};      // reviewId -> { id, username } of the comment being replied to
const commentNames = {}; // commentId -> username, for "Replying to ..."

async function openReviews(productId) {
  currentProductId = productId;
  document.getElementById("reviewPanel").classList.remove("hidden");
  document.getElementById("panelBody").innerHTML = "<p>Loading…</p>";
  try {
    const data = await api(`/api/product/retrieve/${productId}`);
    if (!data.success) return showPanelMessage(data.message, "error");
    document.getElementById("panelTitle").textContent = `Reviews · ${data.product.name}`;
    if (data.reviews.length === 0) {
      document.getElementById("panelBody").innerHTML = "<p>No reviews yet.</p>";
      return;
    }
    const threads = await Promise.all(data.reviews.map((r) => api(`/api/comment/retrieve/${r.id}`)));
    document.getElementById("panelBody").innerHTML = data.reviews
      .map((r, i) => reviewBlock(r, threads[i].comments || []))
      .join("");
  } catch (err) {
    showPanelMessage("Failed to load reviews. Please try again.", "error");
  }
}

function reviewBlock(r, comments) {
  const reply = replyTo[r.id];
  comments.forEach((c) => (commentNames[c.commentId] = c.username));
  const comment = (c) => `
    <div class="comment ${c.isDeleted ? "deleted" : ""}" style="margin-left:${c.depth * 20}px">
      <div class="comment-meta">
        ${c.isDeleted ? "" : `<strong>${escapeHtml(c.username)}</strong>${c.isReviewAuthor ? '<span class="author-badge">Author</span>' : ""} · `}
        ${new Date(c.createdAt).toLocaleDateString("en-SG")}
      </div>
      <div class="comment-text">${escapeHtml(c.commentText)}</div>
      ${c.isDeleted ? "" : `
        <button class="link-btn" onclick="startReply(${r.id}, ${c.commentId})">Reply</button>
        ${String(c.memberId) === localStorage.getItem("memberId") ? `<button class="link-btn danger" onclick="deleteComment(${c.commentId})">Delete</button>` : ""}`}
    </div>`;

  return `
    <div class="review-block">
      <div class="review-head">
        <span><strong>${escapeHtml(r.memberUsername)}</strong> · ${new Date(r.updatedAt).toLocaleDateString("en-SG")}</span>
        <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
      </div>
      <p class="review-body">${escapeHtml(r.reviewText)}</p>
      ${comments.map(comment).join("")}
      <div class="comment-form">
        <textarea id="commentText-${r.id}" rows="2" placeholder="${reply ? "Write a reply…" : "Add a comment…"}"></textarea>
        <div class="comment-form-foot">
          <span>${reply ? `Replying to ${escapeHtml(reply.username)} · <button class="link-btn" onclick="startReply(${r.id}, null)">Cancel</button>` : ""}</span>
          <button class="btn-review" onclick="createComment(${r.id})">${reply ? "Reply" : "Comment"}</button>
        </div>
      </div>
    </div>`;
}

async function startReply(reviewId, commentId) {
  replyTo[reviewId] = commentId ? { id: commentId, username: commentNames[commentId] } : undefined;
  await openReviews(currentProductId);
  document.getElementById(`commentText-${reviewId}`).focus();
}

async function createComment(reviewId) {
  const commentText = document.getElementById(`commentText-${reviewId}`).value;
  const data = await api("/api/comment/create", "POST", {
    reviewId,
    parentCommentId: replyTo[reviewId]?.id ?? null,
    commentText,
  });
  if (data.success) {
    replyTo[reviewId] = undefined;
    await openReviews(currentProductId);
  }
  // on an error the typed text stays so it can be fixed
  showPanelMessage(data.message, data.success ? "success" : "error");
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;
  const data = await api("/api/comment/delete", "DELETE", { commentId });
  await openReviews(currentProductId);
  showPanelMessage(data.message, data.success ? "success" : "error");
}

function closeReviews() {
  document.getElementById("reviewPanel").classList.add("hidden");
  document.getElementById("panelMessage").className = "message hidden";
}

// fetch with the login token; an expired login goes back to the login page
async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401 || data.message === "Invalid or expired token.") logout();
  return data;
}

function showPanelMessage(msg, type) {
  const el = document.getElementById("panelMessage");
  el.textContent = msg;
  el.className = `message ${type}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function loadProducts() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("/api/product/retrieve/all", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      allProducts = data.products;
      renderProducts(allProducts);
    } else {
      showError(data.message);
    }
  } catch (err) {
    showError("Failed to load products. Please try again.");
  }
}

function renderProducts(products) {
  const grid = document.getElementById("productGrid");
  const countEl = document.getElementById("productCount");

  countEl.textContent = `Showing ${products.length} product${products.length !== 1 ? "s" : ""}`;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No products found</h3>
        <p>Try adjusting your search or filter.</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map((p) => {
    const stockClass = p.stockQuantity === 0 ? "out" : p.stockQuantity < 20 ? "low" : "";
    const stockLabel = p.stockQuantity === 0 ? "Out of Stock" : `${p.stockQuantity} in stock`;
    return `
      <div class="product-card">
        <div class="product-image-wrapper">
          <div class="product-image-placeholder">🍶</div>
          <span class="product-type-badge">${p.productType || "Bottle"}</span>
        </div>
        <div class="product-body">
          <div class="product-name">${p.name}</div>
          <div class="product-description">${p.description || "No description available."}</div>
          <div class="product-country">🌏 Made in ${p.country || "N/A"}</div>
          <div class="product-meta">
            <span class="product-price">S$${parseFloat(p.unitPrice).toFixed(2)}</span>
            <span class="product-stock ${stockClass}">${stockLabel}</span>
          </div>
          <button class="btn-review" onclick="goToReview(${p.id}, '${encodeURIComponent(p.name)}')">
            ✍️ Write a Review
          </button>
          <button class="btn-comments" onclick="openReviews(${p.id})">💬 Reviews & Comments</button>
        </div>
      </div>`;
  }).join("");
}

function filterProducts() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortFilter").value;

  let filtered = allProducts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search) ||
      (p.description && p.description.toLowerCase().includes(search));
    const matchCategory = !category || p.productType === category;
    return matchSearch && matchCategory;
  });

  if (sort === "price-asc") filtered.sort((a, b) => a.unitPrice - b.unitPrice);
  else if (sort === "price-desc") filtered.sort((a, b) => b.unitPrice - a.unitPrice);
  else if (sort === "name-asc") filtered.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(filtered);
}

function goToReview(productId, productName) {
  localStorage.setItem("selectedProductId", productId);
  localStorage.setItem("selectedProductName", decodeURIComponent(productName));
  window.location.href = "/review/create";
}

function logout() {
  localStorage.clear();
  window.location.href = "/auth/login";
}

function showError(msg) {
  const el = document.getElementById("message");
  el.textContent = msg;
  el.className = "message error";
}