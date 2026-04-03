# ── Stage 1: Build dlib (requires cmake + C++ compiler) ──
FROM python:3.11-slim AS builder

# Limit build parallelism and disable pip caching to reduce memory use
ENV MAX_JOBS=1
ENV PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
# Install heavy deps in sequence to avoid RAM spikes
RUN pip install --prefix=/install numpy \
    && pip install --prefix=/install dlib face_recognition \
    && pip install --prefix=/install -r requirements.txt


# ── Stage 2: Production image ──
FROM python:3.11-slim

# Runtime dependencies for OpenCV and dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app
COPY . .

# Create data directories
RUN mkdir -p data/unknown_faces data/temp_videos

# Render sets PORT env var; default to 8000
ENV PORT=8000

EXPOSE ${PORT}

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
