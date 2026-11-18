-- ============================================
-- CA1: NEW TABLES FOR REVIEWS AND COMMENTS
-- Run on the "ecommerce" database AFTER it has been restored.
-- The 5 existing tables (member, member_role, product,
-- sale_order, sale_order_item) are NOT changed.
-- ============================================

BEGIN;

-- --------------------------------------------
-- review: one row per review.
-- A member reviews a product they bought (checked in create_review).
-- --------------------------------------------
CREATE TABLE public.review (
    id          SERIAL PRIMARY KEY,
    member_id   INTEGER   NOT NULL,
    product_id  INTEGER   NOT NULL,
    rating      SMALLINT  NOT NULL,
    review_text TEXT      NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_review_member  FOREIGN KEY (member_id)  REFERENCES public.member(id),
    CONSTRAINT fk_review_product FOREIGN KEY (product_id) REFERENCES public.product(id),
    CONSTRAINT uq_review_member_product UNIQUE (member_id, product_id),
    CONSTRAINT chk_review_rating   CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_review_text     CHECK (btrim(review_text) <> ''),
    CONSTRAINT chk_review_dates    CHECK (updated_at >= created_at)
);

-- --------------------------------------------
-- review_vote: one row per "helpful" vote.
-- Composite primary key = one vote per member per review.
-- --------------------------------------------
CREATE TABLE public.review_vote (
    member_id  INTEGER   NOT NULL,
    review_id  INTEGER   NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT pk_review_vote PRIMARY KEY (member_id, review_id),
    CONSTRAINT fk_review_vote_member FOREIGN KEY (member_id) REFERENCES public.member(id),
    CONSTRAINT fk_review_vote_review FOREIGN KEY (review_id) REFERENCES public.review(id) ON DELETE CASCADE
);

-- --------------------------------------------
-- comment: one row per comment or reply.
-- parent_comment_id is NULL for a top-level comment.
-- deleted_at is set when a comment is soft-deleted ("[deleted]").
-- --------------------------------------------
CREATE TABLE public.comment (
    id                SERIAL PRIMARY KEY,
    review_id         INTEGER   NOT NULL,
    member_id         INTEGER   NOT NULL,
    parent_comment_id INTEGER,
    comment_text      TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMP,
    CONSTRAINT fk_comment_review FOREIGN KEY (review_id) REFERENCES public.review(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_member FOREIGN KEY (member_id) REFERENCES public.member(id),
    -- needed so the composite foreign key below can point at (id, review_id)
    CONSTRAINT uq_comment_id_review UNIQUE (id, review_id),
    -- a reply must belong to the same review as the comment it replies to
    CONSTRAINT fk_comment_parent_same_review FOREIGN KEY (parent_comment_id, review_id)
        REFERENCES public.comment(id, review_id) ON DELETE CASCADE,
    CONSTRAINT chk_comment_not_own_parent CHECK (parent_comment_id <> id),
    -- visible comment: non-blank text; deleted comment: text erased
    CONSTRAINT chk_comment_text_state CHECK (
        (deleted_at IS NULL AND comment_text IS NOT NULL AND btrim(comment_text) <> '')
        OR (deleted_at IS NOT NULL AND comment_text IS NULL)
    )
);

-- --------------------------------------------
-- Trigger: keep review.updated_at correct on every edit
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_review_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    NEW.created_at := OLD.created_at;  -- the posted date can never be changed
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_updated_at
    BEFORE UPDATE ON public.review
    FOR EACH ROW
    EXECUTE FUNCTION public.set_review_updated_at();

-- --------------------------------------------
-- Indexes (new tables only)
-- Primary keys and UNIQUE constraints are indexed automatically.
-- --------------------------------------------
CREATE INDEX idx_review_product_id        ON public.review (product_id);
CREATE INDEX idx_review_vote_review_id    ON public.review_vote (review_id);
CREATE INDEX idx_comment_review_id        ON public.comment (review_id);
CREATE INDEX idx_comment_parent_comment_id ON public.comment (parent_comment_id);

COMMIT;
