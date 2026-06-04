"""Central application configuration.

All environment-derived settings are read here once so the rest of the codebase
imports from a single source of truth rather than calling ``os.getenv`` ad hoc.
"""

import os

from dotenv import load_dotenv

# Load a local ``.env`` (if present) into the process environment before any
# settings are read. python-dotenv is a declared dependency; this is the single
# place that wires it in so ``os.getenv`` below sees local overrides.
load_dotenv()


class Settings:
    """Runtime settings sourced from environment variables."""

    SUPABASE_URL: str = os.getenv("SUPABASE_URL") or "https://placeholder.supabase.co"
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") or "placeholder_key"
    JWT_SECRET: str = os.getenv("JWT_SECRET") or "calm_travel_secret_key_88f0d8a7"

    API_TITLE: str = "Calm Travel API"
    API_VERSION: str = "0.1.0"


settings = Settings()

