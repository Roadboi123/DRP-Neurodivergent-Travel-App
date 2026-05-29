from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL") or "https://placeholder.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or "placeholder_key"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)