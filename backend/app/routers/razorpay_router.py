"""Razorpay payment router — create orders and verify signatures."""
from __future__ import annotations

import hashlib
import hmac
from typing import Annotated

import razorpay
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import get_current_user

router = APIRouter(tags=["payments"])

# Plan → amount in paise (INR × 100)
PLAN_AMOUNTS: dict[str, int] = {
    "starter":  24900,   # ₹249
    "standard": 44900,   # ₹449
    "pro":      69900,   # ₹699
}

PLAN_NAMES: dict[str, str] = {
    "starter":  "StatutorySync Starter",
    "standard": "StatutorySync Standard",
    "pro":      "StatutorySync Pro",
}

PLAN_PDF_LIMITS: dict[str, int] = {
    "starter":  25,
    "standard": 50,
    "pro":      120,
}


class CreateOrderRequest(BaseModel):
    plan: str  # "starter" | "standard" | "pro"


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int       # paise
    currency: str
    plan: str
    key_id: str       # safe to expose — public key only


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str


@router.post("/payments/create-order", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrderRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> CreateOrderResponse:
    """Create a Razorpay order for the requested plan."""
    if body.plan not in PLAN_AMOUNTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan '{body.plan}'. Must be one of: {list(PLAN_AMOUNTS)}",
        )

    amount = PLAN_AMOUNTS[body.plan]
    if amount < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be >= 100 paise.",
        )

    settings = get_settings()
    client = razorpay.Client(
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret)
    )

    try:
        order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "receipt": f"receipt_{user['user_id'][:8]}_{body.plan}",
            "notes": {
                "user_id": user["user_id"],
                "plan": body.plan,
            },
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Razorpay order creation failed: {exc}",
        )

    return CreateOrderResponse(
        order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        plan=body.plan,
        key_id=settings.razorpay_key_id,
    )


@router.post("/payments/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Verify Razorpay payment signature and activate the plan."""
    if not all([body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required payment fields.",
        )

    settings = get_settings()

    # HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    message = f"{body.razorpay_order_id}|{body.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.razorpay_key_secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, body.razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed.",
        )

    if body.plan not in PLAN_PDF_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown plan: {body.plan}",
        )

    # Activate plan in Supabase
    from supabase import create_client
    import datetime

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    now = datetime.datetime.utcnow()
    period_end = now + datetime.timedelta(days=30)

    try:
        sb.table("subscriptions").upsert({
            "user_id": user["user_id"],
            "plan": body.plan,
            "status": "active",
            "pdf_limit": PLAN_PDF_LIMITS[body.plan],
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
        }, on_conflict="user_id").execute()
    except Exception as exc:
        # Payment succeeded but DB write failed — log and still return success
        # so user isn't told their valid payment failed
        import logging
        logging.getLogger("statutorysync").error(
            f"Subscription upsert failed after valid payment: {exc} "
            f"| user={user['user_id']} plan={body.plan} "
            f"| payment_id={body.razorpay_payment_id}"
        )
        # Return success — admin can manually fix the subscription row
        return {
            "success": True,
            "plan": body.plan,
            "pdf_limit": PLAN_PDF_LIMITS[body.plan],
            "warning": "Payment received. Account upgrade may take a few minutes.",
        }

    return {
        "success": True,
        "plan": body.plan,
        "pdf_limit": PLAN_PDF_LIMITS[body.plan],
    }
