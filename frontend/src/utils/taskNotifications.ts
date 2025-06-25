import axios from 'axios';
import { safeValidateUUID, validateProjectId, validateUserId, validateTaskId, validateSprintId } from './uuidUtils';
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
  projectName?: string;
  sprintId?: string;
  dueDate?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  parentTaskId?: string | null;
  tags?: string[] | null;
}

// Standard notification payload structure
interface StandardNotificationPayload {
  type: string;
  title: string;
  message: string;
  recipientUserId: string;
  actorUserId: string;
  actorUserName: string;
  projectId: string;
  projectName: string;
  taskId?: string;  // Make optional for sprint notifications
  // Remove sprintId and actionUrl - backend doesn't support them in /create endpoint
}

// Sprint interface for overdue checking
interface Sprint {
  id: string;
  name: string;
  endDate?: string;
  status: string;
  projectId?: string;
  projectName?: string;
}

// Key for localStorage to track sent notifications
const SPRINT_OVERDUE_NOTIFICATIONS_KEY = 'sentSprintOverdueNotifications';

// ✅ SPRINT OVERDUE NOTIFICATION TRACKING SYSTEM
// This system ensures that overdue notifications for sprints are sent only once per sprint.
// - Uses localStorage to persist notification history across browser sessions
// - Automatically cleans up old records for deleted sprints
// - Provides utility functions to reset status when sprint is completed/reopened

// Get list of sprint IDs that have already been sent overdue notifications
const getSentSprintOverdueNotifications = (): string[] => {
  try {
    const stored = localStorage.getItem(SPRINT_OVERDUE_NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading sent sprint notifications from localStorage:', error);
    return [];
  }
};

// Mark a sprint as having been sent an overdue notification
const markSprintOverdueNotificationSent = (sprintId: string): void => {
  try {
    const sentNotifications = getSentSprintOverdueNotifications();
    if (!sentNotifications.includes(sprintId)) {
      sentNotifications.push(sprintId);
      localStorage.setItem(SPRINT_OVERDUE_NOTIFICATIONS_KEY, JSON.stringify(sentNotifications));
    }
  } catch (error) {
    console.error('Error saving sent sprint notification to localStorage:', error);
  }
};

// Check if a sprint has already been sent an overdue notification
const hasSprintOverdueNotificationBeenSent = (sprintId: string): boolean => {
  const sentNotifications = getSentSprintOverdueNotifications();
  return sentNotifications.includes(sprintId);
};

// Clean up old notification records (optional - for sprints that are no longer overdue)
const cleanupSprintOverdueNotifications = (activeSprints: Sprint[]): void => {
  try {
    const sentNotifications = getSentSprintOverdueNotifications();
    const activeSprintIds = activeSprints.map(sprint => sprint.id);
    
    // Keep only notifications for sprints that still exist
    const cleanedNotifications = sentNotifications.filter(sprintId => 
      activeSprintIds.includes(sprintId)
    );
    
    if (cleanedNotifications.length !== sentNotifications.length) {
      localStorage.setItem(SPRINT_OVERDUE_NOTIFICATIONS_KEY, JSON.stringify(cleanedNotifications));
    }
  } catch (error) {
    console.error('Error cleaning up sprint notifications:', error);
  }
};

// Check if a task is overdue
export const isTaskOverdue = (task: Task): boolean => {
  if (!task.dueDate || task.status === "DONE") {
    return false;
  }
  
  const dueDate = new Date(task.dueDate);
  const now = new Date();
  
  // Remove time part for date comparison
  dueDate.setHours(23, 59, 59, 999); // End of due date
  
  return now > dueDate;
};

// Send task overdue notification
export const sendTaskOverdueNotification = async (task: Task): Promise<void> => {
  if (!task.assigneeId) {
    console.log('No assignee for overdue task:', task.id);
    return;
  }

  try {
    // Validate UUIDs before sending
    const validatedProjectId = task.projectId ? validateProjectId(task.projectId) : null;
    const validatedAssigneeId = validateUserId(task.assigneeId);
    const validatedTaskId = validateTaskId(task.id);
    
    if (!validatedProjectId) {
      console.error('Cannot send overdue notification: invalid project ID');
      return;
    }

    // Standard payload format - only essential fields
    const notificationData: StandardNotificationPayload = {
      type: "TASK_OVERDUE",
      title: "Task Overdue",
      message: `Task "${task.title}" is overdue and needs your attention`,
      recipientUserId: validatedAssigneeId,
      actorUserId: validatedAssigneeId, // Self-notification for overdue
      actorUserName: "System",
      projectId: validatedProjectId,
      projectName: task.projectName || "Unknown Project",
      taskId: validatedTaskId
    };

    await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notificationData);
  } catch (error) {
    console.error('❌ TASK OVERDUE: Failed to send notification:', error);
  }
};

// Check all tasks for overdue status and send notifications
export const checkAndNotifyOverdueTasks = async (tasks: Task[]): Promise<void> => {
  for (const task of tasks) {
    if (isTaskOverdue(task)) {
      await sendTaskOverdueNotification(task);
    }
  }
};

// Send task status changed notification
export const sendTaskStatusChangedNotification = async (
  task: Task,
  actorUserId: string,
  actorUserName: string,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  if (!task.assigneeId || task.assigneeId === actorUserId) {
    return; // Don't send if no assignee or user changed their own task
  }
  
  try {
    // Validate UUIDs before sending
    const validatedProjectId = task.projectId ? validateProjectId(task.projectId) : null;
    const validatedAssigneeId = validateUserId(task.assigneeId);
    const validatedActorId = validateUserId(actorUserId);
    const validatedTaskId = validateTaskId(task.id);
    
    if (!validatedProjectId) {
      console.error('Cannot send status change notification: invalid project ID');
      return;
    }
    
    // Standard payload format - only essential fields
    const notificationData: StandardNotificationPayload = {
      type: "TASK_STATUS_CHANGED",
      title: "Task Status Changed",
      message: `${actorUserName} changed task "${task.title}" status from "${oldStatus}" to "${newStatus}"`,
      recipientUserId: validatedAssigneeId,
      actorUserId: validatedActorId,
      actorUserName: actorUserName,
      projectId: validatedProjectId,
      projectName: task.projectName || "Unknown Project",
      taskId: validatedTaskId
    };

    await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notificationData);
  } catch (error) {
    console.error('❌ TASK STATUS CHANGED: Failed to send notification:', error);
  }
};

// Send task deleted notification
export const sendTaskDeletedNotification = async (
  task: Task,
  actorUserId: string,
  actorUserName: string
): Promise<void> => {
  if (!task.assigneeId) {
    console.log('No assignee for deleted task:', task.id);
    return;
  }

  try {
    // Validate UUIDs before sending
    const validatedProjectId = task.projectId ? validateProjectId(task.projectId) : null;
    const validatedAssigneeId = validateUserId(task.assigneeId);
    const validatedActorId = validateUserId(actorUserId);
    const validatedTaskId = validateTaskId(task.id);
    
    if (!validatedProjectId) {
      console.error('Cannot send task deleted notification: invalid project ID');
      return;
    }

    // Standard payload format - only essential fields  
    const notificationData: StandardNotificationPayload = {
      type: "TASK_DELETED",
      title: "Task Deleted",
      message: `${actorUserName} deleted task "${task.title}" that was assigned to you`,
      recipientUserId: validatedAssigneeId,
      actorUserId: validatedActorId,
      actorUserName: actorUserName,
      projectId: validatedProjectId,
      projectName: task.projectName || "Unknown Project",
      taskId: validatedTaskId
    };

    await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notificationData);
  } catch (error) {
    console.error('❌ TASK DELETED: Failed to send notification:', error);
  }
};

// Check if a sprint is overdue
export const isSprintOverdue = (sprint: Sprint): boolean => {
  if (!sprint.endDate || sprint.status === "COMPLETED") {
    return false;
  }
  
  const endDate = new Date(sprint.endDate);
  const now = new Date();
  
  // Remove time part for date comparison
  endDate.setHours(23, 59, 59, 999); // End of sprint end date
  
  return now > endDate && sprint.status === "ACTIVE";
};

// Send sprint overdue notification to PO and Scrum Master
export const sendSprintOverdueNotification = async (
  sprint: Sprint, 
  poUserId: string, 
  scrumMasterId?: string
): Promise<void> => {

  
  try {
    // Validate UUIDs before sending
    const validatedProjectId = sprint.projectId ? validateProjectId(sprint.projectId) : null;
    
    if (!validatedProjectId) {
      console.error('❌ SPRINT OVERDUE: Cannot send notification - invalid project ID');
      return;
    }

    const recipients = [poUserId];
    if (scrumMasterId && scrumMasterId !== poUserId) {
      recipients.push(scrumMasterId);
    }

    for (const recipientId of recipients) {
      
      try {
        const validatedRecipientId = validateUserId(recipientId);
        console.log('🔍 SPRINT OVERDUE: Validated recipient ID:', validatedRecipientId);
        
        // Standard payload format for sprint overdue notification - remove sprintId and actionUrl
        const notificationData: StandardNotificationPayload = {
          type: "SPRINT_ENDED", // Temporarily use existing enum value to test
          title: "Sprint Overdue",
          message: `Sprint "${sprint.name}" is overdue and requires immediate attention`,
          recipientUserId: validatedRecipientId,
          actorUserId: validatedRecipientId, // Self-notification for overdue
          actorUserName: "System",
          projectId: validatedProjectId,
          projectName: sprint.projectName || "Unknown Project"
          // Remove sprintId and actionUrl - backend doesn't support them in /create endpoint
        };

        
        const response = await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notificationData);
        
      } catch (recipientError: any) {
       
        if (recipientError.response) {
          console.error('❌ SPRINT OVERDUE: Error response status:', recipientError.response.status);
          console.error('❌ SPRINT OVERDUE: Error response data:', recipientError.response.data);
        }
      }
    }
    
    // Mark notification as sent after all recipients have been processed
    markSprintOverdueNotificationSent(sprint.id);
    
  } catch (error: any) {
    console.error('❌ SPRINT OVERDUE: General error in sendSprintOverdueNotification:', error);
    if (error.response) {
    
    }
    console.error('❌ SPRINT OVERDUE: Error stack trace:', error.stack);
  }
};

// Check all sprints for overdue status and send notifications
export const checkAndNotifyOverdueSprints = async (
  sprints: Sprint[], 
  poUserId: string, 
  scrumMasterId?: string
): Promise<void> => {
  console.log('🔔 SPRINT OVERDUE CHECK: Checking sprints for overdue status...');
  
  // Clean up old notification records first
  cleanupSprintOverdueNotifications(sprints);
  
  let overdueCount = 0;
  let alreadyNotifiedCount = 0;
  
  for (const sprint of sprints) {
    if (isSprintOverdue(sprint)) {
      // Check if we've already sent notification for this sprint
      if (hasSprintOverdueNotificationBeenSent(sprint.id)) {
        alreadyNotifiedCount++;
        continue;
      }
      
      await sendSprintOverdueNotification(sprint, poUserId, scrumMasterId);
      overdueCount++;
    }
  }
  
  
};

// Reset notification status for a specific sprint (e.g., when sprint is completed or reopened)
export const resetSprintOverdueNotification = (sprintId: string): void => {
  try {
    const sentNotifications = getSentSprintOverdueNotifications();
    const updatedNotifications = sentNotifications.filter(id => id !== sprintId);
    
    if (updatedNotifications.length !== sentNotifications.length) {
      localStorage.setItem(SPRINT_OVERDUE_NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
      console.log(`🔄 SPRINT OVERDUE: Reset notification status for sprint ${sprintId}`);
    }
  } catch (error) {
    console.error('Error resetting sprint notification status:', error);
  }
};

// Clear all sprint overdue notification history (for debugging/testing)
export const clearAllSprintOverdueNotifications = (): void => {
  try {
    localStorage.removeItem(SPRINT_OVERDUE_NOTIFICATIONS_KEY);
    console.log('🧹 SPRINT OVERDUE: Cleared all notification history');
  } catch (error) {
    console.error('Error clearing sprint notification history:', error);
  }
}; 