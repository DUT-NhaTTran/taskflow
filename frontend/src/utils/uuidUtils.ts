
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID v4 format
 * @param uuid - The string to validate
 * @returns boolean - True if valid UUID, false otherwise
 */
export const isValidUUID = (uuid: string): boolean => {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_PATTERN.test(uuid);
};

/**
 * Validate and format projectId for API calls
 * @param projectId - The project ID to validate
 * @throws Error if projectId is invalid
 * @returns string - The validated project ID
 */
export const validateProjectId = (projectId: string | null | undefined): string => {
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  
  if (!isValidUUID(projectId)) {
    throw new Error(`Invalid project ID format: ${projectId}. Expected UUID format.`);
  }
  
  return projectId;
};

/**
 * Validate and format user ID for API calls
 * @param userId - The user ID to validate
 * @throws Error if userId is invalid
 * @returns string - The validated user ID
 */
export const validateUserId = (userId: string | null | undefined): string => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!isValidUUID(userId)) {
    throw new Error(`Invalid user ID format: ${userId}. Expected UUID format.`);
  }
  
  return userId;
};

/**
 * Validate and format task ID for API calls
 * @param taskId - The task ID to validate
 * @throws Error if taskId is invalid
 * @returns string - The validated task ID
 */
export const validateTaskId = (taskId: string | null | undefined): string => {
  if (!taskId) {
    throw new Error('Task ID is required');
  }
  
  if (!isValidUUID(taskId)) {
    throw new Error(`Invalid task ID format: ${taskId}. Expected UUID format.`);
  }
  
  return taskId;
};

/**
 * Validate and format sprintId for API calls
 * @param sprintId - The sprint ID to validate
 * @throws Error if sprintId is invalid or is a temporary ID
 * @returns string - The validated sprint ID
 */
export const validateSprintId = (sprintId: string | null | undefined): string => {
  if (!sprintId) {
    throw new Error('Sprint ID is required');
  }
  
  if (sprintId.startsWith('temp_')) {
    throw new Error('Cannot use temporary sprint ID for notifications');
  }
  
  if (!isValidUUID(sprintId)) {
    throw new Error(`Invalid UUID format for sprint ID: ${sprintId}`);
  }
  
  return sprintId;
};

/**
 * Safely validate UUID with console warning instead of throwing error
 * @param uuid - The UUID to validate
 * @param fieldName - Name of the field for better error messages
 * @returns boolean - True if valid, false with console warning if invalid
 */
export const safeValidateUUID = (uuid: string | null | undefined, fieldName = 'UUID'): boolean => {
  if (!uuid) {
    console.warn(`${fieldName} is empty or null`);
    return false;
  }
  
  const isValid = isValidUUID(uuid);
  if (!isValid) {
    console.warn(`Invalid ${fieldName} format: ${uuid}. Expected UUID format.`);
  }
  
  return isValid;
};

/**
 * Generate a UUID for client-side use (v4 format)
 * Uses crypto.randomUUID() if available, otherwise falls back to random generation
 * @returns string - A UUID
 */
export const generateMockUUID = (): string => {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: Manual UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}; 