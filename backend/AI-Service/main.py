from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
from models.story_point_estimator import StoryPointEstimator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Story Point Estimation Service", version="2.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8085", "http://localhost:8088"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
estimator = None

class TaskData(BaseModel):
    title: str
    description: Optional[str] = ""
    label: Optional[str] = None
    priority: Optional[str] = None
    attachments_count: Optional[int] = None

@app.on_event("startup")
async def startup_event():
    """Initialize the model on startup"""
    global estimator
    try:
        estimator = StoryPointEstimator()
        if not estimator.is_trained():
            estimator.train([])  # Train with default data
        logger.info("✅ Story Point Estimator initialized")
    except Exception as e:
        logger.error(f"Failed to initialize model: {e}")
        estimator = None

@app.get("/")
async def root():
    """Health check"""
    return {
        "message": "AI Story Point Service", 
        "status": "running", 
        "model_loaded": estimator is not None and estimator.is_trained()
    }

@app.post("/estimate")
async def estimate_story_points(task: TaskData):
    """Estimate story points - CORE FUNCTIONALITY"""
    if estimator is None:
        raise HTTPException(status_code=503, detail="Model not available")
    
    try:
        result = estimator.estimate(
            title=task.title,
            description=task.description,
            priority=task.priority,
            attachments_count=task.attachments_count,
            task_type=task.label
        )
        
        return {
            "estimated_story_points": result["story_points"],
            "confidence": result["confidence"],
            "reasoning": result["reasoning"],
            "features_used": result["features"]
        }
        
    except Exception as e:
        logger.error(f"Error estimating: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/status")
async def get_model_status():
    """Get model status"""
    if estimator is None:
        return {"status": "not_loaded", "trained": False}
    
    return {
        "status": "loaded",
        "trained": estimator.is_trained(),
        "model_info": estimator.get_model_info()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088) 