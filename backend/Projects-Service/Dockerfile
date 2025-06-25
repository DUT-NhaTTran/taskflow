# Build stage for Projects Service with Common dependency
FROM eclipse-temurin:21-jdk AS build

# Install Maven
RUN apt-get update && \
    apt-get install -y maven && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy parent pom and common module first
COPY pom.xml .
COPY common/ ./common/

# Build and install common module first
WORKDIR /workspace/common
RUN mvn clean install -DskipTests

# Copy Projects Service pom and source
WORKDIR /workspace
COPY Projects-Service/pom.xml ./Projects-Service/
COPY Projects-Service/src/ ./Projects-Service/src/

# Build the projects service
WORKDIR /workspace/Projects-Service
RUN mvn dependency:go-offline -DskipTests
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy built jar from build stage
COPY --from=build /workspace/Projects-Service/target/*.jar app.jar

# Create non-root user
RUN addgroup --system spring && adduser --system spring --ingroup spring
USER spring:spring

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8083/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "/app/app.jar"] 