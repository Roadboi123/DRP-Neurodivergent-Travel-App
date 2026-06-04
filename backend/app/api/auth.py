from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt

from app.schemas.auth import TokenResponse, UserLogin, UserRegister
from app.services.auth import (
    ALGORITHM,
    JWT_SECRET,
    UserExistsError,
    authenticate_user,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_username(token: str = Depends(oauth2_scheme)) -> str:
    """FastAPI dependency to extract and verify the username from the JWT token.
    
    Raises 401 Unauthorized if the token is invalid, expired, or missing.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
        
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None or not isinstance(username, str):
            raise credentials_exception
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister):
    """Register a new username and password."""
    try:
        register_user(payload)
        return {"message": "User registered successfully"}
    except UserExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {e}",
        )

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin):
    """Authenticate a username and password, returning a JWT access token."""
    username = authenticate_user(payload)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate token
    from app.services.auth import create_access_token
    token = create_access_token(username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        username=username
    )
