"""Central application configuration.

All environment-derived settings are read here once so the rest of the codebase
imports from a single source of truth rather than calling ``os.getenv`` ad hoc.
"""

import os


class Settings:
    """Runtime settings sourced from environment variables."""

    SUPABASE_URL: str = os.getenv("SUPABASE_URL") or "https://placeholder.supabase.co"
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") or "placeholder_key"

    API_TITLE: str = "Calm Travel API"
    API_VERSION: str = "0.1.0"


settings = Settings()
