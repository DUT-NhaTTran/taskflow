# Build stage for File Service with Common dependency
FROM eclipse-temurin:21-jdk AS build

# Install Maven
RUN apt-get update && \
    apt-get install -y maven && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy the entire backend workspace (this Dockerfile should be run from backend directory)
COPY . .

# First, build and install the common module
WORKDIR /workspace/common
RUN mvn clean install -DskipTests

# Then build the file service
WORKDIR /workspace/File-Service
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy built jar from build stage
COPY --from=build /workspace/File-Service/target/*.jar app.jar

# Create non-root user
RUN addgroup --system spring && adduser --system spring --ingroup spring
USER spring:spring

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8087/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "/app/app.jar"] 