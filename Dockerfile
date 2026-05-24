# Stage 1: Build the React Frontend
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Python Backend
FROM python:3.9-slim
WORKDIR /app

# Install system dependencies if any are needed for pandas/numpy
RUN apt-get update && apt-get install -y gcc

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install python-dotenv requests finvizfinance

# Copy backend source code
COPY . .

# Copy the built React UI from Stage 1
COPY --from=build /app/dist /app/dist

# Expose the Flask port
EXPOSE 5000

# Run the unified server
CMD ["python", "server.py"]
