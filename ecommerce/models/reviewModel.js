const { query } = require("../config/database");

const createReview = async (memberId, productId, rating, reviewText) => {
  const result = await query(
    "CALL public.create_review($1, $2, $3, $4, NULL)",
    [memberId, productId, rating, reviewText]
  );
  return result.rows[0].pReviewId;
};

const getReviewsByMember = async (memberId) => {
  const result = await query("SELECT * FROM public.get_reviews($1)", [memberId]);
  return result.rows;
};

const updateReview = async (memberId, reviewId, rating, reviewText) => {
  await query(
    "CALL public.update_review($1, $2, $3, $4)",
    [memberId, reviewId, rating, reviewText]
  );
};

const deleteReview = async (memberId, reviewId) => {
  const result = await query(
    "CALL public.delete_review($1, $2, NULL)",
    [memberId, reviewId]
  );
  return result.rows[0].pCommentsDeleted;
};

const toggleVote = async (memberId, reviewId) => {
  const result = await query(
    "CALL public.toggle_review_vote($1, $2, NULL, NULL)",
    [memberId, reviewId]
  );
  const row = result.rows[0];
  return { voted: row.pVoted, helpfulCount: row.pHelpfulCount };
};

module.exports = { createReview, getReviewsByMember, updateReview, deleteReview, toggleVote };
