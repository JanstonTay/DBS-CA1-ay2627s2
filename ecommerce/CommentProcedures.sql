-- ============================================
-- CA1: COMMENT STORED PROCEDURES AND FUNCTIONS
-- Run AFTER CreateReviewCommentTables.sql and ReviewProcedures.sql.
--
-- Write operations are PROCEDURES (call with CALL ...).
-- Read operations are FUNCTIONS    (call with SELECT * FROM ...).
-- Same error codes as ReviewProcedures.sql:
--   22023 -> 400, 42501 -> 403, P0002 -> 404
-- ============================================

BEGIN;

-- --------------------------------------------
-- create_comment: comment on a review, or reply to a comment
-- Rules:
--   * the text cannot be empty or longer than 500 characters
--   * the review must exist
--   * top-level comment (no parent): not allowed on your own review,
--     the review's author may only reply
--   * reply: the parent must be a comment on the same review and
--     must not be deleted
-- The new comment's id is returned in p_comment_id.
-- Usage: CALL create_comment(3, 1, NULL, 'Is it dishwasher safe?', NULL);
--        CALL create_comment(2, 1, 1, 'Yes, the lid too.', NULL);
-- --------------------------------------------
CREATE OR REPLACE PROCEDURE public.create_comment(
    p_member_id         INTEGER,
    p_review_id         INTEGER,
    p_parent_comment_id INTEGER,
    p_comment_text      TEXT,
    INOUT p_comment_id  INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_review_author INTEGER;
    v_parent_review INTEGER;
    v_parent_deleted TIMESTAMP;
BEGIN
    IF p_comment_text IS NULL OR btrim(p_comment_text) = '' THEN
        RAISE EXCEPTION 'Comment can''t be empty.' USING ERRCODE = '22023';
    END IF;

    IF length(btrim(p_comment_text)) > 500 THEN
        RAISE EXCEPTION 'Comment cannot be longer than 500 characters.' USING ERRCODE = '22023';
    END IF;

    SELECT member_id INTO v_review_author
      FROM public.review
     WHERE id = p_review_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF p_parent_comment_id IS NULL THEN
        IF v_review_author = p_member_id THEN
            RAISE EXCEPTION 'You can''t comment on your own review - reply instead.' USING ERRCODE = '42501';
        END IF;
    ELSE
        -- lock the parent so it can't be deleted while we reply to it
        SELECT review_id, deleted_at INTO v_parent_review, v_parent_deleted
          FROM public.comment
         WHERE id = p_parent_comment_id
           FOR UPDATE;

        IF NOT FOUND OR v_parent_review <> p_review_id THEN
            RAISE EXCEPTION 'Comment not found.' USING ERRCODE = 'P0002';
        END IF;

        IF v_parent_deleted IS NOT NULL THEN
            RAISE EXCEPTION 'You can''t reply to a deleted comment.' USING ERRCODE = '22023';
        END IF;
    END IF;

    INSERT INTO public.comment (review_id, member_id, parent_comment_id, comment_text)
    VALUES (p_review_id, p_member_id, p_parent_comment_id, btrim(p_comment_text))
    RETURNING id INTO p_comment_id;
END;
$$;

COMMIT;
