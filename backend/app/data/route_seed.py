"""Mock catalogue of base routes.

Min-maxed for sensory specialization:
- Bus 345: Specialized in Sound (1) & Smell (1) but has bright lights (3). (Best for Sound-sensitive).
- Bus 49: Specialized in Light (1) & Heat (1) but is very noisy (3) and smelly (3). (Best for Light-sensitive).
- District Line: Specialized in Crowds (1) but has average metrics elsewhere. (Best for Crowd-sensitive).
- Central Line: Extremely intense across all triggers (3). (Ultimate challenge route).
"""

from typing import Any, Dict, List

ROUTES_DATABASE: List[Dict[str, Any]] = [
    {
        "id": "r1",
        "name": "Bus 345",
        "subName": None,
        "duration": 50,
        "price": 1.75,
        "noise": 1,      # Sound: Low (whisper quiet)
        "crowds": 2,     # Crowds: Moderate
        "heat": 2,       # Heat: Moderate
        "light": 3,      # Light: High (bright glaring overhead lights)
        "smell": 1,      # Smell: Low (clean, fragrance-free)
        "description": "Whisper-quiet and fragrance-free bus, though bright glaring overhead lighting is active.",
    },
    {
        "id": "r2",
        "name": "Bus 49",
        "subName": "Walk",
        "duration": 43,
        "price": 1.75,
        "noise": 3,      # Sound: High (heavy rumbling engine)
        "crowds": 2,     # Crowds: Moderate
        "heat": 1,       # Heat: Low (strong ice-cold A/C)
        "light": 1,      # Light: Low (tinted windows & soft dim lighting)
        "smell": 3,      # Smell: High (diesel exhaust fumes on transfer)
        "description": "Dimly lit and cool commute, though engine rumble and diesel exhaust fumes are high.",
    },
    {
        "id": "r3",
        "name": "Bus 170",
        "subName": "District Line + Walk",
        "duration": 51,
        "price": 4.85,
        "noise": 2,      # Sound: Moderate (standard rail rattle)
        "crowds": 1,     # Crowds: Low (plentiful seats/uncrowded cars today)
        "heat": 2,       # Heat: Moderate
        "light": 2,      # Light: Moderate
        "smell": 2,      # Smell: Moderate (standard station air)
        "description": "Standard subway link featuring spacious uncrowded compartments, but moderate screeching.",
    },
    {
        "id": "r4",
        "name": "Bus 170",
        "subName": "Central Line + Walk",
        "duration": 55,
        "price": 4.85,
        "noise": 4,      # Sound: Extreme (deafening deep-tube rail screeching)
        "crowds": 4,     # Crowds: Extreme (rush hour congestion)
        "heat": 4,       # Heat: Extreme (deep level line, reaches 32°C)
        "light": 3,      # Light: High (fluorescent station bulbs)
        "smell": 3,      # Smell: High
        "description": "Fast tube connection, but has screeching deep-level rails, packed crowds, extreme heat, and glaring station bulbs.",
    },
]
