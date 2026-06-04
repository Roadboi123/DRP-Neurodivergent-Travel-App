import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt

from app.config import settings
from app.integrations.supabase import supabase
from app.schemas.auth import UserLogin, UserRegister

# Token signing configuration
JWT_SECRET = settings.JWT_SECRET
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

class AuthError(Exception):
    """Base exception for auth-related failures."""
    pass

class UserExistsError(AuthError):
    """Raised when registering a username that already exists."""
    pass

def hash_password(password: str) -> str:
    """Generate a secure PBKDF2 salted hash of the password."""
    salt = os.urandom(16)
    # 100k iterations with HMAC-SHA256
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}:{pwd_hash.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against the stored PBKDF2 salted hash."""
    try:
        salt_hex, hash_hex = hashed_password.split(":")
        salt = bytes.fromhex(salt_hex)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return pwd_hash.hex() == hash_hex
    except Exception:
        return False

def create_access_token(username: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT token containing the username in the 'sub' field."""
    utc_now = datetime.now(timezone.utc)
    if expires_delta:
        expire = utc_now + expires_delta
    else:
        expire = utc_now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": username,
        "iat": utc_now,
        "exp": expire
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

def register_user(payload: UserRegister) -> bool:
    """Register a new user in Supabase user_credentials table. Raise UserExistsError if username exists."""
    username = payload.username.strip().lower()
    
    # 1. Check if user already exists
    try:
        check_res = supabase.table("user_credentials") \
            .select("username") \
            .eq("username", username) \
            .execute()
        if check_res.data and len(check_res.data) > 0:
            raise UserExistsError("Username already exists")
    except UserExistsError:
        raise
    except Exception as e:
        # Fallback if connection fails, but let it raise
        print(f"Error checking user existence: {e}")
        pass

    # 2. Hash password and insert
    hashed = hash_password(payload.password)
    try:
        supabase.table("user_credentials").insert({
            "username": username,
            "hashed_password": hashed
        }).execute()
        return True
    except Exception as e:
        print(f"Error registering user: {e}")
        raise AuthError(f"Database insertion failed: {e}")

def authenticate_user(payload: UserLogin) -> Optional[str]:
    """Verify credentials and return the canonical username if successful, else None."""
    username = payload.username.strip().lower()
    
    try:
        res = supabase.table("user_credentials") \
            .select("*") \
            .eq("username", username) \
            .execute()
        
        if not res.data or len(res.data) == 0:
            return None
            
        user_row = res.data[0]
        if not isinstance(user_row, dict):
            return None
            
        stored_hash = user_row.get("hashed_password")
        if not isinstance(stored_hash, str):
            return None
            
        if verify_password(payload.password, stored_hash):
            username_val = user_row.get("username")
            if isinstance(username_val, str):
                return username_val
            
        return None
    except Exception as e:
        print(f"Error authenticating user: {e}")
        return None
