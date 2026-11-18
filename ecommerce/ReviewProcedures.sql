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

COMMIT;
