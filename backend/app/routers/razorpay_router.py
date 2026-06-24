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

# Addon packs: key → (pdf_credits, amount_paise, price_per_pdf_paise)
# 25 PDFs @ ₹10/pdf = ₹250  → 25000 paise
# 75 PDFs @ ₹8/pdf  = ₹600  → 60000 paise
# 150 PDFs @ ₹5/pdf = ₹750  → 75000 paise
ADDON_PACKS: dict[str, dict] = {
    "addon_25":  {"credits": 25,  "amount": 25000, "label": "25 PDF Credits",  "price_per": 10},
    "addon_75":  {"credits": 75,  "amount": 60000, "label": "75 PDF Credits",  "price_per": 8},
    "addon_150": {"credits": 150, "amount": 75000, "label": "150 PDF Credits", "price_per": 5},
}


class CreateOrderRequest(BaseModel):
    plan: str  # "starter" | "standard" | "pro"


class CreateAddonOrderRequest(BaseModel):
    addon: str  # "addon_25" | "addon_75" | "addon_150"


class VerifyAddonRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    addon: str


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


@router.post("/payments/create-addon-order")
async def create_addon_order(
    body: CreateAddonOrderRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Create a Razorpay order for a PDF credit addon pack."""
    if body.addon not in ADDON_PACKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid addon '{body.addon}'. Must be one of: {list(ADDON_PACKS)}",
        )

    pack = ADDON_PACKS[body.addon]
    settings = get_settings()
    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

    try:
        order = client.order.create({
            "amount": pack["amount"],
            "currency": "INR",
            "receipt": f"addon_{user['user_id'][:8]}_{body.addon}",
            "notes": {
                "user_id": user["user_id"],
                "addon": body.addon,
                "credits": pack["credits"],
            },
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Razorpay order creation failed: {exc}",
        )

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "addon": body.addon,
        "credits": pack["credits"],
        "label": pack["label"],
        "key_id": settings.razorpay_key_id,
    }


@router.post("/payments/verify-addon")
async def verify_addon_payment(
    body: VerifyAddonRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Verify addon payment and credit PDFs to the user's account."""
    if not all([body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required payment fields.",
        )

    if body.addon not in ADDON_PACKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown addon: {body.addon}",
        )

    settings = get_settings()

    # Verify signature
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

    pack = ADDON_PACKS[body.addon]
    credits = pack["credits"]

    # Add credits to addon_credits table (create if not exists)
    from supabase import create_client
    import datetime

    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    try:
        # Upsert addon_credits using Postgres ON CONFLICT to safely increment
        # Avoids maybe_single() None-handling bug and race conditions
        sb.rpc("increment_addon_credits", {
            "p_user_id": user["user_id"],
            "p_credits": credits,
        }).execute()

        # Log the purchase
        sb.table("addon_purchases").insert({
            "user_id": user["user_id"],
            "addon": body.addon,
            "credits_purchased": credits,
            "amount_paise": pack["amount"],
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "created_at": datetime.datetime.utcnow().isoformat(),
        }).execute()

    except Exception as exc:
        import logging
        logging.getLogger("statutorysync").error(
            f"Addon credit upsert failed: {exc} | user={user['user_id']} addon={body.addon} payment_id={body.razorpay_payment_id}"
        )
        return {
            "success": True,
            "credits_added": credits,
            "warning": "Payment received. Credits may take a few minutes to appear.",
        }

    return {
        "success": True,
        "credits_added": credits,
        "addon": body.addon,
    }
