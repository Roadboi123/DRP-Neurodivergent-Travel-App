import uuid

from fastapi import APIRouter

from app.integrations.supabase import supabase

router = APIRouter()


@router.get("/supabase-test")
def supabase_healthcheck():
    """Round-trip an insert/select/delete against Supabase to verify connectivity."""
    test_id = str(uuid.uuid4())

    # 1. INSERT test row
    insert_response = supabase.table("healthcheck").insert({
        "id": test_id,
        "message": "backend-healthcheck"
    }).execute()

    if insert_response.data is None:
        return {
            "status": "failed",
            "stage": "insert",
            "error": insert_response
        }

    # 2. READ it back
    select_response = supabase.table("healthcheck") \
        .select("*") \
        .eq("id", test_id) \
        .execute()

    if not select_response.data:
        return {
            "status": "failed",
            "stage": "select"
        }

    # 3. DELETE test row
    supabase.table("healthcheck") \
        .delete() \
        .eq("id", test_id) \
        .execute()

    return {
        "status": "success",
        "inserted": True,
        "selected": True,
        "deleted": True,
        "supabase_response_sample": select_response.data
    }
