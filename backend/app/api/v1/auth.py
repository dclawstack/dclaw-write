"""Authentication endpoints.

Minimal login surface. The login route is rate-limited stringently (see the
``@limiter.limit`` decorator wired in ``app/api/main.py``) to blunt credential
stuffing / brute-force attempts.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.ratelimit import limiter

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest):
    # SECURITY: previously this returned {"status": "ok"} for ANY credentials —
    # a textbook auth bypass. There is no user store / password verification /
    # token issuance in this service yet, so the only safe behaviour is to FAIL
    # CLOSED: never signal a successful authentication. Implement real
    # credential verification + token issuance (hashed passwords, constant-time
    # compare — see consensus-out/SECURITY-FIXES-AND-CHECKLIST.md, Fix 4) before
    # re-enabling. Until then, do not hand out success.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication is not implemented; login is disabled.",
    )
