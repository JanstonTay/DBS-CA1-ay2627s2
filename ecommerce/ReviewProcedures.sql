-- ============================================
-- CA1: REVIEW STORED PROCEDURES AND FUNCTIONS
-- Run AFTER CreateReviewCommentTables.sql.
--
-- Write operations are PROCEDURES (call with CALL ...).
-- Read operations are FUNCTIONS    (call with SELECT * FROM ...).
--
-- All validation happens here, not in the back-end or front-end.
-- Errors are raised with a clear message and a standard SQLSTATE
-- so the application can show the message and pick an HTTP status:
--   22023 invalid_parameter_value  -> 400 Bad Request  (bad input)
--   42501 insufficient_privilege   -> 403 Forbidden    (not allowed)
--   P0002 no_data_found            -> 404 Not Found    (doesn't exist)
--   23505 unique_violation         -> 409 Conflict     (already exists)
-- ============================================

BEGIN;

-- --------------------------------------------
-- Helper: validate rating and review text (shared by create and update)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_review_input(
    p_rating      INTEGER,
    p_review_text TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_rating IS NULL THEN
        RAISE EXCEPTION 'Please choose a rating.' USING ERRCODE = '22023';
    END IF;

    IF p_rating NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5.' USING ERRCODE = '22023';
    END IF;

    IF p_review_text IS NULL OR btrim(p_review_text) = '' THEN
        RAISE EXCEPTION 'Review text cannot be empty.' USING ERRCODE = '22023';
    END IF;

    IF length(btrim(p_review_text)) > 1000 THEN
        RAISE EXCEPTION 'Review text cannot be longer than 1000 characters.' USING ERRCODE = '22023';
    END IF;
END;
$$;

-- --------------------------------------------
-- create_review: a member reviews a product they bought
-- Rules:
--   * member and product must exist
--   * the member must have ordered the product in a COMPLETED order
--   * one review per member per product
-- Returns the new review's id in p_review_id.
-- Usage: CALL create_review(2, 1, 5, 'Great bottle', NULL);
-- --------------------------------------------
CREATE OR REPLACE PROCEDURE public.create_review(
    p_member_id   INTEGER,
    p_product_id  INTEGER,
    p_rating      INTEGER,
    p_review_text TEXT,
    INOUT p_review_id INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_has_ordered   BOOLEAN;
    v_has_completed BOOLEAN;
    v_has_pending   BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.member WHERE id = p_member_id) THEN
        RAISE EXCEPTION 'Member not found.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.product WHERE id = p_product_id) THEN
        RAISE EXCEPTION 'Product not found.' USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.validate_review_input(p_rating, p_review_text);

    -- What has this member ordered for this product?
    SELECT COUNT(*) > 0,
           COUNT(*) FILTER (WHERE so.status = 'COMPLETED') > 0,
           COUNT(*) FILTER (WHERE so.status = 'PACKING') > 0
      INTO v_has_ordered, v_has_completed, v_has_pending
      FROM public.sale_order so
      JOIN public.sale_order_item soi ON soi.sale_order_id = so.id
     WHERE so.member_id = p_member_id
       AND soi.product_id = p_product_id;

    IF NOT v_has_ordered THEN
        RAISE EXCEPTION 'You can only review products you have purchased.' USING ERRCODE = '42501';
    END IF;

    IF NOT v_has_completed THEN
        IF v_has_pending THEN
            RAISE EXCEPTION 'Your order for this product is not completed yet. You can review it once it is completed.' USING ERRCODE = '42501';
        ELSE
            RAISE EXCEPTION 'Your order for this product was cancelled, so it cannot be reviewed.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM public.review WHERE member_id = p_member_id AND product_id = p_product_id) THEN
        RAISE EXCEPTION 'You have already reviewed this product. You can edit your existing review instead.' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.review (member_id, product_id, rating, review_text)
    VALUES (p_member_id, p_product_id, p_rating, btrim(p_review_text))
    RETURNING id INTO p_review_id;

EXCEPTION
    -- Two identical requests at the same moment: the UNIQUE constraint wins
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already reviewed this product. You can edit your existing review instead.' USING ERRCODE = '23505';
END;
$$;

-- --------------------------------------------
-- get_reviews: all reviews written by a member, newest first
-- Usage: SELECT * FROM get_reviews(2);
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reviews(
    p_member_id INTEGER
)
RETURNS TABLE (
    review_id     INTEGER,
    product_id    INTEGER,
    product_name  VARCHAR,
    rating        SMALLINT,
    review_text   TEXT,
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    is_edited     BOOLEAN,
    helpful_count INTEGER,
    comment_count INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.member WHERE id = p_member_id) THEN
        RAISE EXCEPTION 'Member not found.' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT r.id,
           r.product_id,
           p.name,
           r.rating,
           r.review_text,
           r.created_at,
           r.updated_at,
           r.updated_at > r.created_at,
           (SELECT COUNT(*)::INTEGER FROM public.review_vote rv WHERE rv.review_id = r.id),
           (SELECT COUNT(*)::INTEGER FROM public.comment c WHERE c.review_id = r.id AND c.deleted_at IS NULL)
      FROM public.review r
      JOIN public.product p ON p.id = r.product_id
     WHERE r.member_id = p_member_id
     ORDER BY r.updated_at DESC, r.id DESC;
END;
$$;

-- --------------------------------------------
-- update_review: a member edits the rating and text of their own review
-- updated_at is set by the trigger trg_review_updated_at.
-- Usage: CALL update_review(2, 1, 4, 'Still good after a month');
-- --------------------------------------------
CREATE OR REPLACE PROCEDURE public.update_review(
    p_member_id   INTEGER,
    p_review_id   INTEGER,
    p_rating      INTEGER,
    p_review_text TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_id INTEGER;
BEGIN
    SELECT member_id INTO v_owner_id
      FROM public.review
     WHERE id = p_review_id
       FOR UPDATE;   -- lock the row so two edits can't overlap

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_owner_id IS DISTINCT FROM p_member_id THEN
        RAISE EXCEPTION 'You can only edit your own reviews.' USING ERRCODE = '42501';
    END IF;

    PERFORM public.validate_review_input(p_rating, p_review_text);

    UPDATE public.review
       SET rating = p_rating,
           review_text = btrim(p_review_text)
     WHERE id = p_review_id;
END;
$$;

COMMIT;
