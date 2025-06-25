#!/usr/bin/env bash
set -euo pipefail

# ========= CONFIG =========
REGISTRY_REPO="tranminnhatdut/taskflow-backend"
TAG="ai-service-$(date +%Y%m%d%H%M)"    # ex: ai-service-202406241530
SERVICE_NAME="ai-service"
VPS_USER="root"
VPS_IP="14.225.210.28"
REMOTE_STACK_DIR="~/taskflow"           # thư mục chứa docker-compose.production.yml
TEST_JSON_FIELD="title_length"          # field phải xuất hiện để coi là OK
TEST_PORT=8088
# ==========================

echo "=========== 1. Build image locally ==========="
docker build -t "${REGISTRY_REPO}:${TAG}" ./backend/AI-Service

echo "=========== 2. Push image lên Docker Hub ==========="
docker push "${REGISTRY_REPO}:${TAG}"

echo "=========== 3. Triển khai trên VPS ==========="
ssh "${VPS_USER}@${VPS_IP}" bash <<EOF
  set -euo pipefail
  cd ${REMOTE_STACK_DIR}

  echo " » Stop & remove old container"
  docker compose -f docker-compose.production.yml rm -sf ${SERVICE_NAME} || true

  echo " » Remove old images của AI-Service (giữ service khác)"
  docker image ls ${REGISTRY_REPO} --format '{{.Repository}}:{{.Tag}}' |
    grep ai-service | grep -v ${TAG} | xargs -r docker image rm -f || true

  echo " » Pull image mới"
  docker pull ${REGISTRY_REPO}:${TAG}

  echo " » Sửa compose để dùng tag mới"
  sed -i "s@image: .*@image: ${REGISTRY_REPO}:${TAG}@" docker-compose.production.yml

  echo " » Khởi động container mới"
  docker compose -f docker-compose.production.yml up -d ${SERVICE_NAME}

  echo " » Đợi container healthy"
  until [ "\$(docker inspect --format='{{.State.Health.Status}}' ${SERVICE_NAME})" = "healthy" ]; do
     printf '.'
     sleep 3
  done
  echo " [healthy]"

  echo " » Test API nội bộ..."
  JSON=\$(curl -s -X POST http://localhost:${TEST_PORT}/estimate \
       -H "Content-Type: application/json" \
       -d '{"title":"Implement OAuth2 authentication","description":"Create OAuth2 flow with Google & GitHub"}')

  echo "\$JSON" | grep -q "${TEST_JSON_FIELD}"  || { echo "❌ API thiếu trường ${TEST_JSON_FIELD}"; exit 1; }
  echo "✅ API chứa trường ${TEST_JSON_FIELD} – triển khai thành công"
EOF

echo "=========== Hoàn tất – AI-Service ${TAG} đã chạy trên VPS ==========="
echo "Bạn có thể tự test:  curl -X POST http://${VPS_IP}:${TEST_PORT}/estimate …"