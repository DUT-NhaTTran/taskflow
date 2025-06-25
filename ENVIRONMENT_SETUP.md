# 🔧 TaskFlow Frontend Environment Setup

## 📋 Overview
Frontend đã được cấu hình để sử dụng environment variables cho API URLs thay vì hardcoded URLs.

## 🏗️ Architecture
```
frontend/src/lib/config.ts       # API configuration
frontend/.env.example            # Environment template
frontend/.env.production         # Production settings (Vietnix)
frontend/.env.local              # Development settings (localhost)
```

## 🌍 Environment Files

### Development (.env.local)
```bash
NEXT_PUBLIC_ACCOUNTS_API_URL=http://localhost:8080
NEXT_PUBLIC_PROJECTS_API_URL=http://localhost:8083
NEXT_PUBLIC_SPRINTS_API_URL=http://localhost:8084
NEXT_PUBLIC_TASKS_API_URL=http://localhost:8085
NEXT_PUBLIC_USER_API_URL=http://localhost:8086
NEXT_PUBLIC_FILE_API_URL=http://localhost:8087
NEXT_PUBLIC_AI_API_URL=http://localhost:8088
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:8089
```

### Production (.env.production)
```bash
NEXT_PUBLIC_ACCOUNTS_API_URL=http://14.225.210.28:8080
NEXT_PUBLIC_PROJECTS_API_URL=http://14.225.210.28:8083
NEXT_PUBLIC_SPRINTS_API_URL=http://14.225.210.28:8084
NEXT_PUBLIC_TASKS_API_URL=http://14.225.210.28:8085
NEXT_PUBLIC_USER_API_URL=http://14.225.210.28:8086
NEXT_PUBLIC_FILE_API_URL=http://14.225.210.28:8087
NEXT_PUBLIC_AI_API_URL=http://14.225.210.28:8088
NEXT_PUBLIC_NOTIFICATION_API_URL=http://14.225.210.28:8089
```

## 💻 Usage in Code

### Import API_CONFIG
```typescript
import { API_CONFIG } from "@/lib/config";
```

### Use in API calls
```typescript
// ❌ Old way (hardcoded)
const response = await axios.get("http://14.225.210.28:8080/api/auth/login");

// ✅ New way (dynamic)
const response = await axios.get(`${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/login`);
```

## 🚀 How to Switch Environments

### For Development (localhost)
```bash
cp .env.example .env.local
# Edit .env.local with localhost URLs
```

### For Production (Vietnix)
```bash
cp .env.production .env.local
# Or set NODE_ENV=production
```

### For New Server
```bash
# Edit .env.production with new IPs
NEXT_PUBLIC_ACCOUNTS_API_URL=http://NEW_SERVER_IP:8080
# ... update all URLs
```

## 📊 Migration Summary
- ✅ **25 files** converted to use API_CONFIG
- ✅ **0 hardcoded URLs** remaining
- ✅ **8 services** configurable via environment
- ✅ **Backward compatible** with existing code

## 🔄 Services Mapping
| Service | Port | Environment Variable |
|---------|------|---------------------|
| Accounts | 8080 | NEXT_PUBLIC_ACCOUNTS_API_URL |
| Projects | 8083 | NEXT_PUBLIC_PROJECTS_API_URL |
| Sprints | 8084 | NEXT_PUBLIC_SPRINTS_API_URL |
| Tasks | 8085 | NEXT_PUBLIC_TASKS_API_URL |
| User | 8086 | NEXT_PUBLIC_USER_API_URL |
| File | 8087 | NEXT_PUBLIC_FILE_API_URL |
| AI | 8088 | NEXT_PUBLIC_AI_API_URL |
| Notification | 8089 | NEXT_PUBLIC_NOTIFICATION_API_URL |
