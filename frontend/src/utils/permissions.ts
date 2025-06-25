import axios from 'axios';
import { API_CONFIG } from "@/lib/config";

// Interface cho permissions response từ backend
export interface UserPermissions {
  userId: string;
  projectId: string;
  role: string;
  isOwner: boolean;
  isScrumMaster: boolean;
  canManageProject: boolean;
  canManageMembers: boolean;
  canCreateSprint: boolean;
  canManageSprints: boolean;
  canManageAnyTask: boolean;
  canAssignTasks: boolean;
  canViewReports: boolean;
  canTrainAI: boolean;
}

// Cache để lưu permissions (tránh gọi API liên tục)
const permissionsCache = new Map<string, { permissions: UserPermissions; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Lấy permissions của user trong project
export const getUserPermissions = async (userId: string, projectId: string): Promise<UserPermissions | null> => {
  const cacheKey = `${userId}-${projectId}`;
  const cached = permissionsCache.get(cacheKey);
  
  // Check cache first
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('🔄 Using cached permissions:', cached.permissions);
    return cached.permissions;
  }
  
  try {
    console.log('🌐 Fetching fresh permissions for:', { userId, projectId });
    const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members/${userId}/permissions`);
    
    console.log('📋 Permission API response:', response.data);
    
    if (response.data?.status === 'SUCCESS' && response.data?.data) {
      const permissions = response.data.data as UserPermissions;
      
      console.log('✅ Parsed permissions:', permissions);
      
      // Cache the result
      permissionsCache.set(cacheKey, {
        permissions,
        timestamp: Date.now()
      });
      
      return permissions;
    }
    
    console.warn('⚠️ Invalid permission response format:', response.data);
    return null;
  } catch (error) {
    console.error('❌ Error fetching user permissions:', error);
    return null;
  }
};

// Clear cache cho một user/project
export const clearPermissionsCache = (userId?: string, projectId?: string) => {
  if (userId && projectId) {
    const cacheKey = `${userId}-${projectId}`;
    permissionsCache.delete(cacheKey);
    console.log('🗑️ Cleared permission cache for:', cacheKey);
  } else {
    permissionsCache.clear();
    console.log('🗑️ Cleared all permission cache');
  }
};

// Force refresh permissions (bypass cache)
export const refreshUserPermissions = async (userId: string, projectId: string): Promise<UserPermissions | null> => {
  console.log('🔄 Force refreshing permissions...');
  clearPermissionsCache(userId, projectId);
  return await getUserPermissions(userId, projectId);
};

// Permission checking functions
export const canCreateProject = (permissions: UserPermissions | null): boolean => {
  return permissions?.isOwner || false;
};

export const canManageProject = (permissions: UserPermissions | null): boolean => {
  return permissions?.canManageProject || false;
};

export const canDeleteProject = (permissions: UserPermissions | null): boolean => {
  return permissions?.isOwner || false;
};

export const canManageMembers = (permissions: UserPermissions | null): boolean => {
  return permissions?.canManageMembers || false;
};

export const canCreateSprint = (permissions: UserPermissions | null): boolean => {
  // ✅ IMPROVED: More explicit check with logging for debugging
  if (!permissions) {
    console.log('🔍 canCreateSprint: No permissions data available');
    return false;
  }
  
  const canCreate = permissions.canCreateSprint || false;
  const isOwner = permissions.isOwner || false;
  const isScrumMaster = permissions.isScrumMaster || false;
  
  console.log('🔍 canCreateSprint check:', {
    userId: permissions.userId,
    role: permissions.role,
    isOwner,
    isScrumMaster,
    canCreateSprint: permissions.canCreateSprint,
    finalResult: canCreate
  });
  
  if (!canCreate) {
    console.log('❌ CREATE_SPRINT permission denied. Only Project Owners and Scrum Masters can create sprints');
  }
  
  return canCreate;
};

export const canManageSprints = (permissions: UserPermissions | null): boolean => {
  return permissions?.canManageSprints || false;
};

export const canStartEndSprints = (permissions: UserPermissions | null): boolean => {
  // Explicit check for scrum master or project owner
  if (permissions?.isScrumMaster || permissions?.isOwner) {
    return true;
  }
  
  // Fallback to canManageSprints
  return permissions?.canManageSprints || false;
};

export const canCreateTask = (permissions: UserPermissions | null): boolean => {
  return true; // All project members can create tasks
};

export const canManageAnyTask = (permissions: UserPermissions | null): boolean => {
  return permissions?.canManageAnyTask || false;
};

export const canAssignTasks = (permissions: UserPermissions | null): boolean => {
  return permissions?.canAssignTasks || false;
};

export const canDeleteTask = (permissions: UserPermissions | null): boolean => {
  // ✅ ONLY project owners can delete tasks (soft delete) via admin action
  // Note: Task creators can also delete their own tasks (handled separately)
  return permissions?.isOwner || false;
};

export const canViewReports = (permissions: UserPermissions | null): boolean => {
  return permissions?.canViewReports || false;
};

export const canTrainAI = (permissions: UserPermissions | null): boolean => {
  return permissions?.canTrainAI || false;
};

// Check if user can edit a specific task (created by them OR assigned to them OR has admin rights)
export const canEditTask = (permissions: UserPermissions | null, taskAssigneeId: string | null, taskCreatorId: string | null, currentUserId: string): boolean => {
  // If user created the task, they can edit it
  if (taskCreatorId === currentUserId) {
    return true;
  }
  
  // If user is assigned to the task, they can edit it
  if (taskAssigneeId === currentUserId) {
    return true;
  }
  
  // Otherwise, check if they have admin permissions
  return permissions?.canManageAnyTask || false;
};

// Check if user can delete a specific task (created by them OR is project owner)
export const canDeleteTaskAsUser = (permissions: UserPermissions | null, taskCreatorId: string | null, currentUserId: string): boolean => {
  // If user created the task, they can delete it
  if (taskCreatorId === currentUserId) {
    return true;
  }
  
  // ✅ Otherwise, ONLY project owners can delete tasks (not scrum masters)
  return permissions?.isOwner || false;
};

// Legacy function for backward compatibility (when creator info is not available)
export const canEditTaskLegacy = (permissions: UserPermissions | null, taskAssigneeId: string | null, currentUserId: string): boolean => {
  // If user is assigned to the task, they can edit it
  if (taskAssigneeId === currentUserId) {
    return true;
  }
  
  // Otherwise, check if they have admin permissions
  return permissions?.canManageAnyTask || false;
};

// Check role-based permissions
export const isProjectOwner = (permissions: UserPermissions | null): boolean => {
  return permissions?.isOwner || false;
};

export const isScrumMaster = (permissions: UserPermissions | null): boolean => {
  return permissions?.isScrumMaster || false;
};

export const isAdmin = (permissions: UserPermissions | null): boolean => {
  return isProjectOwner(permissions) || isScrumMaster(permissions);
};

export const isMember = (permissions: UserPermissions | null): boolean => {
  return permissions !== null && !isAdmin(permissions);
};

// Get role display name
export const getRoleDisplayName = (permissions: UserPermissions | null): string => {
  if (!permissions) return 'Unknown';
  
  if (permissions.isOwner) return 'Project Owner';
  if (permissions.isScrumMaster) return 'Scrum Master';
  
  return permissions.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Member';
};

// Permission utils cho UI components
export const shouldShowElement = (hasPermission: boolean, fallback: boolean = false): boolean => {
  return hasPermission || fallback;
};

export const getPermissionBasedClassName = (hasPermission: boolean, allowedClass: string = '', deniedClass: string = 'opacity-50 cursor-not-allowed'): string => {
  return hasPermission ? allowedClass : deniedClass;
};

// Hook để use trong React components (nếu cần)
export const usePermissions = (userId: string | null, projectId: string | null) => {
  const [permissions, setPermissions] = React.useState<UserPermissions | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  React.useEffect(() => {
    if (userId && projectId) {
      setLoading(true);
      getUserPermissions(userId, projectId)
        .then(setPermissions)
        .finally(() => setLoading(false));
    }
  }, [userId, projectId]);
  
  return { permissions, loading };
};

// Import React cho hook (nếu file này dùng làm hook)
import React from 'react';

// Error handlers
export const handlePermissionError = (error: any): string => {
  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action';
  }
  
  if (error.response?.status === 401) {
    return 'Please log in to continue';
  }
  
  return 'An error occurred while checking permissions';
};

export const canDeleteSprint = (permissions: UserPermissions | null): boolean => {
  // ✅ Project Owners and Scrum Masters can delete sprints (match backend logic)
  return permissions?.isOwner || permissions?.isScrumMaster || false;
};

export const canCancelSprint = (permissions: UserPermissions | null): boolean => {
  // ✅ Only Project Owners and users with sprint management permissions can cancel sprints
  return permissions?.isOwner || permissions?.canManageSprints || false;
}; 