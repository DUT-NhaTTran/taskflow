# Project Status Migration Guide

## Overview
This migration adds a `status` column to the `projects` table to enable project lifecycle management with three states:
- **ACTIVE**: Project is currently in progress (default for new projects)
- **COMPLETED**: Project has finished but can still be accessed  
- **ARCHIVED**: Project is archived and no longer active

## ⚠️ IMPORTANT: Database Migration Required

### Step 1: Run Database Migration

**For Production Database:**
```sql
-- Connect to your production PostgreSQL database and run:
-- File: migration_add_project_status.sql

BEGIN;

-- Check if status column already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'status'
    ) THEN
        -- Add status column with default value ACTIVE
        ALTER TABLE projects 
        ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
        
        -- Create index for better query performance
        CREATE INDEX idx_projects_status ON projects(status);
        
        -- Update existing projects to have ACTIVE status
        UPDATE projects 
        SET status = 'ACTIVE';
        
        -- Add check constraint to ensure valid status values
        ALTER TABLE projects 
        ADD CONSTRAINT chk_projects_status 
        CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED'));
        
        -- Add comment to document the column
        COMMENT ON COLUMN projects.status IS 'Project status: ACTIVE (in progress), COMPLETED (finished), ARCHIVED (closed)';
        
        RAISE NOTICE 'Successfully added status column to projects table';
    ELSE
        RAISE NOTICE 'Status column already exists in projects table';
    END IF;
END $$;

COMMIT;
```

### Step 2: Deploy Backend Changes

```bash
# Navigate to Projects-Service
cd backend/Projects-Service

# Rebuild the service
mvn clean package -DskipTests

# Restart the service (assuming Docker)
docker-compose restart projects-service
```

### Step 3: Verify Migration Success

**Check Database:**
```sql
-- Verify column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'status';

-- Check existing projects have ACTIVE status
SELECT id, name, status FROM projects LIMIT 5;

-- Verify constraint exists
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'chk_projects_status';
```

**Test API Endpoints:**

1. **Get Project (should include status)**:
```bash
curl -X GET "http://localhost:8082/api/projects/{project-id}" \
  -H "X-User-Id: {your-user-id}"
```

2. **Create New Project (status defaults to ACTIVE)**:
```bash
curl -X POST "http://localhost:8082/api/projects" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {your-user-id}" \
  -d '{
    "name": "Test Project",
    "description": "Testing status feature",
    "projectType": "Software",
    "access": "PRIVATE"
  }'
```

3. **Archive Project**:
```bash
curl -X PUT "http://localhost:8082/api/projects/{project-id}/archive" \
  -H "X-User-Id: {your-user-id}"
```

## Code Changes Summary

### Backend Changes Made:

1. **Projects Model** (`backend/Projects-Service/src/main/java/com/tmnhat/projectsservice/model/Projects.java`):
   - Added `status` field with getter/setter
   - Updated Builder pattern to support status

2. **ProjectStatus Constants** (`backend/Projects-Service/src/main/java/com/tmnhat/projectsservice/model/ProjectStatus.java`):
   - New file with status constants and validation

3. **ProjectDAO** (`backend/Projects-Service/src/main/java/com/tmnhat/projectsservice/repository/ProjectDAO.java`):
   - Updated all SQL queries to include status column
   - Modified `archiveProject()` to set status to 'ARCHIVED'
   - Updated `mapResultSetToProject()` to read status from database

4. **ProjectServiceImpl** (`backend/Projects-Service/src/main/java/com/tmnhat/projectsservice/service/Impl/ProjectServiceImpl.java`):
   - Added default status setting for new projects (ACTIVE)
   - Imported ProjectStatus constants

## Frontend Integration

The frontend already has the Archive Project functionality implemented. After migration:

1. **Archive Button**: Will work correctly (sets status to 'ARCHIVED')
2. **Project Status Display**: Status will be available in project objects
3. **Filtering**: Can potentially filter projects by status

## Rollback Plan

If issues occur, you can rollback the migration:

```sql
-- Remove status column (WARNING: This will lose status data)
ALTER TABLE projects DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_projects_status;
```

## Validation Checklist

- [ ] Database migration completed successfully
- [ ] Backend service restarted without errors
- [ ] Existing projects show status = 'ACTIVE'
- [ ] New projects default to status = 'ACTIVE'
- [ ] Archive project functionality works
- [ ] Frontend Archive button works correctly
- [ ] API responses include status field

## Troubleshooting

**If backend fails to start:**
1. Check if database column was added correctly
2. Verify all existing projects have non-null status values
3. Check application logs for SQL errors

**If API returns errors:**
1. Ensure database migration completed fully
2. Check that status constraint allows 'ACTIVE', 'COMPLETED', 'ARCHIVED'
3. Verify Projects model includes status field

## Future Enhancements

With status column in place, you can now implement:
- Project filtering by status
- Bulk status operations
- Project lifecycle automation
- Status-based permissions
- Project completion workflows 