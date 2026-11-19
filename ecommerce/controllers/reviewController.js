const reviewModel = require("../models/reviewModel");

// The rules live in the stored procedures; here we only turn their
// SQLSTATE error codes into HTTP status codes.
const handleDbError = (err, res) => {
  switch (err.code) {
    case "22023":
      return res.status(400).json({ success: false, message: err.message });
    case "22P02":
      return res.status(400).json({ success: false, message: "Invalid input." });
    case "42501":
      return res.status(403).json({ success: false, message: err.message });
    case "P0002":
      return res.status(404).json({ success: false, message: err.message });
    case "23505":
      return res.status(409).json({ success: false, message: err.message });
    default:
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error." });
  }
};

const createReview = async (req, res) => {
  try {
    const { productId, rating, reviewText } = req.body;
    const reviewId = await reviewModel.createReview(req.user.id, productId, rating, reviewText);
    res.status(201).json({ success: true, message: "Review created.", reviewId });
  } catch (err) {
    handleDbError(err, res);
  }
};

const getMyReviews = async (req, res) => {
  try {
    const reviews = await reviewModel.getReviewsByMember(req.user.id);
    res.json({ success: true, reviews });
  } catch (err) {
    handleDbError(err, res);
  }
};

const updateReview = async (req, res) => {
  try {
    const { reviewId, rating, reviewText } = req.body;
    await reviewModel.updateReview(req.user.id, reviewId, rating, reviewText);
    res.json({ success: true, message: "Review updated." });
  } catch (err) {
    handleDbError(err, res);
  }
};

const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.body;
    const commentsDeleted = await reviewModel.deleteReview(req.user.id, reviewId);
    res.json({ success: true, message: "Review deleted.", commentsDeleted });
  } catch (err) {
    handleDbError(err, res);
  }
};

const toggleVote = async (req, res) => {
  try {
    const { reviewId } = req.body;
    const { voted, helpfulCount } = await reviewModel.toggleVote(req.user.id, reviewId);
    res.json({ success: true, voted, helpfulCount });
  } catch (err) {
    handleDbError(err, res);
  }
};

module.exports = { createReview, getMyReviews, updateReview, deleteReview, toggleVote };
