const commentModel = require("../models/commentModel");

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

const createComment = async (req, res) => {
  try {
    const { reviewId, parentCommentId, commentText } = req.body;
    const commentId = await commentModel.createComment(req.user.id, reviewId, parentCommentId, commentText);
    res.status(201).json({ success: true, message: "Comment posted.", commentId });
  } catch (err) {
    handleDbError(err, res);
  }
};

const getComments = async (req, res) => {
  try {
    const comments = await commentModel.getComments(req.params.reviewId);
    res.json({ success: true, comments });
  } catch (err) {
    handleDbError(err, res);
  }
};

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const keptAsPlaceholder = await commentModel.deleteComment(req.user.id, commentId);
    const message = keptAsPlaceholder ? "Comment deleted. Replies are kept." : "Comment deleted.";
    res.json({ success: true, message, keptAsPlaceholder });
  } catch (err) {
    handleDbError(err, res);
  }
};

module.exports = { createComment, getComments, deleteComment };
