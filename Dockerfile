# Use the official Python base image
FROM python:3.11-slim

# Install necessary system dependencies for Playwright execution
# Playwright Chromium heavily depends on these Linux libraries 
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file specifically from the scripts folder
COPY scripts/requirements.txt ./scripts/

# Install Python packages
RUN pip install --no-cache-dir -r scripts/requirements.txt

# Install Playwright and its necessary Chromium browser binary
RUN playwright install chromium
RUN playwright install-deps

# Copy the entire scripts directory into the container
COPY scripts/ ./scripts/

# Expose the internal Flask health-check port 
EXPOSE 8765

# Declare standard environment variables (MongoDB URI will be injected by Render dashboard)
ENV PYTHONUNBUFFERED=1
ENV PORT=8765

# Run the 24/7 scheduler
CMD ["python", "scripts/scheduler.py"]
