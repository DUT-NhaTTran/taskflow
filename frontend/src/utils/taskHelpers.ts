import { API_CONFIG } from "@/lib/config";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  storyPoint?: number;
  assigneeId?: string | null;
  assigneeName?: string;
  shortKey?: string;
  projectId?: string;
  sprintId?: string;
  dueDate?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  parentTaskId?: string | null;
  tags?: string[] | null;
  createdBy?: string;
  priority?: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST" | "BLOCKER" | "BLOCK";
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Cache for user data to avoid repeated API calls
const userCache = new Map<string, User>();

/**
 * Fetch user data by ID and cache it
 */
async function fetchUserById(userId: string): Promise<User | null> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    const response = await fetch(`${API_CONFIG.USER_SERVICE}/api/users/${userId}`);
    if (response.ok) {
      const userData = await response.json();
      const user = userData.data || userData;
      userCache.set(userId, user);
      return user;
    }
  } catch (error) {
    console.warn(`Failed to fetch user ${userId}:`, error);
  }
  
  return null;
}

/**
 * Enhance tasks with assignee names by resolving assigneeId
 */
export async function enhanceTasksWithAssigneeNames(tasks: Task[]): Promise<Task[]> {
  // Get unique assignee IDs that need to be resolved
  const assigneeIds = new Set<string>();
  tasks.forEach(task => {
    if (task.assigneeId && !task.assigneeName) {
      assigneeIds.add(task.assigneeId);
    }
  });

  // Fetch user data for all unique assignee IDs in parallel
  const userPromises = Array.from(assigneeIds).map(async (userId) => {
    const user = await fetchUserById(userId);
    return { userId, user };
  });

  const userResults = await Promise.allSettled(userPromises);
  const userMap = new Map<string, User>();

  userResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value.user) {
      userMap.set(result.value.userId, result.value.user);
    }
  });

  // Enhance tasks with assignee names
  return tasks.map(task => {
    if (task.assigneeId && !task.assigneeName) {
      const user = userMap.get(task.assigneeId);
      if (user) {
        return {
          ...task,
          assigneeName: user.username || user.firstName || user.email?.split('@')[0] || 'Unknown User'
        };
      }
    }
    return task;
  });
}

/**
 * Enhance a single task with assignee name
 */
export async function enhanceTaskWithAssigneeName(task: Task): Promise<Task> {
  if (!task.assigneeId || task.assigneeName) {
    return task;
  }

  const user = await fetchUserById(task.assigneeId);
  if (user) {
    return {
      ...task,
      assigneeName: user.username || user.firstName || user.email?.split('@')[0] || 'Unknown User'
    };
  }

  return task;
}

/**
 * Clear user cache (useful for testing or when user data changes)
 */
export function clearUserCache(): void {
  userCache.clear();
} 