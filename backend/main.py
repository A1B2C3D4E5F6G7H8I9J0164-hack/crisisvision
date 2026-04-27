from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="CrisisVision API", description="AI/ML backend for CrisisVision")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    # Example input payload
    text: str = None

@app.get("/")
def read_root():
    return {"message": "Welcome to the CrisisVision AI API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/predict")
def predict(request: PredictionRequest):
    # TODO: Connect to ML models here
    # Example:
    # result = model.predict(request.text)
    return {
        "status": "success",
        "input_received": request.text,
        "prediction": "dummy_prediction_placeholder"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
