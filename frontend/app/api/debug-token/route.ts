import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Debug only — remove before production
export async function GET() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ session: null, error: "No session" });
  }
  return NextResponse.json({
    user_id: session.user.id,
    email: session.user.email,
    token_prefix: session.access_token.slice(0, 40) + "...",
  });
}
