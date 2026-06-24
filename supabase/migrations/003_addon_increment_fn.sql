-- Atomic increment function for addon credits
-- Called by backend after payment verification
-- Uses ON CONFLICT to safely handle first-time insert vs increment
CREATE OR REPLACE FUNCTION public.increment_addon_credits(
    p_user_id UUID,
    p_credits  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.addon_credits (user_id, credits_remaining, created_at, updated_at)
    VALUES (p_user_id, p_credits, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        credits_remaining = public.addon_credits.credits_remaining + EXCLUDED.credits_remaining,
        updated_at = NOW();
END;
$$;

-- Allow service role to call this function
GRANT EXECUTE ON FUNCTION public.increment_addon_credits(UUID, INTEGER) TO service_role;
