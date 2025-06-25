import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { useUserStorage } from '@/hooks/useUserStorage';
import { 
  sendTaskStatusChangedNotification,
  sendTaskOverdueNotification,
  sendTaskDeletedNotification 
} from '@/utils/taskNotifications';
import { API_CONFIG } from "@/lib/config";

// Task interface matching the one used in project pages
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
  createdBy?: string;
}

// Type for API error responses
interface ErrorResponse {
  message: string;
}

// API base URL
const API_BASE_URL = `${API_CONFIG.TASKS_SERVICE}`;

export const useProjectTasks = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userData } = useUserStorage();

  // Enhanced task status change notification that supports multiple recipients
  const sendTaskStatusChangeNotificationMulti = async (
    task: Task, 
    oldStatus: Task["status"], 
    newStatus: Task["status"]
  ): Promise<void> => {
    // Only send notifications on client-side when user data is available
    if (typeof window === 'undefined' || !userData) {
      console.log('⚠️ Skipping notification - not on client side or no user data');
      return;
    }

    try {
      const actorUserId = userData.profile?.id || userData.account?.id;
      const actorUserName = userData.profile?.username || userData.profile?.firstName || 'User';

      if (!actorUserId) {
        console.warn('⚠️ No actor user ID available for notification');
        return;
      }

      const recipients = [];

      // 1. Add assignee if exists and different from actor
      if (task.assigneeId && task.assigneeId !== actorUserId) {
        recipients.push(task.assigneeId);
        console.log('✅ Added assignee to recipients:', task.assigneeId);
      }

      // 2. Add task creator if exists and different from actor and assignee
      if (task.createdBy && task.createdBy !== actorUserId && task.createdBy !== task.assigneeId) {
        recipients.push(task.createdBy);
        console.log('✅ Added task creator to recipients:', task.createdBy);
      }

      // 3. Add scrum master - fetch from project API
      if (task.projectId) {
        try {
          console.log('🔍 Fetching project info for scrum master...', task.projectId);
          const projectResponse = await axios.get(`${API_CONFIG.USER_SERVICE}/api/projects/${task.projectId}`);
          
          if (projectResponse.data?.status === "SUCCESS" && projectResponse.data?.data?.scrumMasterId) {
            const scrumMasterId = projectResponse.data.data.scrumMasterId;
            if (scrumMasterId !== actorUserId && !recipients.includes(scrumMasterId)) {
              recipients.push(scrumMasterId);
              console.log('✅ Added scrum master to recipients:', scrumMasterId);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch scrum master info:', error);
        }
      }

      // Send notifications to all unique recipients using existing utility
      const uniqueRecipients = [...new Set(recipients)];
      console.log(`Final unique recipients (${uniqueRecipients.length}):`, uniqueRecipients);

      if (uniqueRecipients.length === 0) {
        console.log('⚠️ No recipients found for notifications');
        return;
      }

      // Use existing utility function for each recipient
      for (const recipientId of uniqueRecipients) {
        // Create a task copy with the specific recipient as assignee for the notification
        const taskForNotification = { ...task, assigneeId: recipientId };
        await sendTaskStatusChangedNotification(
          taskForNotification,
          actorUserId,
          actorUserName,
          getStatusDisplayName(oldStatus),
          getStatusDisplayName(newStatus)
        );
      }

      
    } catch (notifError) {
      console.error('❌ Failed to send task status change notification:', notifError);
      // Don't fail the main operation if notification fails
    }
  };

  const updateTaskStatus = async (task: Task, newStatus: Task["status"], oldStatus?: Task["status"]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedTask = {
        ...task,
        status: newStatus,
        completedAt: newStatus === "DONE" ? new Date().toISOString() : null
      };

      // Get user data for header - only use if available (client-side)
      const actorUserId = userData?.profile?.id || userData?.account?.id;
      
      const response = await axios.put(
        `${API_BASE_URL}/api/tasks/${task.id}`,
        updatedTask,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(actorUserId && { 'X-User-Id': actorUserId }),
          },
        }
      );
      
      if (response.status === 200) {
        // Send enhanced notification for task status change
        const previousStatus = oldStatus || task.status;
        await sendTaskStatusChangeNotificationMulti(task, previousStatus, newStatus);
        
        console.log('✅ Task status updated successfully');
        return true;
      }
      return false;
    } catch (err: any) {
      const error = err as AxiosError<ErrorResponse>;
      const errorMessage = error.response?.data?.message || 'Failed to update task status';
      setError(errorMessage);
      console.error('Error updating task status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert status enum to display name
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      case "TODO":
        return "To Do";
      case "IN_PROGRESS":
        return "In Progress";
      case "REVIEW":
        return "Review";
      case "DONE":
        return "Done";
      default:
        return status;
    }
  };

  return {
    updateTaskStatus,
    sendTaskStatusChangeNotificationMulti, // Enhanced multi-recipient version
    sendTaskOverdueNotification, // Re-export from utils
    sendTaskDeletedNotification, // Re-export from utils
    loading,
    error
  };
}; 