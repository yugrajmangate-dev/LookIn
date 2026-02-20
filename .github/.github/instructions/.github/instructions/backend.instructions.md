---
applyTo: "backend/**/*"
---
# Backend specific rules
- Use FastAPI decorators for all routing (e.g., `@app.post()`, `@app.get()`).
- Use Pydantic models for all request and response validation.
- All heavy OpenCV processing (like cross-division video analysis) must be executed as asynchronous background tasks using FastAPI's `BackgroundTasks` to prevent blocking the main thread.
- Standardize all CSV operations using Pandas.