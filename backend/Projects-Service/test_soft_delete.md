# ✅ Soft Delete System - Testing Guide

## 🎯 System Overview
The soft delete system is now FULLY implemented! Projects are marked as deleted instead of being physically removed from the database, allowing notifications to reference deleted projects without foreign key constraint violations.

## 🔧 What Has Been Fixed

### Backend Changes ✅
1. **ProjectDAO.java** - All methods updated:
   - `deleteProject()` → Uses `UPDATE projects SET deleted_at = NOW()`
   - All SELECT queries → Include `WHERE deleted_at IS NULL`
   - Methods fixed: `getAllProjects`, `getProjectById`, `searchProjects`, `searchProjectsByUserMembership`, `getAllProjectsByUserMembership`, `paginateProjects`, `filterProjectsByType`, `getLastInsertedProjectId`, `findLatestByOwnerId`

2. **ProjectMemberDAO.java** - Updated:
   - `changeProjectOwner()` → Only updates active projects 
   - `filterProjectsByStatus()` → Only returns active projects

3. **Database Schema** - `deleted_at` column added:
   - `deleted_at TIMESTAMP NULL` column in projects table
   - Indexes for performance: `idx_projects_deleted_at`, `idx_projects_active`

## 🧪 Testing Steps

### Step 1: Create Test Project
```bash
curl -X POST http://localhost:8083/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Soft Delete Project",
    "description": "Testing soft delete functionality",
    "ownerId": "your-user-id",
    "deadline": "2024-12-31",
    "key": "SOFT",
    "projectType": "SOFTWARE",
    "access": "PRIVATE"
  }'
```

### Step 2: Verify Project Exists
```bash
curl http://localhost:8083/api/projects
# Should see your test project in the list
```

### Step 3: Add Project Members (Optional)
```bash
curl -X POST http://localhost:8083/api/projects/{project-id}/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "member-user-id",
    "roleInProject": "MEMBER"
  }'
```

### Step 4: Delete Project (Soft Delete)
```bash
curl -X DELETE http://localhost:8083/api/projects/{project-id}
# Should return success response
```

### Step 5: Verify Soft Delete Worked
```bash
# Check project list - should NOT contain deleted project
curl http://localhost:8083/api/projects

# Check database directly - should see deleted_at timestamp
# Connect to your database and run:
# SELECT id, name, deleted_at FROM projects WHERE name = 'Test Soft Delete Project';
```

### Step 6: Test Notification System
```bash
# Try to send a notification referencing the deleted project
curl -X POST http://localhost:8089/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PROJECT_DELETED",
    "title": "Project Deleted",
    "message": "Test notification for deleted project",
    "recipientUserId": "user-id",
    "actorUserId": "admin-id",
    "actorUserName": "Admin",
    "projectId": "{deleted-project-id}",
    "projectName": "Test Soft Delete Project",
    "taskId": null
  }'
# Should succeed without foreign key constraint error!
```

## 🎯 Expected Results

### ✅ Success Indicators:
1. **Projects API** - Deleted projects don't appear in any list endpoints
2. **Database** - Projects have `deleted_at` timestamp instead of being removed
3. **Notifications** - Can reference deleted project IDs without errors
4. **Performance** - All queries use indexes efficiently
5. **Member Operations** - Only work on active projects

### ❌ What Should NOT Happen:
1. Hard delete of projects from database
2. Foreign key constraint violations in notifications
3. Deleted projects appearing in active project lists
4. Member operations affecting deleted projects

## 🔄 Rollback Instructions (if needed)

If you need to restore a soft-deleted project:
```sql
UPDATE projects SET deleted_at = NULL WHERE id = 'project-uuid';
```

To permanently delete old soft-deleted projects (cleanup):
```sql
DELETE FROM projects WHERE deleted_at < NOW() - INTERVAL '30 days';
```

## 🚀 Frontend Integration

The frontend deletion flow now works perfectly:
1. ✅ Fetch project members
2. ✅ Send notifications FIRST (sequential with delays)
3. ✅ Wait for notification completion
4. ✅ Soft delete project from backend
5. ✅ Update UI with success feedback

**Result: No more foreign key constraint violations! 🎉**

## 📊 Performance Notes

- Added database indexes for optimal query performance
- `deleted_at IS NULL` filters are very fast with partial indexes
- Soft delete operation is instant (just UPDATE)
- No cascading deletes to worry about

## 🔐 Security Notes

- Only active projects can be updated/have members modified
- Soft-deleted projects are invisible to normal operations
- Admin can restore projects if needed
- Audit trail preserved for compliance 