import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from modules.identity.models import Operator

# Load environment variables
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Passlib bcrypt context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)

# Rate limiter instance (per IP address)
limiter = Limiter(key_func=get_remote_address)


def hash_password(password: str) -> str:
    """Hash plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    operator_id: int,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate signed JWT containing { id, role, operator_id } payload.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode = {
        "id": operator_id,
        "operator_id": operator_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def requireRole(*roles: str):
    """
    Reusable FastAPI dependency to authenticate JWT and enforce role-based access.

    Usage:
        @router.get("/protected")
        def endpoint(current_operator: Operator = Depends(requireRole("REGULATOR"))):
            ...

        # Or multiple allowed roles:
        @router.get("/multi")
        def endpoint(current_operator: Operator = Depends(requireRole("FLEET_OPERATOR", "DISPATCHER"))):
            ...

        # Or any authenticated operator:
        @router.get("/me")
        def endpoint(current_operator: Operator = Depends(requireRole())):
            ...
    """

    def role_dependency(
        auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: Session = Depends(get_db),
    ) -> Operator:
        if not auth or not auth.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials were not provided",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth.credentials
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            operator_id: Optional[int] = payload.get("operator_id") or payload.get("id")
            token_role: Optional[str] = payload.get("role")
            if operator_id is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        operator = (
            db.query(Operator).filter(Operator.operator_id == operator_id).first()
        )
        if not operator:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Operator not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if roles and operator.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Forbidden: role '{operator.role}' does not have sufficient permissions. "
                    f"Allowed roles: {', '.join(roles)}"
                ),
            )

        return operator

    return role_dependency
