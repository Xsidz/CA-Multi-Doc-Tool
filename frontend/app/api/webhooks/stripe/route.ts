// Stripe webhooks removed — payments now handled by Razorpay.
// Razorpay payment verification is done synchronously in the backend
// at POST /api/v1/payments/verify using HMAC-SHA256 signature check.
// This file is kept so the route path doesn't 404 if cached anywhere.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Stripe removed. Using Razorpay." }, { status: 410 });
}
