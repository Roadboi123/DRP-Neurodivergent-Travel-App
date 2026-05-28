from pydantic import BaseModel

class JourneyRequest(BaseModel):
    origin: str
    destination: str
    preference: str

class JourneyResponse(BaseModel):
    summary: str
    steps: list[str]