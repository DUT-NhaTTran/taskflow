#!/usr/bin/env bash
# Build & Push TaskFlow micro-service images

set -euo pipefail

# Registry where images will be pushed (Docker Hub or Harbor)
# Example: export REGISTRY=tranminnhatdut/taskflow-backend
: "${REGISTRY:?You must export REGISTRY=<dockerhub-namespace>/taskflow-backend}"

TAG_SUFFIX="-latest"   # Must match the compose files

SERVICES=(
  Accounts-Service
  Projects-Service
  Sprints-Service
  Tasks-Service
  User-Service
  File-Service
  Notification-Service
  AI-Service
)

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR/backend"

echo "📦 Building services from $(pwd)"

autosudo() {
  if [[ $EUID -ne 0 ]]; then sudo "$@"; else "$@"; fi
}

for SERVICE in "${SERVICES[@]}"; do
  IMAGE_NAME="${SERVICE,,}"          # lowercase
  FULL_IMAGE="$REGISTRY:$IMAGE_NAME$TAG_SUFFIX"

  echo "🚀  Building $FULL_IMAGE"
  docker build -t "$FULL_IMAGE" "$SERVICE" \
    --build-arg JAR_FILE=target/*.jar

  echo "📤  Pushing $FULL_IMAGE"
  docker push "$FULL_IMAGE"
done

echo "✅ All images built and pushed successfully" 