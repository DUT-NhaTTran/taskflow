# UUID Migration Guide: Comments Table task_id Field

## 📋 **Overview**
This migration updates the `task_id` field in the `comments` table from `VARCHAR(255)` to `UUID` to ensure proper referential integrity with the `tasks` table.

## 🚀 **Migration Steps**

### 1. **Database Schema Changes**

#### Before Migration:
```sql
-- Backup existing data
CREATE TABLE comments_backup AS SELECT * FROM comments;
```

#### Execute Migration:
```sql
-- Run the migration script
SOURCE update_comments_task_id_to_uuid.sql;
```

#### Verify Migration:
```sql
-- Test the changes
SOURCE test_uuid_comments.sql;
```

### 2. **Code Changes Made**

#### ✅ **Backend Changes:**

**Model Updates:**
- `Comment.java`: Updated `taskId` field from `String` to `UUID`
- Added proper UUID imports and type handling

**Repository Updates:**
- `CommentRepository.java`: Updated all methods to handle `UUID taskId`
- Enhanced row mapper to handle UUID conversion
- Updated SQL parameter handling

**Service Updates:**
- `CommentService.java`: Updated method signatures to use `UUID taskId`
- All CRUD operations now properly handle UUID

**Controller Updates:**
- `CommentController.java`: Added UUID validation and conversion
- Enhanced error handling for invalid UUID formats
- Updated notification integration

**DAO Updates:**
- `TasksDAO.java`: Fixed `addCommentToTask` to use correct `comments` table

#### ✅ **Database Schema:**
- `comments_table.sql`: Updated to use `UUID` for `task_id`
- Added foreign key constraint for referential integrity
- Migration script created for existing data

#### ✅ **Frontend:**
- No changes needed - frontend already handles `taskId` as string
- UUID values are automatically converted to string in JSON responses

## 🔧 **Technical Details**

### **New Table Structure:**
```sql
CREATE TABLE comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id UUID NOT NULL,                    -- ✅ Changed from VARCHAR(255)
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    parent_comment_id BIGINT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    
    -- ✅ Added foreign key constraint
    CONSTRAINT fk_comments_task_id 
        FOREIGN KEY (task_id) REFERENCES tasks(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);
```

### **Java Model Changes:**
```java
public class Comment {
    private UUID taskId;  // ✅ Changed from String
    
    // Updated getters/setters
    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }
}
```

### **API Changes:**
- All comment endpoints now properly validate UUID format
- Enhanced error messages for invalid UUIDs
- Backward compatibility maintained for JSON responses

## 🧪 **Testing**

### **Run Tests:**
```bash
# Execute test script
mysql -u username -p database_name < test_uuid_comments.sql
```

### **Verification Checklist:**
- [ ] Comments can be created with valid task UUIDs
- [ ] Invalid UUIDs are properly rejected
- [ ] Foreign key constraints are enforced
- [ ] Existing comments are preserved
- [ ] Frontend integration works correctly
- [ ] Notifications still work

## 📁 **Files Modified**

### **Database Files:**
- `comments_table.sql` - Updated table structure
- `update_comments_task_id_to_uuid.sql` - Migration script
- `test_uuid_comments.sql` - Test verification

### **Backend Java Files:**
- `Comment.java` - Model with UUID taskId
- `CommentRepository.java` - Repository with UUID handling
- `CommentService.java` - Service layer updates
- `CommentController.java` - Controller with UUID validation
- `TasksDAO.java` - Fixed comment insertion method

### **Frontend Files:**
- No changes required - existing code compatible

## ⚠️ **Important Notes**

1. **Backup Data:** Always backup before running migration
2. **UUID Format:** All taskId values must be valid UUIDs
3. **Foreign Keys:** Orphaned comments will be removed during migration
4. **API Compatibility:** Frontend code continues to work without changes
5. **Error Handling:** Enhanced validation for UUID format in API calls

## 🔄 **Rollback Plan**

If rollback is needed:
```sql
-- Restore from backup
DROP TABLE comments;
RENAME TABLE comments_backup TO comments;

-- Revert code changes in git
git checkout HEAD~1 -- backend/Tasks-Service/src/main/java/com/tmnhat/tasksservice/
```

## ✅ **Migration Complete**

After successful migration:
- All comments properly reference tasks via UUID
- Referential integrity is enforced
- API endpoints validate UUID format
- Frontend integration remains seamless
- Database performance is improved with proper indexing

---

**🎉 Migration completed successfully! Comments now use UUID for task_id with proper referential integrity.** 