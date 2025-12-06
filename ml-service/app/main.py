from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from app.routers import forecasting, recommendations

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Enalysis ML Service",
    description="Machine Learning service for energy management recommendations",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://btm-5sw1fyvj9-khosropourarman-gmailcoms-projects.vercel.app",  # Vercel production
        "https://enalysis.io",  # Custom domain (when configured)
        "https://www.enalysis.io",  # Custom domain with www
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(forecasting.router, prefix="/api/forecast", tags=["forecasting"])
app.include_router(recommendations.router, prefix="/api/recommend", tags=["recommendations"])

@app.get("/")
async def root():
    return {
        "service": "Enalysis ML Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    # Railway uses PORT env var, fall back to API_PORT or 8000
    port = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
