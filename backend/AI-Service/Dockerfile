# Multi-stage build for Python FastAPI
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system fastapi && adduser --system fastapi --ingroup fastapi

# Create necessary directories with proper permissions
RUN mkdir -p /app/models /app/logs /app/data /app/nltk_data /home/fastapi/.local && \
    chown -R fastapi:fastapi /app /home/fastapi

# Set work directory
WORKDIR /app

# Copy dependencies from builder stage to user directory with proper ownership
COPY --from=builder --chown=fastapi:fastapi /root/.local /home/fastapi/.local

# Copy application code with proper ownership
COPY --chown=fastapi:fastapi . .

# Switch to non-root user early for downloads
USER fastapi:fastapi

# Set PATH and PYTHONPATH for packages
ENV PATH=/home/fastapi/.local/bin:$PATH
ENV PYTHONPATH=/home/fastapi/.local/lib/python3.11/site-packages

# Download NLTK data as non-root user (including punkt_tab)
RUN python -c "import nltk; nltk.download('punkt', download_dir='/app/nltk_data'); nltk.download('punkt_tab', download_dir='/app/nltk_data'); nltk.download('stopwords', download_dir='/app/nltk_data')"
ENV NLTK_DATA=/app/nltk_data

# Expose port
EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8088/ || exit 1

# Run the application using Python module directly (like in setup script)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8088"] 