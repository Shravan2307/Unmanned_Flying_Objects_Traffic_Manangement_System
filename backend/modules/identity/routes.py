from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from modules.identity.auth import (
    create_access_token,
    hash_password,
    limiter,
    requireRole,
    verify_password,
)
from modules.identity.models import AuditLog, Operator
from modules.identity.schemas import (
    AuditLogOut,
    OperatorCreate,
    OperatorLogin,
    OperatorOut,
    TokenResponse,
)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
operators_router = APIRouter(prefix="/api/operators", tags=["operators"])
audit_router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------
@auth_router.post(
    "/register",
    response_model=OperatorOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new operator",
)
def register(payload: OperatorCreate, db: Session = Depends(get_db)):
    # Check if license_no already registered
    existing = (
        db.query(Operator).filter(Operator.license_no == payload.license_no).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operator with license number '{payload.license_no}' already exists.",
        )

    # Validate role (schema already validates Literal, but double check against table CHECK constraint)
    valid_roles = {"FLEET_OPERATOR", "REGULATOR", "DISPATCHER"}
    if payload.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of {', '.join(valid_roles)}.",
        )

    operator = Operator(
        name=payload.name,
        license_no=payload.license_no,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    db.add(operator)
    db.commit()
    db.refresh(operator)
    return operator


@auth_router.post(
    "/login",
    response_model=TokenResponse,
    summary="Operator login with rate limiting",
)
@limiter.limit("5/minute")
def login(request: Request, payload: OperatorLogin, db: Session = Depends(get_db)):
    operator = (
        db.query(Operator).filter(Operator.license_no == payload.license_no).first()
    )
    if not operator or not verify_password(payload.password, operator.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid license number or password",
        )

    access_token = create_access_token(
        operator_id=operator.operator_id,
        role=operator.role,
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        operator=OperatorOut.model_validate(operator),
    )


# ---------------------------------------------------------------------------
# Operators Endpoints
# ---------------------------------------------------------------------------
@operators_router.get(
    "/me",
    response_model=OperatorOut,
    summary="Get current operator profile",
)
def get_current_operator_profile(
    current_operator: Operator = Depends(requireRole()),
):
    return current_operator


@operators_router.get(
    "",
    response_model=List[OperatorOut],
    summary="List all operators (Regulator only)",
)
@operators_router.get(
    "/",
    response_model=List[OperatorOut],
    include_in_schema=False,
)
def list_operators(
    current_regulator: Operator = Depends(requireRole("REGULATOR")),
    db: Session = Depends(get_db),
):
    return db.query(Operator).order_by(Operator.operator_id.asc()).all()


@operators_router.patch(
    "/{id}/suspend",
    summary="Suspend an operator (Regulator only)",
)
def suspend_operator(
    id: int,
    current_regulator: Operator = Depends(requireRole("REGULATOR")),
    db: Session = Depends(get_db),
):
    target_operator = db.query(Operator).filter(Operator.operator_id == id).first()
    if not target_operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator with ID {id} not found.",
        )

    # Write entry to audit_log
    audit_entry = AuditLog(
        actor_id=current_regulator.operator_id,
        action="SUSPEND",
        entity="operator",
        entity_id=target_operator.operator_id,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)

    return {
        "message": f"Operator '{target_operator.name}' (ID: {id}) suspended successfully.",
        "operator_id": target_operator.operator_id,
        "audit_log_id": audit_entry.id,
    }


# ---------------------------------------------------------------------------
# Audit Log Endpoints
# ---------------------------------------------------------------------------
@audit_router.get(
    "",
    response_model=List[AuditLogOut],
    summary="Get full audit trail (Regulator only)",
)
@audit_router.get(
    "/",
    response_model=List[AuditLogOut],
    include_in_schema=False,
)
def get_audit_trail(
    current_regulator: Operator = Depends(requireRole("REGULATOR")),
    db: Session = Depends(get_db),
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).all()
