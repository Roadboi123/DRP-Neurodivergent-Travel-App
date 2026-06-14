import sys
import os

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.integrations.supabase import supabase

def test_delete():
    # Insert a temporary row
    res_insert = supabase.table("reported_warnings").insert({
        "id": "w_scratch_test_123",
        "username": "scratch_user",
        "warning_type": "people",
        "title": "Scratch test",
        "description": "Scratch test description",
        "lat": 51.5,
        "lon": -0.1
    }).execute()
    print("Insert response data:", res_insert.data)

    # Delete it
    res_delete = supabase.table("reported_warnings").delete().eq("id", "w_scratch_test_123").execute()
    print("Delete response data:", res_delete.data)

if __name__ == "__main__":
    test_delete()
