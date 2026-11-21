const { query } = require("../config/database");

const createComment = async (memberId, reviewId, parentCommentId, commentText) => {
  const result = await query(
    "CALL public.create_comment($1, $2, $3, $4, NULL)",
    [memberId, reviewId, parentCommentId ?? null, commentText]
  );
  return result.rows[0].pCommentId;
};

const getComments = async (reviewId) => {
  const result = await query("SELECT * FROM public.get_comments($1)", [reviewId]);
  return result.rows;
};

const deleteComment = async (memberId, commentId) => {
  const result = await query(
    "CALL public.delete_comment($1, $2, NULL)",
    [memberId, commentId]
  );
  return result.rows[0].pKeptAsPlaceholder;
};

module.exports = { createComment, getComments, deleteComment };
