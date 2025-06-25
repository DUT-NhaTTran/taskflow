#!/bin/bash

echo "🔄 Converting hardcoded URLs to use environment variables..."

# Add import to files that need it
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "14.225.210.28" {} \; | while read file; do
    # Check if import already exists
    if ! grep -q "import.*API_CONFIG\|import.*getApiUrl" "$file"; then
        # Add import at the top after existing imports
        sed -i '' '/import/a\
import { API_CONFIG, getApiUrl } from "@/lib/config";
' "$file"
    fi
done

# Replace URLs with config usage
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8080|`${API_CONFIG.ACCOUNTS_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8080|${API_CONFIG.ACCOUNTS_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8083|`${API_CONFIG.PROJECTS_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8083|${API_CONFIG.PROJECTS_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8084|`${API_CONFIG.SPRINTS_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8084|${API_CONFIG.SPRINTS_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8085|`${API_CONFIG.TASKS_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8085|${API_CONFIG.TASKS_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8086|`${API_CONFIG.USER_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8086|${API_CONFIG.USER_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8087|`${API_CONFIG.FILE_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8087|${API_CONFIG.FILE_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8088|`${API_CONFIG.AI_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8088|${API_CONFIG.AI_SERVICE}|g' {} \;

find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|"http://14.225.210.28:8089|`${API_CONFIG.NOTIFICATION_SERVICE}|g' {} \;
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|http://14.225.210.28:8089|${API_CONFIG.NOTIFICATION_SERVICE}|g' {} \;

echo "✅ Conversion completed!"
