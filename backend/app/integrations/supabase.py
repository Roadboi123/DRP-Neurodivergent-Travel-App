from supabase import create_client
import os

print({k:v for k,v in os.environ.items()})
print("SUPABASE_URL =", os.getenv("SUPABASE_URL"))
print("SUPABASE_KEY exists =", bool(os.getenv("SUPABASE_KEY")))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)