"""
AnnSetu ML Spoilage Prediction Service
FastAPI microservice — Port 8000

Mathematical Spoilage Model:
  - Base shelf life at 25°C reference
  - Non-Veg multiplier: 0.82
  - Q10 temperature coefficient: –3.5% per °C above 25°C
  - Bulk heat retention penalty: –0.3 hrs for ≥300 portions

Safety Thresholds:
  - SAFE:     remaining ≥ 1.5 hrs
  - CRITICAL: 0.5 ≤ remaining < 1.5 hrs
  - BLOCKED:  remaining < 0.5 hrs → Biogas/Compost diversion
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta

app = FastAPI(
    title="AnnSetu ML Spoilage Prediction Service",
    description="Predicts food spoilage windows for the AnnSetu food rescue platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base shelf life hours at 25°C reference temperature (FSSAI guidelines)
BASE_SHELF_LIFE: dict[str, float] = {
    "Cooked Rice & Curry": 4.5,
    "Dairy & Sweets": 3.0,
    "Bread & Dry Sabzi": 8.0,
    "Fried Snacks": 6.0,
}


class SpoilageInput(BaseModel):
    food_type: str
    dietary_type: str = "Veg"
    quantity_portions: int = 100
    hours_since_cooked: float = 0.0
    storage_temp_c: float = 25.0


class SpoilageOutput(BaseModel):
    remaining_safe_hours: float
    safe_until_timestamp: str
    safety_status: str
    model_used: str = "ml_service"


@app.post("/predict-spoilage", response_model=SpoilageOutput)
def predict_spoilage(data: SpoilageInput) -> SpoilageOutput:
    base_life = BASE_SHELF_LIFE.get(data.food_type, 4.0)

    # Non-Veg multiplier
    if data.dietary_type == "Non-Veg":
        base_life *= 0.82

    # Temperature coefficient (Q10): Reduce by 3.5% for every 1°C above 25°C
    if data.storage_temp_c > 25:
        temp_delta = data.storage_temp_c - 25
        base_life *= (1 - 0.035) ** temp_delta

    # Bulk heat retention penalty
    if data.quantity_portions >= 300:
        base_life -= 0.3

    remaining_safe_hours = max(0.0, base_life - data.hours_since_cooked)
    safe_until = datetime.now() + timedelta(hours=remaining_safe_hours)

    if remaining_safe_hours < 0.5:
        safety_status = "BLOCKED"
    elif remaining_safe_hours < 1.5:
        safety_status = "CRITICAL"
    else:
        safety_status = "SAFE"

    return SpoilageOutput(
        remaining_safe_hours=round(remaining_safe_hours, 2),
        safe_until_timestamp=safe_until.isoformat(),
        safety_status=safety_status,
        model_used="ml_service",
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "AnnSetu ML Spoilage Service", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
