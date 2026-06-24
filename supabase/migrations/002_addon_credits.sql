-- ============================================================
-- Add-on Credits Tables
-- ============================================================

-- Tracks current balance of addon PDF credits per user
CREATE TABLE IF NOT EXISTS public.addon_credits (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS addon_credits_user_id_idx ON public.addon_credits(user_id);

ALTER TABLE public.addon_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addon credits"
    ON public.addon_credits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage addon credits"
    ON public.addon_credits FOR ALL
    USING (auth.role() = 'service_role');


-- Append-only log of every addon purchase
CREATE TABLE IF NOT EXISTS public.addon_purchases (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addon                TEXT NOT NULL,
    credits_purchased    INTEGER NOT NULL,
    amount_paise         INTEGER NOT NULL,
    razorpay_order_id    TEXT,
    razorpay_payment_id  TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS addon_purchases_user_id_idx ON public.addon_purchases(user_id);

ALTER TABLE public.addon_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addon purchases"
    ON public.addon_purchases FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert addon purchases"
    ON public.addon_purchases FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
