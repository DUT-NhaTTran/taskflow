"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { TopNavigation } from "@/components/ui/top-navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NavigationProgress } from "@/components/ui/LoadingScreen";
import { useNavigation } from "@/contexts/NavigationContext";
import TaskDetailModal, { TaskData, SprintOption } from "@/components/tasks/TaskDetailModal";
import { TaskFilterPanel, FilterState } from "@/components/filters/TaskFilterPanel";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent, 
  type DragEndEvent 
} from '@dnd-kit/core';
import { DraggableProjectTaskCard } from "@/components/ui/draggable-project-task-card";
import { DroppableProjectColumn } from "@/components/ui/droppable-project-column";
import { useProjectTasks } from "@/hooks/useProjectTasks";
import { checkAndNotifyOverdueTasks } from "@/utils/taskNotifications";
import { useUserStorage } from "@/hooks/useUserStorage";
import { 
  getUserPermissions, 
  canManageProject, 
  canDeleteProject, 
  isProjectOwner,
  UserPermissions 
} from "@/utils/permissions";
import { Edit, Search, ArrowRight, Calendar, Users, Target } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Filter } from "lucide-react";
import { API_CONFIG } from "@/lib/config";

// Interface definitions
interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  avatarUrl?: string;
  projectType?: string;
  access?: string;
  createdAt?: string;
  ownerId?: string;
  ownerName?: string;  // Add owner name
  productOwnerId?: string;  // Add product owner ID
  deadline?: string;
  deletedAt?: string | null;  // Add deleted_at field
  userRole?: string; // Add user role
}

// ✅ NEW: Interface for search board results
interface SearchBoardResult {
  project: Project;
  activeSprint?: any;
  tasks: TaskData[];
  sprintCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
}

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
  createdBy?: string; // Add createdBy field for notifications
  priority?: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST" | "BLOCKER" | "BLOCK"; // ✅ Updated with BLOCK only
}

interface User {
  id: string;
  fullname: string;
  email: string;
}

interface Sprint {
  id: string;
  name?: string;
  number?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

interface ProjectUser {
  id: string;
  name?: string;      // For backward compatibility
  username?: string;  // New field from API
  email?: string;     // New field from API
  userRole?: string;  // New field from API
  avatar?: string;    // New field from API
  avatarUrl?: string; // For backward compatibility
}

export default function ProjectBoardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentProjectId, setCurrentProjectId } = useNavigation();
  const { userData } = useUserStorage(); // Add this line
  
  // ✅ NEW: Use UserContext for user management
  const { currentUser, isLoading: userContextLoading, users: cachedUsers, getUserById, fetchUserById } = useUser();
  
  // ✅ NEW: Simple permission check function for task editing/dragging
  const canEditTask = (task: Task) => {
    if (!currentUser?.id) return false;
    
    // Task creator can edit/drag
    if (task.createdBy === currentUser.id) return true;
    
    // Task assignee can edit/drag  
    if (task.assigneeId === currentUser.id) return true;
    
    // Admin users can edit/drag (using existing permission system)
    if (userPermissions?.canManageAnyTask || userPermissions?.isOwner) return true;
    
    return false;
  };
  
  // Get projectId from URL or context
  const urlProjectId = searchParams?.get("projectId")
  const projectId = urlProjectId || currentProjectId
  
  // Get taskId from URL params
  const urlTaskId = searchParams?.get("taskId")
  
  // Update context if projectId from URL
  useEffect(() => {
    if (urlProjectId && urlProjectId !== currentProjectId) {
      setCurrentProjectId(urlProjectId)
    }
  }, [urlProjectId, currentProjectId, setCurrentProjectId])
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [latestSprintId, setLatestSprintId] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [newTasks, setNewTasks] = useState({
    TODO: "",
    IN_PROGRESS: "",
    REVIEW: "",
    DONE: "",
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTaskFromUrl, setLoadingTaskFromUrl] = useState(false); // New state for URL task loading
  const [searchProject, setSearchProject] = useState("");
  const [searchResults, setSearchResults] = useState<Project[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userAvatarFetchErrors = useRef<Set<string>>(new Set());
  // Cache cho avatar đã tải để tránh tải lại nhiều lần
  const avatarCache = useRef<Record<string, string>>({});
  // Drag and drop state and handlers
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { updateTaskStatus, loading: apiLoading } = useProjectTasks();

  // Permission state
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // Error handling and project selection state
  const [errorState, setErrorState] = useState<{
    type: string;
    title: string;
    message: string;
    showProjectSelector: boolean;
  } | null>(null);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // ✅ ADD: Refs to prevent infinite loops
  const hasFetchedProjectsRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // ✅ NEW: Filter state for TaskFilterPanel
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchText: '',
    status: [],
    assignee: [],
    priority: [],
    labels: [],
    createdDateFrom: '',
    createdDateTo: '',
    updatedDateFrom: '',
    updatedDateTo: ''
  });

  // ✅ NEW: Search board state
  const [searchBoardQuery, setSearchBoardQuery] = useState("");
  const [searchBoardResults, setSearchBoardResults] = useState<SearchBoardResult[]>([]);
  const [showSearchBoardResults, setShowSearchBoardResults] = useState(false);
  const [isSearchingBoard, setIsSearchingBoard] = useState(false);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState(-1);

  // ✅ NEW: Handle filter changes
  const handleFilterChange = (filterType: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleToggleArrayFilter = (filterType: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentArray = prev[filterType] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      
      return {
        ...prev,
        [filterType]: newArray
      };
    });
  };

  const handleClearAllFilters = () => {
    setFilters({
      searchText: '',
      status: [],
      assignee: [],
      priority: [],
      labels: [],
      createdDateFrom: '',
      createdDateTo: '',
      updatedDateFrom: '',
      updatedDateTo: ''
    });
  };

  // ✅ ADD: Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ ADD: Reset refs when user changes to allow fresh fetching
  useEffect(() => {
    const currentUserId = userData?.account?.id || userData?.profile?.id;
    
    if (currentUserId && lastFetchedUserIdRef.current && lastFetchedUserIdRef.current !== currentUserId) {
      hasFetchedProjectsRef.current = false;
      lastFetchedUserIdRef.current = null;
    }
  }, [userData?.account?.id, userData?.profile?.id]);

  // Recent projects tracking
  const saveRecentProject = (projectData: Project) => {
    if (typeof window === 'undefined') return;
    
    try {
      const recentProjects = getRecentProjects();
      const updatedRecent = [
        projectData,
        ...recentProjects.filter(p => p.id !== projectData.id)
      ].slice(0, 5);
      
      localStorage.setItem('recentProjects', JSON.stringify(updatedRecent));
    } catch (error) {
      // Silently handle localStorage errors
    }
  };

  const getRecentProjects = (): Project[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem('recentProjects');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  };

  const redirectToMostRecentProject = () => {
    const recentProjects = getRecentProjects();
    if (recentProjects.length > 0) {
      const mostRecent = recentProjects[0];
      window.location.href = `/project/project_homescreen?projectId=${mostRecent.id}`;
    } else {
      window.location.href = '/project/view_all_projects';
    }
  };

  // Fetch project data using the provided API
  const fetchProject = async (projectId: string) => {
    try {
      const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}`);
      
      if (response.data?.status === "SUCCESS" && response.data?.data) {
        const projectData = response.data.data;
        
        if (projectData.deletedAt && projectData.deletedAt !== null) {
          handleProjectDeleted(projectData);
          return null;
        }
        
        setProject(projectData);
        saveRecentProject(projectData);
        return projectData;
      } else {
        setTimeout(() => redirectToMostRecentProject(), 2000);
        handleProjectNotFound();
        return null;
      }
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        if (status === 404) {
          handleProjectNotFound();
        } else if (status === 500) {
          handleServerError();
        } else if (status === 403) {
          handleAccessDenied();
        } else if (status === 400) {
          handleNetworkError();
        } else {
          handleNetworkError();
        }
      } else {
        handleUnknownError();
      }
      
      setTimeout(() => redirectToMostRecentProject(), 2000);
      return null;
    }
  };

  const handleProjectNotFound = () => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  const handleServerError = () => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  const handleAccessDenied = () => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  const handleNetworkError = () => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  const handleUnknownError = () => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  const handleProjectDeleted = (projectData: Project) => {
    setTimeout(() => {
      window.location.href = '/project/project_homescreen';
    }, 1000);
  };

  // Fetch user's projects for project selector
  const fetchUserProjects = async () => {
    const currentUserId = userData?.account?.id || userData?.profile?.id;
    
    if (!currentUserId) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }
    
    if (hasFetchedProjectsRef.current && lastFetchedUserIdRef.current === currentUserId) {
      return;
    }
    
    if (loadingProjects) {
      return;
    }

    if (!mountedRef.current) return;
    setLoadingProjects(true);
    
    try {
      const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=&userId=${currentUserId}`);
      
      if (!mountedRef.current) {
        return;
      }
      
      let projectsData = [];
      if (response.data?.status === "SUCCESS" && response.data?.data) {
        projectsData = response.data.data;
      } else if (Array.isArray(response.data?.data)) {
        projectsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        projectsData = response.data;
      }
      
      const recentProjects = getRecentProjects().filter(p => !p.deletedAt);
      const filteredProjectsData = projectsData.filter((p: any) => !p.deletedAt);
      const combinedProjects = [
        ...recentProjects,
        ...filteredProjectsData.filter((p: any) => !recentProjects.some((r: Project) => r.id === p.id))
      ];
      
      if (mountedRef.current) {
      setUserProjects(combinedProjects);
        hasFetchedProjectsRef.current = true;
        lastFetchedUserIdRef.current = currentUserId;
      }
    } catch (error) {
      if (mountedRef.current) {
      setUserProjects(getRecentProjects());
        hasFetchedProjectsRef.current = true;
        lastFetchedUserIdRef.current = currentUserId;
      }
    } finally {
      if (mountedRef.current) {
      setLoadingProjects(false);
      }
    }
  };

  // Handle project selection from error UI
  const handleSelectProjectFromError = (selectedProjectId: string) => {
    setErrorState(null);
    router.push(`/project/project_homescreen?projectId=${selectedProjectId}`);
  };

  // Fetch user permissions for the project
  const fetchUserPermissions = async (userId: string, projectId: string) => {
    try {
      const permissions = await getUserPermissions(userId, projectId);
      
      if (permissions) {
        setUserPermissions(permissions);
        setIsOwner(isProjectOwner(permissions));
        setCanEdit(canManageProject(permissions));
        setCanDelete(canDeleteProject(permissions));
      }
    } catch (error) {
      setUserPermissions(null);
      setIsOwner(false);
      setCanEdit(false);
      setCanDelete(false);
    } finally {
      setPermissionsLoading(false);
    }
  };

 

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    
    if (!canEditTask(task)) {
      return;
    }
    
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const task = active.data.current?.task as Task;
    const newStatus = over.id as Task["status"];
    const oldStatus = task.status;

    if (task.status === newStatus && active.id === over.id) return;

    const tasksInColumn = tasks.filter(t => t.status === newStatus && (t.parentTaskId === null || t.parentTaskId === undefined));
    const overTaskIndex = tasksInColumn.findIndex(t => t.id === over.id);
    const updatedTasks = [...tasks];
    const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
    const taskToMove = updatedTasks[taskIndex];
    
    updatedTasks.splice(taskIndex, 1);
    
    if (task.status === newStatus && overTaskIndex !== -1) {
      const insertIndex = updatedTasks.findIndex(t => t.id === over.id);
      updatedTasks.splice(insertIndex, 0, { ...taskToMove, status: newStatus });
    } else {
      const insertIndex = updatedTasks.findIndex(t => t.status === newStatus);
      updatedTasks.splice(insertIndex === -1 ? updatedTasks.length : insertIndex, 0, { ...taskToMove, status: newStatus });
    }

    setTasks(updatedTasks);

    try {
      const response = await axios.put(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${task.id}`, {
        ...task,
        status: newStatus,
        completedAt: newStatus === "DONE" ? new Date().toISOString() : null
      });

      if (response.status === 200) {
        // ✅ CLEANUP: Remove TASK_OVERDUE notifications when task is completed
        if (newStatus === "DONE") {
          try {
            await axios.delete(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/task/${task.id}/overdue`);
            console.log("✅ TASK_OVERDUE notifications cleaned up for completed task:", task.id);
          } catch (cleanupError) {
            console.log("📝 Failed to cleanup TASK_OVERDUE notifications (non-critical):", cleanupError);
          }
        }
        
        await send3StatusChangeNotifications(task, oldStatus, newStatus);
        toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
      } else {
        throw new Error('Failed to update task status');
      }
    } catch (error) {
      // Revert optimistic update on failure
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: task.status } : t
      ));
      toast.error('Failed to update task status');
    }
  };

  // Helper function to send 3 notifications with different recipients
  const send3StatusChangeNotifications = async (
    task: Task, 
    oldStatus: Task["status"], 
    newStatus: Task["status"]
  ) => {
    try {
      const actorUserId = userData?.profile?.id || userData?.account?.id;
      const actorUserName = userData?.profile?.username || userData?.profile?.firstName || 'User';

      if (!actorUserId) {
        return;
      }

      let taskWithCreatedBy = task;
      try {
        const taskDetailResponse = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${task.id}`);
        
        if (taskDetailResponse.data?.status === "SUCCESS" && taskDetailResponse.data?.data) {
          taskWithCreatedBy = {
            ...task,
            ...taskDetailResponse.data.data
          };
        }
      } catch (taskFetchError) {
        // Use original task data if fetch fails
      }

      const getStatusDisplayName = (status: string): string => {
        switch (status) {
          case "TODO": return "To Do";
          case "IN_PROGRESS": return "In Progress";
          case "REVIEW": return "Review";
          case "DONE": return "Done";
          default: return status;
        }
      };

      const userRoles = new Map<string, string[]>();

      let assigneeId = taskWithCreatedBy.assigneeId;
      if (assigneeId && assigneeId.trim() !== '') {
        if (!userRoles.has(assigneeId)) {
          userRoles.set(assigneeId, []);
        }
        userRoles.get(assigneeId)!.push('Assignee');
      }
      
      let creatorId = taskWithCreatedBy.createdBy;
      if (creatorId && creatorId.trim() !== '') {
        if (!userRoles.has(creatorId)) {
          userRoles.set(creatorId, []);
        }
        userRoles.get(creatorId)!.push('Creator');
      }

      let productOwnerId = null;
      try {
        const projectApiId = taskWithCreatedBy.projectId || projectId;
        if (projectApiId) {
          const productOwnerResponse = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectApiId}/manager_id`);
          
          if (productOwnerResponse.data?.status === "SUCCESS" && productOwnerResponse.data?.data) {
            productOwnerId = productOwnerResponse.data.data;
            
            if (!userRoles.has(productOwnerId)) {
              userRoles.set(productOwnerId, []);
            }
            userRoles.get(productOwnerId)!.push('product-owner');
          }
        }
      } catch (projectError) {
        // Silently handle product owner fetch error
      }

      if (userRoles.has(actorUserId)) {
        userRoles.delete(actorUserId);
      }

      if (userRoles.size === 0) {
        return;
      }

      const baseNotificationData = {
        type: "TASK_STATUS_CHANGED",
        title: "Task status changed",
        actorUserId: actorUserId,
        actorUserName: actorUserName,
        projectId: taskWithCreatedBy.projectId || projectId,
        projectName: project?.name || "TaskFlow Project",
        taskId: taskWithCreatedBy.id
      };

      const notifications: any[] = [];
      
      userRoles.forEach((roles, userId) => {
        const roleText = roles.length > 1 
          ? `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}`
          : roles[0];
        
        const notification = {
          ...baseNotificationData,
          recipientUserId: userId,
          message: `${actorUserName} changed task "${taskWithCreatedBy.title}" status from "${getStatusDisplayName(oldStatus)}" to "${getStatusDisplayName(newStatus)}" (You are the ${roleText})`
        };
        
        notifications.push(notification);
      });

      const notificationPromises = notifications.map(async (notification) => {
        try {
          const response = await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notification);
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      });

      await Promise.allSettled(notificationPromises);

    } catch (error) {
      // Silently handle notification errors
    }
  };

  // Shared function for sending deduplicated task notifications
  const sendTaskNotifications = async (
    task: Task,
    notificationType: "TASK_UPDATED" | "TASK_DELETED" | "TASK_OVERDUE",
    customMessage?: string
  ) => {
    try {
      const actorUserId = userData?.profile?.id || userData?.account?.id;
      const actorUserName = userData?.profile?.username || userData?.profile?.firstName || 'User';

      if (!actorUserId) {
        return;
      }

      let taskWithCreatedBy = task;
      try {
        const taskDetailResponse = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${task.id}`);
        
        if (taskDetailResponse.data?.status === "SUCCESS" && taskDetailResponse.data?.data) {
          taskWithCreatedBy = {
            ...task,
            ...taskDetailResponse.data.data
          };
        }
      } catch (taskFetchError) {
        // Use original task data if fetch fails
      }

      const userRoles = new Map<string, string[]>();

      if (taskWithCreatedBy.assigneeId && taskWithCreatedBy.assigneeId.trim() !== '') {
        if (!userRoles.has(taskWithCreatedBy.assigneeId)) {
          userRoles.set(taskWithCreatedBy.assigneeId, []);
        }
        userRoles.get(taskWithCreatedBy.assigneeId)!.push('Assignee');
      }
      
      if (taskWithCreatedBy.createdBy && taskWithCreatedBy.createdBy.trim() !== '') {
        if (!userRoles.has(taskWithCreatedBy.createdBy)) {
          userRoles.set(taskWithCreatedBy.createdBy, []);
        }
        userRoles.get(taskWithCreatedBy.createdBy)!.push('Creator');
      }

      try {
        const projectApiId = taskWithCreatedBy.projectId || projectId;
        if (projectApiId) {
          const productOwnerResponse = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectApiId}/manager_id`);
          
          if (productOwnerResponse.data?.status === "SUCCESS" && productOwnerResponse.data?.data) {
            const productOwnerId = productOwnerResponse.data.data;
            
            if (!userRoles.has(productOwnerId)) {
              userRoles.set(productOwnerId, []);
            }
            userRoles.get(productOwnerId)!.push('product-owner');
          }
        }
      } catch (projectError) {
        // Silently handle product owner fetch error
      }

      if (notificationType !== "TASK_OVERDUE" && userRoles.has(actorUserId)) {
        userRoles.delete(actorUserId);
      }

      if (userRoles.size === 0) {
        return;
      }

      const getNotificationMessage = (type: string, roles: string[]): string => {
        const roleText = roles.length > 1 
          ? `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}`
          : roles[0];

        if (customMessage) {
          return `${customMessage} (You are the ${roleText})`;
        }

        switch (type) {
          case "TASK_UPDATED":
            return `${actorUserName} updated task "${taskWithCreatedBy.title}" (You are the ${roleText})`;
          case "TASK_DELETED":
            return `${actorUserName} deleted task "${taskWithCreatedBy.title}" (You are the ${roleText})`;
          case "TASK_OVERDUE":
            return `Task "${taskWithCreatedBy.title}" is now overdue (You are the ${roleText})`;
          default:
            return `Task "${taskWithCreatedBy.title}" has been modified (You are the ${roleText})`;
        }
      };

      const baseNotificationData = {
        type: notificationType,
        title: notificationType === "TASK_UPDATED" ? "Task updated" :
               notificationType === "TASK_DELETED" ? "Task deleted" :
               notificationType === "TASK_OVERDUE" ? "Task overdue" : "Task notification",
        actorUserId: notificationType === "TASK_OVERDUE" ? "system" : actorUserId,
        actorUserName: notificationType === "TASK_OVERDUE" ? "System" : actorUserName,
        projectId: taskWithCreatedBy.projectId || projectId,
        projectName: project?.name || "TaskFlow Project",
        taskId: taskWithCreatedBy.id
      };

      const notifications: any[] = [];
      
      userRoles.forEach((roles, userId) => {
        const notification = {
          ...baseNotificationData,
          recipientUserId: userId,
          message: getNotificationMessage(notificationType, roles)
        };
        
        notifications.push(notification);
      });

      const notificationPromises = notifications.map(async (notification) => {
        try {
          const response = await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notification);
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      });

      await Promise.allSettled(notificationPromises);

    } catch (error) {
      // Silently handle notification errors
    }
  };

  // Debug searchResults khi nó thay đổi
  useEffect(() => {
    // Removed debug logging
  }, [searchResults, showSearchResults]);

  // Debug state changes
  useEffect(() => {
    // Removed debug logging
  }, [searchResults, showSearchResults, isSearching, searchProject]);

  // Ensure tasks is always initialized
  useEffect(() => {
    if (!tasks) {
      setTasks([]);
    }
  }, [tasks]);

  // Improved taskId handling from URL - with better error handling and loading states
  useEffect(() => {
    if (!urlTaskId) return;
    
    const handleTaskFromUrl = async () => {
      setLoadingTaskFromUrl(true);
      
      try {
        // First, try to find task in current tasks (if they're loaded)
        if (tasks.length > 0) {
          const foundTask = tasks.find(task => task.id === urlTaskId);
          
          if (foundTask) {
            setSelectedTask(foundTask);
            setLoadingTaskFromUrl(false);
            return;
          }
        }
        
        // If not found in current tasks, fetch from API
        const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${urlTaskId}`);
        
        if (response.data?.data) {
          const fetchedTask = response.data.data;
          
          // Show success message
          toast.success(`Opened task: ${fetchedTask.title}`, {
            description: "Task may be from a different sprint"
          });
          
          setSelectedTask(fetchedTask);
        } else {
          throw new Error("Task data not found in response");
        }
        
      } catch (error) {
        console.error("❌ Error fetching task from API:", error);
        
        // Show user-friendly error message
        toast.error("Task not found or you don't have access", {
          description: `Could not open task ${urlTaskId}`,
          action: {
            label: "Browse tasks",
            onClick: () => {
              // Remove taskId from URL and stay on project page
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('taskId');
              window.history.replaceState({}, '', newUrl.toString());
            }
          }
        });
        
        // Remove taskId from URL
        setTimeout(() => {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('taskId');
          window.history.replaceState({}, '', newUrl.toString());
        }, 3000);
      } finally {
        setLoadingTaskFromUrl(false);
      }
    };

    // Add a small delay to ensure other data is loaded first
    const timeoutId = setTimeout(handleTaskFromUrl, 500);
    
    return () => clearTimeout(timeoutId);
  }, [urlTaskId, tasks.length]); // Depend on tasks.length to retry when tasks are loaded

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
        setShowSearchBoardResults(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Hàm cũ đã bị xóa và thay thế bằng phiên bản mới ở dưới

  const handleSelectProject = (projectId: string) => {
    setShowSearchResults(false);
    setSearchProject("");
    router.push(`/project/project_homescreen?projectId=${projectId}`);
  };

  // Tìm kiếm project theo tên - chỉ hiển thị projects mà user hiện tại là member
  const searchBoardsByName = async (term: string) => {
    try {
      // Get user ID from user storage service instead of localStorage
      let currentUserId = userData?.profile?.id || userData?.account?.id;
      
      if (!currentUserId) {
        // TEMPORARY: Use hardcoded userId for testing
        currentUserId = "d90e8bd8-72e2-47cc-b9f0-edb92fe60c5a";
      }

      // Sử dụng API search/member với userId của người dùng hiện tại
      const apiUrl = `${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=${encodeURIComponent(term)}&userId=${currentUserId}`;
      
      const res = await axios.get(apiUrl);
      
      if (res.data?.data) {
        const matchedProjects = res.data.data.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          key: project.key,
          projectType: project.projectType,
          access: project.access,
          createdAt: project.createdAt,
          ownerId: project.ownerId,
          deadline: project.deadline
        }));
        
        return matchedProjects;
      }
      
      return [];
    } catch (err) {
      if (axios.isAxiosError(err)) {
        // Log error details silently
      }
      return [];
    }
  };

  const handleSearchProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchProject(term);
    
    if (term.trim().length > 0) {
      try {
        // Show loading state
        setIsSearching(true);
        setSearchResults([]);
        setShowSearchResults(true);
        
        // Tìm project theo tên - chỉ hiển thị projects mà user là member
        const results = await searchBoardsByName(term);
        
        // Update state with results
        setSearchResults(results);
        setShowSearchResults(true);
        setIsSearching(false);
        
      } catch (err) {
        setSearchResults([]);
        setShowSearchResults(true);
        setIsSearching(false);
        toast.error("Failed to search boards. Please try again.");
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Nếu đã có kết quả tìm kiếm, sử dụng kết quả đầu tiên
    if (searchResults.length > 0) {
      const selectedProject = searchResults[0];
      
      if (selectedProject && selectedProject.id) {
        // Chuyển đến project được chọn
        router.push(`/project/project_homescreen?projectId=${selectedProject.id}`);
        setShowSearchResults(false);
        setSearchProject("");
      }
    } else if (searchProject.trim()) {
      // Nếu không có kết quả nhưng có từ khóa tìm kiếm, thử tìm kiếm lại
      const results = await searchBoardsByName(searchProject);
      
      if (results.length > 0) {
        const selectedProject = results[0];
        
        // Chuyển đến project được chọn
        router.push(`/project/project_homescreen?projectId=${selectedProject.id}`);
        setShowSearchResults(false);
        setSearchProject("");
      } else {
        // Không tìm thấy, hiển thị thông báo
        toast.info(`No boards found matching "${searchProject}"`);
      }
    }
    
    setLoading(false);
  };

  // ✅ NEW: Search boards with sprints and tasks
  const searchBoardsWithDetails = async (term: string): Promise<SearchBoardResult[]> => {
    try {
      const currentUserId = userData?.profile?.id || userData?.account?.id;
      
      if (!currentUserId) {
        return [];
      }

      // Search in parallel: projects where user is member AND projects where user is owner
      const [memberProjectsResponse, ownerProjectsResponse] = await Promise.all([
        // Search projects that user is member of
        axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=${encodeURIComponent(term)}&userId=${currentUserId}`),
        // Get all projects where user is owner
        axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/owner/${currentUserId}`)
      ]);
      
      const memberProjects = memberProjectsResponse.data?.data || [];
      let ownerProjects = ownerProjectsResponse.data?.data || [];
      
      // Filter owner projects by search term
      if (term.trim().length > 0) {
        const searchLower = term.toLowerCase();
        ownerProjects = ownerProjects.filter((project: any) => 
          project.name?.toLowerCase().includes(searchLower) ||
          project.key?.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // Combine and deduplicate projects (user might be both member and owner of same project)
      const allProjectsMap = new Map();
      
      // Add member projects with role info
      memberProjects.forEach((project: any) => {
        allProjectsMap.set(project.id, {
          ...project,
          userRole: 'Member'
        });
      });
      
      // Add/update owner projects with role info (this will override if user is both member and owner)
      ownerProjects.forEach((project: any) => {
        const existing = allProjectsMap.get(project.id);
        allProjectsMap.set(project.id, {
          ...project,
          userRole: existing ? 'Member & Owner' : 'Project Owner'
        });
      });
      
      const uniqueProjects = Array.from(allProjectsMap.values());
      
      if (uniqueProjects.length === 0) {
        return [];
      }

      const searchResults: SearchBoardResult[] = [];

      // For each project, get active sprint and tasks
      for (const project of uniqueProjects.slice(0, 8)) { // Increase limit to 8 since we might have more results
        try {
          // Get active sprint for project
          const sprintResponse = await axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${project.id}/active`);
          const activeSprint = sprintResponse.data?.data;

          // Get all sprints count
          const allSprintsResponse = await axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${project.id}`);
          const sprintCount = allSprintsResponse.data?.data?.length || 0;

          // Get tasks for the project
          let tasks: TaskData[] = [];
          let activeTaskCount = 0;
          let completedTaskCount = 0;

          if (activeSprint) {
            const tasksResponse = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/sprint/${activeSprint.id}`);
            if (tasksResponse.data?.data) {
              tasks = tasksResponse.data.data;
              activeTaskCount = tasks.filter(task => task.status !== 'DONE').length;
              completedTaskCount = tasks.filter(task => task.status === 'DONE').length;
            }
          } else {
            // If no active sprint, get tasks from project (backlog)
            const tasksResponse = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${project.id}`);
            if (tasksResponse.data?.data) {
              tasks = tasksResponse.data.data.slice(0, 10); // Limit to 10 most recent tasks
              activeTaskCount = tasks.filter(task => task.status !== 'DONE').length;
              completedTaskCount = tasks.filter(task => task.status === 'DONE').length;
            }
          }

          searchResults.push({
            project: {
              ...project,
              userRole: project.userRole // Add user role to project info
            },
            activeSprint,
            tasks,
            sprintCount,
            activeTaskCount,
            completedTaskCount
          });

        } catch (error) {
          // If error fetching details for this project, still include it with basic info
          searchResults.push({
            project: {
              ...project,
              userRole: project.userRole
            },
            activeSprint: null,
            tasks: [],
            sprintCount: 0,
            activeTaskCount: 0,
            completedTaskCount: 0
          });
        }
      }

      return searchResults;

    } catch (error) {
      console.error("Error searching boards with details:", error);
      // If owner search fails, fallback to member search only
      try {
        const currentUserId = userData?.profile?.id || userData?.account?.id;
        const memberOnlyResponse = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=${encodeURIComponent(term)}&userId=${currentUserId}`);
        const memberProjects = memberOnlyResponse.data?.data || [];
        
        // Return simplified results for member projects only
        return memberProjects.slice(0, 5).map((project: any) => ({
          project: {
            ...project,
            userRole: 'Member'
          },
          activeSprint: null,
          tasks: [],
          sprintCount: 0,
          activeTaskCount: 0,
          completedTaskCount: 0
        }));
      } catch (fallbackError) {
        return [];
      }
    }
  };

  // ✅ NEW: Handle search board input change
  const handleSearchBoardChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchBoardQuery(term);
    
    if (term.trim().length > 2) {
      try {
        setIsSearchingBoard(true);
        setShowSearchBoardResults(true);
        
        const results = await searchBoardsWithDetails(term);
        setSearchBoardResults(results);
        setSelectedBoardIndex(-1);
        
      } catch (err) {
        setSearchBoardResults([]);
        toast.error("Failed to search boards. Please try again.");
      } finally {
        setIsSearchingBoard(false);
      }
    } else {
      setSearchBoardResults([]);
      setShowSearchBoardResults(false);
      setIsSearchingBoard(false);
    }
  };

  // ✅ NEW: Handle search board submit
  const handleSearchBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchBoardResults.length > 0) {
      const selectedResult = searchBoardResults[selectedBoardIndex >= 0 ? selectedBoardIndex : 0];
      handleSelectSearchBoard(selectedResult);
    }
  };

  // ✅ NEW: Handle search board selection
  const handleSelectSearchBoard = (result: SearchBoardResult) => {
    setSearchBoardQuery("");
    setSearchBoardResults([]);
    setShowSearchBoardResults(false);
    setSelectedBoardIndex(-1);
    
    // Store selected project info
    sessionStorage.setItem("currentProjectId", result.project.id);
    sessionStorage.setItem("currentProjectName", result.project.name);
    sessionStorage.setItem("currentProjectKey", result.project.key);
    
    // Navigate to project board
    router.push(`/project/project_homescreen?projectId=${result.project.id}`);
  };

  // ✅ NEW: Handle keyboard navigation for search board
  const handleSearchBoardKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchBoardResults || searchBoardResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedBoardIndex(prev => 
          prev < searchBoardResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedBoardIndex(prev => 
          prev > 0 ? prev - 1 : searchBoardResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedBoardIndex >= 0) {
          handleSelectSearchBoard(searchBoardResults[selectedBoardIndex]);
        } else if (searchBoardResults.length > 0) {
          handleSelectSearchBoard(searchBoardResults[0]);
        }
        break;
      case 'Escape':
        setShowSearchBoardResults(false);
        setSelectedBoardIndex(-1);
        break;
    }
  };

  const fetchTasksForLatestSprint = async (
    projectId: string,
    sprintId: string
  ) => {
    try {
      setLoading(true);
      const statuses: Task["status"][] = [
        "TODO",
        "IN_PROGRESS",
        "REVIEW",
        "DONE",
      ];
      
      try {
        const promises = statuses.map((status) =>
          axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/filter_details`, {
            params: { status, projectId, sprintId },
          })
        );

        const responses = await Promise.all(promises);
        
        const allTasks = responses.flatMap((res, index) => {
          const statusTasks = res.data?.data || [];
          return statusTasks;
        });
        
        if (allTasks.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }

        const formattedTasks = allTasks.map((task: any) => ({
          ...task,
          status: task.status?.toUpperCase().replace(" ", "_") as Task["status"],
        }));
        
        // ✅ Enhance tasks with assignee names
        try {
          const { enhanceTasksWithAssigneeNames } = await import('@/utils/taskHelpers');
          const enhancedTasks = await enhanceTasksWithAssigneeNames(formattedTasks);
          setTasks(enhancedTasks);
          console.log(`✅ Enhanced ${enhancedTasks.filter(t => t.assigneeId).length} tasks with assignee names`);
        } catch (enhanceError) {
          console.warn('Failed to enhance tasks with assignee names:', enhanceError);
        setTasks(formattedTasks);
        }
        
        // Check for overdue tasks and send notifications
        try {
          const tasksWithProjectName = formattedTasks.map(task => ({
            ...task,
            projectName: project?.name || "Unknown Project"
          }));
          await checkAndNotifyOverdueTasks(tasksWithProjectName);
        } catch (overdueError) {
          // Don't fail the main operation if overdue check fails
        }
      } catch (error) {
        toast.error("Error loading tasks from API");
        // Set empty tasks array to ensure the UI renders properly
        setTasks([]);
      }
    } catch (err) {
      toast.error("Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    axios
      .get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}`)
      .then((res) => {
        const projectData = res.data?.data;
        setProject(projectData);
      })
      .catch((err) => {
        toast.error("Failed to load project details");
      });

    axios
      .get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/users`)
      .then((res) => {
        const users = res.data?.data || [];
        setProjectUsers(users);
      })
      .catch((err) => {
        toast.error("Failed to load project users");
      });

    axios
      .get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`)
      .then((res) => {
        const sprintsData = res.data?.data || [];
        
        const formattedSprints = sprintsData.map((sprint: {id: string, name?: string, number?: number}) => ({
          id: sprint.id,
          name: sprint.name || `Sprint ${sprint.number || ''}`,
        }));
        
        setSprints(formattedSprints);
        
        fetchLatestSprint();
      })
      .catch((err) => {
        toast.error("Failed to load sprints");
        fetchLatestSprint();
      });
  }, [projectId]);

  const fetchLatestSprint = () => {
    if (!projectId) return;
    
    axios
      .get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}/active`)
      .then((res) => {
        // Handle new API response format with ResponseDataAPI
        const sprint = res.data?.data;

        if (!sprint || !sprint.id) {
          fetchLatestNonCompletedSprint();
          return;
        }

        const sprintId = sprint.id;
        setLatestSprintId(sprintId);
        setCurrentSprint(sprint); // Store the complete sprint info

        fetchTasksForLatestSprint(projectId, sprintId);
      })
      .catch((err) => {
        fetchLatestNonCompletedSprint();
      });
  };

  const fetchLatestNonCompletedSprint = () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    axios
      .get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`)
      .then((res) => {
        const sprintsData = res.data?.data || [];
        
        // 🎯 Priority 1: Find ACTIVE sprints first (highest priority)
        const activeSprints = sprintsData.filter(
          (sprint: any) => sprint.status === "ACTIVE"
        );
        
        if (activeSprints.length > 0) {
          // Sort active sprints: prioritize non-test sprints first, then by creation date
          activeSprints.sort((a: any, b: any) => {
            const aIsTest = (a.name || '').toLowerCase().includes('test');
            const bIsTest = (b.name || '').toLowerCase().includes('test');
            
            // If one is test and other is not, prioritize non-test
            if (aIsTest && !bIsTest) return 1;
            if (!aIsTest && bIsTest) return -1;
            
            // If both are test or both are not test, sort by creation date (newest first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          const activeSprint = activeSprints[0];
          
          if (activeSprint && activeSprint.id) {
            setLatestSprintId(activeSprint.id);
            setCurrentSprint(activeSprint); // Store complete sprint info
            fetchTasksForLatestSprint(projectId, activeSprint.id);
            
            // Show informative message about active sprint
            toast.success("🚀 Active Sprint", {
              description: `Viewing "${activeSprint.name}" - currently in progress`
            });
            return;
          }
        }
        
        // 🎯 Priority 2: Find NOT_STARTED sprints (ready to start)
        const notStartedSprints = sprintsData.filter(
          (sprint: any) => sprint.status === "NOT_STARTED"
        );
        
        if (notStartedSprints.length > 0) {
          notStartedSprints.sort((a: any, b: any) => 
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          );
          
          const latestSprint = notStartedSprints[0];
          
          if (latestSprint && latestSprint.id) {
            setLatestSprintId(latestSprint.id);
            setCurrentSprint(latestSprint); // Store complete sprint info
            fetchTasksForLatestSprint(projectId, latestSprint.id);
            
            // Show informative message about not started sprint
            toast.info("📅 Ready to Start", {
              description: `Sprint "${latestSprint.name}" is ready to begin. Start it from the Backlog.`
            });
            return;
          }
        }
        
        // 🎯 Priority 3: Fall back to most recent sprint (any status)
        if (sprintsData.length > 0) {
          sprintsData.sort((a: any, b: any) => 
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          );
          
          const mostRecentSprint = sprintsData[0];
          
          if (mostRecentSprint && mostRecentSprint.id) {
            setLatestSprintId(mostRecentSprint.id);
            setCurrentSprint(mostRecentSprint); // Store complete sprint info
            fetchTasksForLatestSprint(projectId, mostRecentSprint.id);
            
            // Show informative message based on sprint status
            if (mostRecentSprint.status === "COMPLETED") {
              toast.info("📋 Completed Sprint", {
                description: `Sprint "${mostRecentSprint.name}" is completed. Consider creating a new sprint for new tasks.`
              });
            } else if (mostRecentSprint.status === "ARCHIVED") {
              toast.info("📦 Archived Sprint", {
                description: `Viewing archived sprint "${mostRecentSprint.name}". Create a new sprint for active development.`
              });
            }
            return;
          }
        }
        
        // 🎯 No sprints at all - show empty state with helpful guidance
        setTasks([]);
        setLoading(false);
        toast.info("🚀 Welcome to your project board!", {
          description: "No sprints found. Go to Backlog to create your first sprint and start organizing tasks."
        });
      })
      .catch((err) => {
        toast.error("Failed to load sprint details");
        setLoading(false);
      });
  };

  const handleCreateTaskByStatus = async (status: Task["status"]) => {
    const title = newTasks[status];
    if (!title.trim() || !projectId || !latestSprintId) {
      toast.error("Missing required information to create task");
      return;
    }

    try {
      setLoading(true);

      // Get current user ID for createdBy field
      const currentUserId = userData?.profile?.id || userData?.account?.id || localStorage.getItem("ownerId") || localStorage.getItem("userId") || undefined;

      console.log("🔍 DEBUG Task Creation:", {
        title,
        status,
        projectId,
        sprintId: latestSprintId,
        currentUserId,
        userDataProfile: userData?.profile,
        userDataAccount: userData?.account,
        localStorageOwnerId: localStorage.getItem("ownerId"),
        localStorageUserId: localStorage.getItem("userId"),
        allLocalStorageKeys: Object.keys(localStorage)
      });

      if (!currentUserId) {
        console.error("❌ No current user ID found! Cannot set createdBy field.");
        toast.error("Unable to identify current user. Please try logging in again.");
        return;
      }

      // Clear input immediately for better UX
      setNewTasks((prev) => ({ ...prev, [status]: "" }));

      // Create task via API first
      const res = await axios.post(`${API_CONFIG.TASKS_SERVICE}/api/tasks`, {
        title,
        content: title,
        status,
        projectId,
        sprintId: latestSprintId,
        description: "",
        storyPoint: 0,
        assigneeId: null,
        dueDate: null,
        completedAt: null,
        parentTaskId: null,
        tags: null,
        createdBy: currentUserId,
      });

      // Try different ways to extract task data from response
      let newTaskFromAPI = null;
      
      // Method 1: Check if data is in res.data.data
      if (res.data?.data) {
        newTaskFromAPI = res.data.data;
      }
      // Method 2: Check if data is directly in res.data
      else if (res.data && typeof res.data === 'object' && res.data.id) {
        newTaskFromAPI = res.data;
      }
      // Method 3: Check for other common response structures
      else if (res.data?.result) {
        newTaskFromAPI = res.data.result;
      }
      else if (res.data?.task) {
        newTaskFromAPI = res.data.task;
      }
      // Method 4: Check if response is successful but empty/different structure
      else if (res.status === 200 || res.status === 201) {
        newTaskFromAPI = {}; // Empty object to trigger temporary task creation
      }

      // Check if we have valid task data OR if response was successful
      if (newTaskFromAPI !== null && (newTaskFromAPI.id || res.status === 200 || res.status === 201)) {
        // Generate ID if missing but response was successful
        const taskId = newTaskFromAPI.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create properly formatted task object
        const newTask: Task = {
          id: taskId,
          title: newTaskFromAPI.title || title,
          description: newTaskFromAPI.description || "",
          status: status,
          storyPoint: newTaskFromAPI.storyPoint || 0,
          assigneeId: newTaskFromAPI.assigneeId || null,
          assigneeName: newTaskFromAPI.assigneeName || "Unassigned",
          shortKey: newTaskFromAPI.shortKey || `T-${Math.floor(Math.random() * 1000)}`,
          projectId: newTaskFromAPI.projectId || projectId,
          sprintId: newTaskFromAPI.sprintId || latestSprintId,
          dueDate: newTaskFromAPI.dueDate || null,
          createdAt: newTaskFromAPI.createdAt || new Date().toISOString(),
          completedAt: newTaskFromAPI.completedAt || null,
          parentTaskId: newTaskFromAPI.parentTaskId || null,
          tags: newTaskFromAPI.tags || null,
          createdBy: newTaskFromAPI.createdBy || currentUserId
        };

        // Add to tasks state immediately
        setTasks((prev) => [...prev, newTask]);
        
        if (newTaskFromAPI.id) {
          toast.success("Task created successfully");
        } else {
          toast.success("Task created successfully (refreshing to get ID...)");
        }
        
        // Refresh tasks after a short delay to ensure consistency
        setTimeout(async () => {
          if (projectId && latestSprintId) {
            await fetchTasksForLatestSprint(projectId, latestSprintId);
          }
        }, 1000);
      } else {
        // This should rarely happen now since we handle successful responses above
        const errorInfo = {
          responseStatus: res.status,
          responseData: res.data,
          hasData: !!res.data,
          dataKeys: res.data ? Object.keys(res.data) : [],
          taskFromAPI: newTaskFromAPI,
          isSuccessfulStatus: res.status >= 200 && res.status < 300
        };
        
        console.error("❌ Task creation failed - Response analysis:", errorInfo);
        
        // If status is successful, still try to create temp task and refresh
        if (res.status >= 200 && res.status < 300) {
          const tempTask: Task = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title,
            description: "",
            status: status,
            storyPoint: 0,
            assigneeId: null,
            assigneeName: "Unassigned",
            shortKey: `T-${Math.floor(Math.random() * 1000)}`,
            projectId: projectId,
            sprintId: latestSprintId,
            dueDate: null,
            createdAt: new Date().toISOString(),
            completedAt: null,
            parentTaskId: null,
            tags: null,
            createdBy: currentUserId
          };

          setTasks((prev) => [...prev, tempTask]);
          toast.success("Task created successfully (refreshing...)");
          
          // Refresh immediately to get the real task
          setTimeout(async () => {
            if (projectId && latestSprintId) {
              await fetchTasksForLatestSprint(projectId, latestSprintId);
            }
          }, 500);
        } else {
          throw new Error(`Task creation failed - Response status: ${res.status}. Please check the API response structure.`);
        }
      }
    } catch (err) {
      toast.error("Failed to create task. Please try again.");
      
      // Restore input value on error
      setNewTasks((prev) => ({ ...prev, [status]: title }));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (updatedTask: TaskData) => {
    try {
      // Store original task for comparison
      const originalTask = selectedTask;
      
      // Update the selected task in the state first for immediate UI update
      setSelectedTask(updatedTask);
      
      const res = await axios.put(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${updatedTask.id}`, updatedTask);
      
      if (res.data?.status === "SUCCESS") {
        toast.success("Task updated successfully");
        
        // Update the task in the tasks list
        setTasks(prev => 
          prev.map(task => 
            task.id === updatedTask.id ? { ...updatedTask as Task } : task
          )
        );

        // Send TASK_UPDATED notifications using the shared function
        try {
          await sendTaskNotifications(updatedTask as Task, "TASK_UPDATED");
        } catch (notificationError) {
          // Don't fail the main operation if notification fails
        }
        
        setTimeout(async () => {
          if (projectId && latestSprintId) {
            await fetchTasksForLatestSprint(projectId, latestSprintId);
          }
        }, 2000);
      }
    } catch (err) {
      toast.error("Failed to update task. Please try again.");
    }
  };

  const fetchUserAvatar = async (userId: string): Promise<string | undefined> => {
    if (!userId || userId.trim() === '') {
      return DEFAULT_AVATAR_URL;
    }
    
    // Kiểm tra cache trước
    if (avatarCache.current[userId]) {
      return avatarCache.current[userId];
    }
    
    // Check if we've already tried to fetch this avatar and got a 404
    if (userAvatarFetchErrors.current.has(userId)) {
      return DEFAULT_AVATAR_URL;
    }
    
    // Kiểm tra xem user có trong projectUsers không, để tránh gọi API
    const userInProject = projectUsers.find(u => u.id === userId);
    if (userInProject) {
      let avatarUrl = DEFAULT_AVATAR_URL;
      
      if (userInProject.avatar) {
        // Nếu avatar là URL đầy đủ
        if (userInProject.avatar.startsWith('http') || userInProject.avatar.startsWith('https')) {
          avatarUrl = userInProject.avatar;
        }
        // Nếu avatar là dữ liệu Base64
        else if (userInProject.avatar.startsWith('/9j/') || userInProject.avatar.startsWith('data:image')) {
          avatarUrl = userInProject.avatar;
        }
        // Tạo URL Cloudinary từ avatar value
        else {
          avatarUrl = `https://res.cloudinary.com/dwmospuhh/image/upload/avatars/${userInProject.avatar}`;
        }
      }
      
      // Lưu vào cache
      avatarCache.current[userId] = avatarUrl;
      return avatarUrl;
    }
    
    // Nếu không tìm thấy user trong projectUsers, gọi API
    try {
      // Gọi API để lấy thông tin user
      const response = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${userId}`);
      const userData = response.data?.data;
      
      if (!userData) {
        userAvatarFetchErrors.current.add(userId);
        avatarCache.current[userId] = DEFAULT_AVATAR_URL;
        return DEFAULT_AVATAR_URL;
      }
      
      let avatarUrl = DEFAULT_AVATAR_URL;
      
      if (userData.avatar) {
        // Nếu avatar là URL đầy đủ
        if (userData.avatar.startsWith('http') || userData.avatar.startsWith('https')) {
          avatarUrl = userData.avatar;
        }
        // Nếu avatar là dữ liệu Base64
        else if (userData.avatar.startsWith('/9j/') || userData.avatar.startsWith('data:image')) {
          avatarUrl = userData.avatar;
        }
        // Tạo URL Cloudinary
        else {
          avatarUrl = `https://res.cloudinary.com/dwmospuhh/image/upload/avatars/${userData.avatar}`;
        }
      }
      
      // Lưu vào cache
      avatarCache.current[userId] = avatarUrl;
      return avatarUrl;
    } catch (err) {
      // Store the userId that resulted in a 404 to avoid future requests
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        userAvatarFetchErrors.current.add(userId);
      }
      
      avatarCache.current[userId] = DEFAULT_AVATAR_URL;
      return DEFAULT_AVATAR_URL;
    }
  };

  const getInitials = (name: string): string => {
    if (!name || name === "Unassigned") return "?";
    return name.split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  // Thêm hàm kiểm tra và tạo nguồn từ dữ liệu Base64 hoặc URL
  const getImageSource = (avatarData: string | undefined): string => {
    if (!avatarData) return '';
    
    // Kiểm tra xem đây có phải là dữ liệu Base64 không
    if (avatarData.startsWith('/9j/') || avatarData.startsWith('data:image')) {
      // Nếu đã có định dạng data:image thì giữ nguyên, nếu không thêm vào
      const result = avatarData.startsWith('data:image') 
        ? avatarData 
        : `data:image/jpeg;base64,${avatarData}`;
      return result;
    }
    
    // Nếu là URL Cloudinary, kiểm tra và xử lý phù hợp
    if (avatarData.includes('cloudinary.com')) {
      // Phân tích URL để xem có phần mở rộng không
      const hasExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(avatarData);
      
      // Tạo base URL, thêm phần mở rộng nếu chưa có
      let processedUrl = avatarData;
      if (!hasExtension) {
        // Nếu URL không có phần mở rộng, thử với jpg
        processedUrl = `${avatarData}.jpg`;
      }
      
      // Thêm cache-busting để tránh bị cache
      const separator = processedUrl.includes('?') ? '&' : '?';
      const result = `${processedUrl}${separator}_t=${Date.now()}`;
      return result;
    }
    
    // Nếu là URL khác, giữ nguyên
    if (avatarData.startsWith('http') || avatarData.startsWith('https')) {
      return avatarData;
    }
    
    // Trường hợp còn lại
    return avatarData;
  };

  // Default avatar URL sẽ được sử dụng khi không có avatar hoặc avatar không tải được
  const DEFAULT_AVATAR_URL = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

  // Hàm tạo component hiển thị avatar với xử lý lỗi
  const AvatarDisplay = ({ 
    avatarUrl, 
    displayName, 
    size = "normal" 
  }: { 
    avatarUrl?: string, 
    displayName: string, 
    size?: "small" | "normal" 
  }) => {
    const [imageError, setImageError] = useState(false);
    const [isCheckingImage, setIsCheckingImage] = useState(false);
    const [currentUrlToTry, setCurrentUrlToTry] = useState(avatarUrl);
    
    // Extensions to try when the original URL fails
    const extensionsToTry = ['.jpg', '.jpeg', '.png', '.webp'];
    const [currentExtensionIndex, setCurrentExtensionIndex] = useState(-1);
    
    useEffect(() => {
      // Reset states when avatarUrl changes
      setImageError(false);
      setIsCheckingImage(false);
      setCurrentUrlToTry(avatarUrl);
      setCurrentExtensionIndex(-1);
    }, [avatarUrl]);
    
    useEffect(() => {
      // Skip validation for non-Cloudinary URLs or base64 data
      if (!currentUrlToTry || 
          currentUrlToTry === DEFAULT_AVATAR_URL || 
          currentUrlToTry.startsWith('data:image') || 
          !currentUrlToTry.includes('cloudinary.com')) {
        return;
      }
      
      setIsCheckingImage(true);
      
      // Tạo một Image object để kiểm tra xem ảnh có tồn tại không
      const img = new Image();
      
      img.onload = () => {
        setIsCheckingImage(false);
      };
      
      img.onerror = () => {
        // Try next extension if this is a Cloudinary URL
        if (currentUrlToTry.includes('cloudinary.com')) {
          const nextExtensionIndex = currentExtensionIndex + 1;
          
          if (nextExtensionIndex < extensionsToTry.length) {
            // Get base URL without any existing extension
            let baseUrl = currentUrlToTry;
            const extensionMatch = baseUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            if (extensionMatch) {
              baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('.'));
            }
            
            const nextUrl = `${baseUrl}${extensionsToTry[nextExtensionIndex]}`;
            console.log(`Trying with ${extensionsToTry[nextExtensionIndex]} extension:`, nextUrl);
            
            setCurrentExtensionIndex(nextExtensionIndex);
            setCurrentUrlToTry(nextUrl);
            return;
          }
          
          // Try without version number if all extensions fail
          if (currentUrlToTry.includes('/v')) {
            const urlParts = currentUrlToTry.split('/');
            const versionIndex = urlParts.findIndex(part => part.startsWith('v') && /^v\d+$/.test(part));
            
            if (versionIndex !== -1) {
              urlParts.splice(versionIndex, 1);
              const urlWithoutVersion = urlParts.join('/');
              
              setCurrentExtensionIndex(-1);
              setCurrentUrlToTry(urlWithoutVersion);
              return;
            }
          }
        }
        
        // If all attempts fail, show fallback
        setImageError(true);
        setIsCheckingImage(false);
      };
      
      const cacheBuster = `?t=${Date.now()}`;
      img.src = `${currentUrlToTry}${cacheBuster}`;
    }, [currentUrlToTry, currentExtensionIndex]);
    
    const containerClass = size === "small" 
      ? "w-6 h-6" 
      : "w-8 h-8";
    
    if (isCheckingImage) {
      return (
        <div className={`${containerClass} flex items-center justify-center bg-gray-200 text-gray-500 text-xs font-medium rounded-full animate-pulse`}>
          {getInitials(displayName)}
        </div>
      );
    }
    
    if (!avatarUrl || imageError) {
      return (
        <div className={`${containerClass} relative rounded-full overflow-hidden`}>
          <img 
            src={DEFAULT_AVATAR_URL}
            alt={displayName} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.classList.add('bg-blue-500', 'text-white', 'flex', 'items-center', 'justify-center', 'text-xs', 'font-medium');
              (e.target as HTMLImageElement).parentElement!.innerHTML = getInitials(displayName);
            }}
          />
        </div>
      );
    }
    
    const finalUrl = avatarUrl;
    
    return (
      <div className={`${containerClass} relative rounded-full overflow-hidden`}>
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-medium">
            {getInitials(displayName)}
          </div>
        ) : (
          <img 
            src={getImageSource(isCheckingImage ? currentUrlToTry : finalUrl)} 
            alt={displayName} 
            className="w-full h-full object-cover" 
            onError={() => {
              if (!isCheckingImage) {
                setImageError(true);
              }
            }}
          />
        )}
      </div>
    );
  };

  function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [userList, setUserList] = useState<ProjectUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const avatarRef = useRef<HTMLDivElement>(null);
    const [assigneeAvatarUrl, setAssigneeAvatarUrl] = useState<string | undefined>(DEFAULT_AVATAR_URL);
    // State để lưu trữ các avatar URL đã fetch
    const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
    const hasFetchedUsers = useRef(false);
    const [validAssignee, setValidAssignee] = useState(false);
    
    // ✅ Auto-fetch project users on mount to populate assignee data
    useEffect(() => {
      if (projectId && !hasFetchedUsers.current) {
        fetchProjectUsers();
      }
    }, [projectId]);

    useEffect(() => {
      const hasValidAssigneeId = !!task.assigneeId && task.assigneeId.trim().length > 0;
      setValidAssignee(hasValidAssigneeId);
      
      if (!hasValidAssigneeId) {
        setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
      }
    }, [task]);

    const assignee = (validAssignee && task.assigneeId) 
      ? projectUsers.find(u => u.id === task.assigneeId) 
      : null;
    
    useEffect(() => {
      // Removed debug logging
    }, [assignee]);

    useEffect(() => {
      // Nếu không có assigneeId hợp lệ, sử dụng avatar mặc định
      if (!validAssignee || !task.assigneeId) {
        setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
        return;
      }
      
      // Kiểm tra cache trước khi fetch
      if (avatarCache.current[task.assigneeId]) {
        setAssigneeAvatarUrl(avatarCache.current[task.assigneeId]);
        return;
      }
      
      // Fetch avatar nếu không có trong cache
      fetchUserAvatar(task.assigneeId).then(url => {
        if (url) {
          setAssigneeAvatarUrl(url);
        } else {
          setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
        }
      }).catch(() => {
        setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
      });
    }, [task.assigneeId, validAssignee]);

    const fetchProjectUsers = async () => {
      if (!projectId) return;
      
      // Nếu đã fetch users trước đó, chỉ sử dụng lại kết quả
      if (hasFetchedUsers.current) {
        return;
      }
      
      try {
        setLoadingUsers(true);
        const res = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/project/${projectId}`);
        const users = res.data?.data || [];
        
        // Cập nhật danh sách users
        setUserList(users);
        
        // Cập nhật cache avatars cho mỗi user
        users.forEach((user: ProjectUser) => {
          if (user.id) {
            if (user.avatar) {
              // Xử lý avatar URL và đưa vào cache
              if (user.avatar.startsWith('http') || user.avatar.startsWith('https') || 
                  user.avatar.startsWith('/9j/') || user.avatar.startsWith('data:image')) {
                avatarCache.current[user.id] = user.avatar;
              } else {
                // Tạo Cloudinary URL cho avatar
                const cloudinaryUrl = `https://res.cloudinary.com/dwmospuhh/image/upload/avatars/${user.avatar}`;
                avatarCache.current[user.id] = cloudinaryUrl;
              }
            } else {
              // Không có avatar, sử dụng mặc định
              avatarCache.current[user.id] = DEFAULT_AVATAR_URL;
            }
          }
        });
        
        // Đánh dấu đã fetch users
        hasFetchedUsers.current = true;
      } catch (err) {
        console.error("Error fetching project users:", err);
        // Khởi tạo danh sách rỗng nếu có lỗi
        setUserList([]);
        hasFetchedUsers.current = true;
      } finally {
        setLoadingUsers(false);
      }
    };

    const handleShowDropdown = async (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!showDropdown) {
        await fetchProjectUsers();
      }
      
      setShowDropdown(!showDropdown);
    };

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      }
      if (showDropdown) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showDropdown]);

    const handleAssignUser = async (userId: string, userName: string) => {
      try {
        // Validate task ID before proceeding - relaxed validation
        if (!task?.id || 
            task.id.startsWith('temp-') || 
            task.id.includes('undefined') || 
            task.id === 'new' ||
            task.id === '' ||
            task.id.length < 5) {
          toast.error("Cannot assign user to temporary task. Please save the task first.");
          return;
        }
        
        // Set validAssignee state based on whether userId exists
        const isValid = !!userId && userId.trim().length > 0;
        setValidAssignee(isValid);
        
        // Store previous assignee info for notification purposes
        const previousAssigneeId = task.assigneeId;
        const isReassignment = previousAssigneeId && previousAssigneeId !== userId;
        
        const currentUserId = localStorage.getItem("ownerId") || localStorage.getItem("userId") || '';
        const taskPayload = {
          ...task,
          assigneeId: userId || null,
          assigneeName: isValid ? userName : "Unassigned"
        };
        const headers = {
            'Content-Type': 'application/json',
          'X-User-Id': currentUserId,
        };
        const url = `${API_CONFIG.TASKS_SERVICE}/api/tasks/${task.id}`;
        
        // Debug user permissions and localStorage data
        console.log("🔍 DEBUG LocalStorage Data:", {
          ownerId: localStorage.getItem("ownerId"),
          userId: localStorage.getItem("userId"),
          username: localStorage.getItem("username"),
          fullname: localStorage.getItem("fullname"),
          userRole: localStorage.getItem("userRole"),
          allLocalStorageKeys: Object.keys(localStorage)
        });

        console.log("🔍 DEBUG User Permissions:", {
          userPermissions,
          canAssignTasks: userPermissions?.canAssignTasks,
          canManageAnyTask: userPermissions?.canManageAnyTask
        });

        console.log("🔍 DEBUG Task Assignment Request:", {
          url,
          taskId: task.id,
          taskTitle: task.title,
          taskProjectId: task.projectId,
          taskCreatedBy: task.createdBy,
          taskAssigneeId: task.assigneeId,
          currentUserId,
          currentUserIdFormat: {
            length: currentUserId.length,
            isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUserId)
          },
          newAssigneeId: userId,
          isReassignment,
          headers,
          payloadKeys: Object.keys(taskPayload)
        });

        const response = await axios.put(url, taskPayload, { headers });
        console.log("✅ Assignment response:", response.data);
        
        if (isValid) {
          toast.success(`Assigned to ${userName}`);
        } else {
          toast.success(`Task unassigned`);
        }
        
        setTasks(prev =>
          prev.map(t =>
            t.id === task.id ? { 
              ...t, 
              assigneeId: userId || null, 
              assigneeName: isValid ? userName : "Unassigned"
            } : t
          )
        );
        
        // Reset avatar URL for unassigned tasks
        if (!isValid) {
          setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
        }
        
        // Send notification when assigning to a user (not when unassigning)
        if (isValid && userId) {
          try {
            // Get current user info from localStorage with detailed logging
            const currentUserId = localStorage.getItem("ownerId") || localStorage.getItem("userId");
            const currentUserName = localStorage.getItem("username") || localStorage.getItem("fullname") || "Unknown User";
            
            // Don't send notification if user assigns task to themselves
            if (currentUserId && currentUserId !== userId) {
              // Standard payload format - only essential fields
              const notificationData = {
                type: isReassignment ? "TASK_REASSIGNED" : "TASK_ASSIGNED",
                title: isReassignment ? "Task reassigned" : "Task assigned",
                message: `You have been ${isReassignment ? 'reassigned to' : 'assigned to'} task "${task.title}"`,
                recipientUserId: userId,
                actorUserId: currentUserId,
                actorUserName: currentUserName,
                projectId: task.projectId || projectId,
                projectName: project?.name || "Unknown Project",
                taskId: task.id
              };
              
              try {
                const notificationResponse = await axios.post(
                  `${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, 
                  notificationData,
                  {
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (notificationResponse.data) {
                  toast.success(`${isReassignment ? 'Reassignment' : 'Assignment'} notification sent to ${userName}`);
                } else {
                  throw new Error("No data in notification response");
                }
              } catch (apiError) {
                throw apiError; // Re-throw to be caught by outer catch
              }
              
            } else if (currentUserId === userId) {
              // User assigned task to themselves - no notification needed
            } else {
              // Missing current user ID - no notification sent
            }
            
          } catch (notificationError) {
            // Don't show error toast to user as assignment still succeeded
          }
        } else {
          console.log("ℹ️ No notification needed:", {
            isValid,
            userId,
            reason: !isValid ? "Invalid assignment" : "No user ID"
          });
        }
        
        console.log(`✅ Task assignment updated: ${isReassignment ? 'Reassigned' : 'Assigned'} task "${task.title}" to ${userName} (${userId})`);
        
        await fetchProjectUsers();
      } catch (err: any) {
        console.error("❌ Task assignment failed:");
        console.error("Error:", err);
        console.error("Response:", err?.response?.data);
        console.error("Status:", err?.response?.status);
        console.error("Message:", err?.message);
        console.error("Task Info:", {
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          assigneeId: task.assigneeId,
          createdBy: task.createdBy
        });
        
        toast.error(`Failed to assign user: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
      }
    };

    const getAvatarUrl = (user: any): string | undefined => {
      if (!user) return undefined;
      
      // Nếu user có trường avatar và nó là URL đầy đủ hoặc dữ liệu Base64
      if (user.avatar && typeof user.avatar === 'string') {
        // Nếu là URL đầy đủ
        if (user.avatar.startsWith('http') || user.avatar.startsWith('https')) {
          return user.avatar;
        } 
        // Nếu là dữ liệu Base64
        else if (user.avatar.startsWith('/9j/') || user.avatar.startsWith('data:image')) {
          return user.avatar;
        }
        // Nếu là UUID hoặc tên file, tạo URL Cloudinary
        else {
          const cloudinaryUrl = `https://res.cloudinary.com/dwmospuhh/image/upload/avatars/${user.avatar}.jpg`;
          return cloudinaryUrl;
        }
      }
      
      // Các trường hợp khác giữ nguyên
      if (user.url && typeof user.url === 'string') {
        return user.url;
      }
      
      if (user.avatarUrl && typeof user.avatarUrl === 'string') {
        return user.avatarUrl;
      }
      
      if (user.avatar_url && typeof user.avatar_url === 'string') {
        return user.avatar_url;
      }
      
      return undefined;
    };

    // Xác định tên người được gán nhiệm vụ
    // ✅ PRIORITY: Use task.assigneeName (from enhanced helper) if assignee not found in projectUsers
    const assigneeName = validAssignee 
      ? (assignee?.username || assignee?.name || task.assigneeName || "Unknown User")
      : "Unassigned";
    
    // ✅ DEBUG: Log assignee resolution for AI-generated tasks
    if (task.assigneeId && !assignee && task.assigneeName) {
      console.log(`🔍 TaskCard Assignee Resolution for "${task.title}":`, {
        hasAssigneeId: !!task.assigneeId,
        assigneeId: task.assigneeId,
        hasAssigneeInProjectUsers: !!assignee,
        taskAssigneeName: task.assigneeName,
        finalAssigneeName: assigneeName,
        validAssignee: validAssignee
      });
    }
    
    // Ưu tiên sử dụng URL từ assigneeAvatarUrl đã fetch từ API
    let avatarUrl = assigneeAvatarUrl;
    
    // Kiểm tra xem có phải là assignee hợp lệ không
    if (!validAssignee) {
      avatarUrl = DEFAULT_AVATAR_URL;
    } 
    // Nếu không có avatar URL từ fetch, thử lấy từ assignee object
    else if (!avatarUrl && assignee) {
      avatarUrl = getAvatarUrl(assignee);
    }
    // ✅ For AI-generated tasks: If we have assigneeName but no assignee object, fetch avatar by ID
    else if (!avatarUrl && validAssignee && task.assigneeId && task.assigneeName) {
      // Try to fetch avatar for AI-assigned tasks that aren't in projectUsers yet
      fetchUserAvatar(task.assigneeId).then(url => {
        if (url && url !== DEFAULT_AVATAR_URL) {
          setAssigneeAvatarUrl(url);
        }
      }).catch(() => {
        // Fallback to default if fetch fails
        setAssigneeAvatarUrl(DEFAULT_AVATAR_URL);
      });
      avatarUrl = DEFAULT_AVATAR_URL; // Use default initially while fetching
    }
    // Nếu vẫn không có và có assigneeId hợp lệ, sử dụng default avatar
    else if (!avatarUrl) {
      avatarUrl = DEFAULT_AVATAR_URL;
    }

    return (
      <div
        onClick={onClick}
        className="bg-white rounded-sm p-3 mb-2 shadow-sm cursor-pointer hover:bg-gray-50 border border-gray-200"
      >
        <div className="text-sm font-medium mb-4">{task.title}</div>
        <div className="flex justify-between items-center text-xs text-gray-700">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 border border-blue-600 bg-white rounded-sm flex items-center justify-center text-blue-600 text-[10px]">
              ✔
            </span>
            <span className="font-semibold">{task.shortKey || "T-000"}</span>
          </div>
          <div ref={avatarRef} className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors overflow-hidden"
              onClick={handleShowDropdown}
            >
              {!validAssignee ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 font-medium text-xs">
                  {getInitials("Unassigned")}
                </div>
              ) : (
                <AvatarDisplay 
                  avatarUrl={avatarUrl} 
                  displayName={assigneeName} 
                />
              )}
            </div>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-60 bg-white border rounded-lg shadow-lg z-10">
                {loadingUsers ? (
                  <div className="flex justify-center py-3">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="py-1 max-h-60 overflow-y-auto">
                    {/* Thêm tùy chọn "Unassign" */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b"
                      onClick={e => {
                        e.stopPropagation();
                        setShowDropdown(false);
                        handleAssignUser("", "Unassigned");
                      }}
                    >
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-medium text-xs">
                          ?
                        </div>
                      </div>
                      <span className="text-sm font-medium">Unassign</span>
                    </div>
                    
                    {userList.length > 0 ? (
                      userList.map(user => {
                        if (!user.id) return null; // Skip invalid users
                        
                        const displayName = user.username || user.name || "User";
                        
                        return (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              setShowDropdown(false);
                              handleAssignUser(user.id, displayName);
                            }}
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                              {user.id && avatarCache.current[user.id] && !avatarCache.current[user.id].includes(DEFAULT_AVATAR_URL) ? (
                                <img 
                                  src={avatarCache.current[user.id]} 
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                  onError={() => {
                                    // Nếu lỗi, hiển thị initials
                                    avatarCache.current[user.id] = DEFAULT_AVATAR_URL;
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-medium text-xs">
                                  {getInitials(displayName)}
                                </div>
                              )}
                            </div>
                            <span className="text-sm">{displayName}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-sm">No users found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const renderColumn = (title: string, status: Task["status"]) => {
    // Filter tasks: chỉ hiển thị parent tasks (không có parentTaskId) và có status tương ứng
    // ✅ NEW: Also filter out tasks with BLOCK priority
    const tasksInColumn = (filteredTasks || []).filter((t) => 
      t.status === status && 
      (t.parentTaskId === null || t.parentTaskId === undefined) &&
      t.priority !== "BLOCK"
    );
    const hasTasksInColumn = tasksInColumn.length > 0;
    
    return (
      <DroppableProjectColumn 
        status={status}
        className="flex-1 bg-gray-50 rounded p-4 min-h-[300px] border border-gray-200"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-sm uppercase text-gray-700">{title}</h2>
          <div className="text-xs font-semibold bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
            {loading ? "..." : tasksInColumn.length}
          </div>
        </div>
  
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 rounded-full border-t-transparent"></div>
          </div>
        ) : hasTasksInColumn ? (
          tasksInColumn.map((task) => (
            <DraggableProjectTaskCard key={task.id} task={task} disabled={!canEditTask(task)}>
            <TaskCard
              task={task}
              onClick={() => setSelectedTask(task)}
            />
            </DraggableProjectTaskCard>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 mb-3 flex items-center justify-center bg-gray-100 rounded-full text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect opacity="0.4" x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">No issues</p>
            <p className="text-gray-400 text-xs mt-1">Create issues or move them here</p>
          </div>
        )}
  
        <div className="mt-4 border rounded p-2 bg-white">
          <Input
            className="text-sm mb-2"
            placeholder={`Add task to ${title}`}
            value={newTasks[status]}
            onChange={(e) =>
              setNewTasks((prev) => ({ ...prev, [status]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTasks[status].trim() && latestSprintId) {
                e.preventDefault();
                handleCreateTaskByStatus(status);
              }
            }}
          />
          <Button
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!newTasks[status].trim() || !latestSprintId}
            onClick={() => handleCreateTaskByStatus(status)}
          >
            + Add
          </Button>
        </div>
      </DroppableProjectColumn>
    );
  };

  // Debug localStorage khi component mount
  useEffect(() => {
    // Only run on client side to prevent hydration mismatch
    if (typeof window === 'undefined') return;
    
    // Removed localStorage debugging
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
        setShowSearchBoardResults(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Function to check for overdue tasks and send notifications
  const checkAndSendOverdueNotifications = async () => {
    if (!projectId) return;
    
    try {
      // 1. Fetch overdue tasks for current project
      const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${projectId}/overdue`);
      
      if (response.data?.status === "SUCCESS" && response.data?.data) {
        const overdueTasks = response.data.data;
        
        // 2. Send notifications for each overdue task
        for (const task of overdueTasks) {
          try {
            await sendTaskNotifications(task, "TASK_OVERDUE");
          } catch (notificationError) {
            // Silently handle notification errors
          }
        }
        
        if (overdueTasks.length > 0) {
          toast.info(`Found ${overdueTasks.length} overdue task(s) - notifications sent`, {
            description: "Check your notifications for details"
          });
        }
      }
    } catch (error) {
      // Silently handle overdue check errors
    }
  };

  // Check for overdue tasks when component mounts or project changes
  useEffect(() => {
    if (projectId && project) {
      // Check overdue tasks after a delay to ensure other data is loaded
      const timeoutId = setTimeout(() => {
        checkAndSendOverdueNotifications();
      }, 3000); // 3 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [projectId, project]);

  // Main useEffect to fetch project data and permissions
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }

      if (!userData?.account?.id) {
        console.log('⏳ Waiting for user data...');
        return;
      }

      setLoading(true);
      console.log('🚀 Loading project data for:', projectId);

      try {
        // Fetch project data and permissions in parallel
        const [projectData] = await Promise.all([
          fetchProject(projectId),
          fetchUserPermissions(userData.account.id, projectId)
        ]);

        if (projectData) {
          // Fetch additional data only if project is loaded
          fetchLatestNonCompletedSprint();
        }
      } catch (error) {
        console.error('❌ Error loading project data:', error);
        toast.error('Failed to load project data');
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [projectId, userData?.account?.id]);


  // Add mounted state to fix hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ ENHANCED: Fetch user projects when needed - with proper dependency management
  useEffect(() => {
    // Only fetch if:
    // 1. No projectId (user needs to select a project) OR errorState shows project selector
    // 2. User data is available 
    // 3. Not already loading projects
    // 4. Haven't fetched for this user yet OR user ID changed
    
    const currentUserId = userData?.account?.id || userData?.profile?.id;
    const shouldFetch = (
      (!projectId || errorState?.showProjectSelector) && // Need project selection
      currentUserId && // User data available
      !loadingProjects && // Not already loading
      (!hasFetchedProjectsRef.current || lastFetchedUserIdRef.current !== currentUserId) // Haven't fetched for this user
    );
    
    console.log('🔍 [PROJECTS-EFFECT] Checking if should fetch projects:', {
      shouldFetch,
      hasProjectId: !!projectId,
      showProjectSelector: !!errorState?.showProjectSelector,
      hasUserId: !!currentUserId,
      loadingProjects,
      hasFetched: hasFetchedProjectsRef.current,
      lastUserId: lastFetchedUserIdRef.current,
      currentUserId
    });
    
    if (shouldFetch) {
      console.log('✅ [PROJECTS-EFFECT] Triggering fetchUserProjects');
      fetchUserProjects();
    } else {
      console.log('⏭️ [PROJECTS-EFFECT] Skipping fetchUserProjects - conditions not met');
    }
  }, [
    projectId, 
    errorState?.showProjectSelector, 
    userData?.account?.id, 
    userData?.profile?.id
    // Removed loadingProjects and userProjects.length from dependencies to prevent loops
  ]);

  // ✅ NEW: Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchesSearch = 
          task.title?.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.shortKey?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0) {
        if (!filters.status.includes(task.status)) return false;
      }

      // Assignee filter
      if (filters.assignee.length > 0) {
        if (!task.assigneeId || !filters.assignee.includes(task.assigneeId)) return false;
      }

      // Priority filter
      if (filters.priority.length > 0) {
        if (!task.priority || !filters.priority.includes(task.priority)) return false;
      }

      // Labels filter
      if (filters.labels.length > 0) {
        if (!task.tags || !task.tags.some(tag => filters.labels.includes(tag))) return false;
      }

      // Date filters
      if (filters.createdDateFrom && task.createdAt) {
        const createdDate = new Date(task.createdAt);
        const fromDate = new Date(filters.createdDateFrom);
        if (createdDate < fromDate) return false;
      }

      if (filters.createdDateTo && task.createdAt) {
        const createdDate = new Date(task.createdAt);
        const toDate = new Date(filters.createdDateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (createdDate > toDate) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // ✅ NEW: Get available labels from tasks
  const availableLabels = useMemo(() => {
    const labels = new Set<string>();
    tasks.forEach(task => {
      if (task.tags) {
        task.tags.forEach(tag => labels.add(tag));
      }
    });
    return Array.from(labels);
  }, [tasks]);

  // Add to window for debugging
  useEffect(() => {
    // @ts-ignore
    window.debugTaskPermissions = async () => {
      const currentUserId = localStorage.getItem("ownerId") || localStorage.getItem("userId");
      
      console.log("🧪 DEBUGGING TASK PERMISSIONS:");
      console.log("Current User ID:", currentUserId);
      console.log("Project ID:", projectId);
      
      if (!currentUserId || !projectId) {
        console.error("❌ Missing user ID or project ID");
        return;
      }
      
      try {
        // Test permission API directly
        const permissionUrl = `${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members/${currentUserId}/permissions`;
        console.log("🔗 Permission URL:", permissionUrl);
        
        const response = await axios.get(permissionUrl);
        console.log("✅ Permission API Response:", response.data);
        
        // Test role API 
        const roleUrl = `${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members/${currentUserId}/role`;
        console.log("🔗 Role URL:", roleUrl);
        
        const roleResponse = await axios.get(roleUrl);
        console.log("✅ Role API Response:", roleResponse.data);
        
        // Test if user can update any task
        const taskId = "a6de20e8-f6cb-4d76-ad28-e05df52b7362"; // The problem task
        const testUpdateUrl = `${API_CONFIG.TASKS_SERVICE}/api/tasks/${taskId}`;
        console.log("🔗 Test Task Update URL:", testUpdateUrl);
        
        try {
          // Just get the task first
          const taskResponse = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/get-by-id/${taskId}`, {
            headers: { "X-User-Id": currentUserId }
          });
          console.log("✅ Can access task:", taskResponse.data);
          
          const taskData = taskResponse.data.data;
          console.log("📋 Task details:", {
            id: taskData.id,
            title: taskData.title,
            createdBy: taskData.createdBy,
            assigneeId: taskData.assigneeId,
            projectId: taskData.projectId
          });
          
        } catch (taskError: any) {
          console.error("❌ Cannot access task:", taskError?.response?.data);
        }
        
      } catch (error: any) {
        console.error("❌ Permission/Role API Error:");
        console.error("Error:", error);
        console.error("Response:", error?.response?.data);
        console.error("Status:", error?.response?.status);
      }
    };
    
    console.log("💡 Run window.debugTaskPermissions() in console to debug!");
  }, [projectId]);

  return (
    <div className="flex h-screen bg-gray-50">
      <NavigationProgress />
      <Sidebar projectId={projectId || undefined} />
      <div className="flex-1 flex flex-col">
        <TopNavigation />
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">
                {project?.name || "Project"} Board
              </h1>
              <div className="text-sm text-gray-500">
                {latestSprintId && currentSprint ? (
                  <>
                    {(() => {
                      const sprintName = currentSprint.name || `Sprint #${latestSprintId.substring(0, 4)}`;
                      const status = currentSprint.status;
                      
                      // Get appropriate styling based on sprint status
                      const getSprintStatusStyle = () => {
                        switch (status) {
                          case "ACTIVE":
                            return {
                              textColor: "text-green-600",
                              bgColor: "bg-green-50",
                              borderColor: "border-green-200",
                              label: "Active Sprint"
                            };
                          case "NOT_STARTED":
                            return {
                              textColor: "text-blue-600", 
                              bgColor: "bg-blue-50",
                              borderColor: "border-blue-200",
                              label: "Ready to Start"
                            };
                          case "COMPLETED":
                            return {
                              textColor: "text-gray-600",
                              bgColor: "bg-gray-50", 
                              borderColor: "border-gray-200",
                              label: "Completed"
                            };
                          case "ARCHIVED":
                            return {
                              textColor: "text-purple-600",
                              bgColor: "bg-purple-50",
                              borderColor: "border-purple-200", 
                              label: "Archived"
                            };
                          default:
                            return {
                              textColor: "text-gray-600",
                              bgColor: "bg-gray-50",
                              borderColor: "border-gray-200",
                              label: "Sprint"
                            };
                        }
                      };
                      
                      const style = getSprintStatusStyle();
                      
                      return (
                        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border ${style.bgColor} ${style.borderColor}`}>
                          <span className="mr-2"></span>
                          <span className={`font-medium ${style.textColor}`}>
                            {style.label}: {sprintName}
                          </span>
                          {status === "ACTIVE" && (
                            <span className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <span className="flex items-center text-amber-600">
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    No active sprint found
                  </span>
                )}
              </div>
              
              {/* Project info and owner controls */}
              {project && (
                <div className="mt-2 flex items-center gap-4">
                  {/* Project type and access info */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">{project.projectType || 'Software'}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{project.access || 'Private'}</span>
                    {project.ownerName && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Owner: {project.ownerName}
                      </span>
                    )}
                  </div>
                  
                  {/* Show role for non-owners */}
                  {!permissionsLoading && userPermissions && !isOwner && (
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Role: {userPermissions.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              {/* ✅ NEW: Search Board Input */}
              <div className="relative mr-4" ref={searchRef}>
                <form onSubmit={handleSearchBoardSubmit} className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search other boards..."
                    value={searchBoardQuery}
                    onChange={handleSearchBoardChange}
                    onKeyDown={handleSearchBoardKeyDown}
                    className="pl-10 pr-4 h-9 w-64 bg-white border-gray-200 rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                  />
                  {isSearchingBoard && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </form>
                
                {/* Search Results Dropdown */}
                {showSearchBoardResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                    {isSearchingBoard ? (
                      <div className="p-4 text-center text-gray-500">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        Searching boards...
                      </div>
                    ) : searchBoardResults.length > 0 ? (
                      <div className="py-2">
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                          Found {searchBoardResults.length} board{searchBoardResults.length !== 1 ? 's' : ''}
                        </div>
                        {searchBoardResults.map((result, index) => (
                          <div
                            key={result.project.id}
                            onClick={() => handleSelectSearchBoard(result)}
                            className={`p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-150 ${
                              selectedBoardIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                    {result.project.name.substring(0, 2).toUpperCase()}
                    </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">{result.project.name}</h4>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs text-gray-500">{result.project.key} • {result.project.projectType || 'Software'}</p>
                                      {result.project.userRole && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                          result.project.userRole === 'Project Owner' ? 'bg-purple-100 text-purple-700' :
                                          result.project.userRole === 'Member & Owner' ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700' :
                                          'bg-blue-100 text-blue-700'
                                        }`}>
                                          {result.project.userRole}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Project Stats */}
                                <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    <span>{result.sprintCount} sprints</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{result.activeTaskCount} active</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{result.completedTaskCount} done</span>
                                  </div>
                                </div>
                                
                                {/* Active Sprint Info */}
                                {result.activeSprint ? (
                                  <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                      <span className="text-xs font-medium text-green-700">
                                        Active: {result.activeSprint.name}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                                    <span className="text-xs text-gray-600">No active sprint</span>
                    </div>
                  )}
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 ml-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : searchBoardQuery.trim().length > 2 ? (
                      <div className="p-4 text-center text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="font-medium text-sm">No boards found</p>
                        <p className="text-xs mt-1">No projects found matching "{searchBoardQuery}"</p>
                      </div>
                    ) : null}
                </div>
              )}
            </div>

              <Button 
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => window.location.href = `/project/backlog?projectId=${projectId}`}
              >
                View Backlog
              </Button>
              {project && currentSprint && currentSprint.status === "ACTIVE" && !permissionsLoading && (isOwner || userPermissions?.role === "PRODUCT_OWNER") && (
                <Button 
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to complete the current sprint "${currentSprint.name}"?`)) {
                      try {
                        const response = await axios.put(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${currentSprint.id}/complete`);
                        if (response.data?.status === "SUCCESS") {
                          toast.success("Sprint completed successfully!");
                          
                          // ✅ CLEANUP: Remove SPRINT_OVERDUE notifications when sprint is completed
                          try {
                            await axios.delete(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/sprint/${currentSprint.id}/overdue`);
                            console.log("✅ SPRINT_OVERDUE notifications cleaned up for completed sprint:", currentSprint.id);
                          } catch (cleanupError) {
                            console.log("📝 Failed to cleanup SPRINT_OVERDUE notifications (non-critical):", cleanupError);
                          }
                          
                          // Refresh sprint data
                          fetchLatestNonCompletedSprint();
                        } else {
                          toast.error("Failed to complete sprint");
                        }
                      } catch (error) {
                        console.error("Error completing sprint:", error);
                        toast.error("Failed to complete sprint");
                      }
                    }
                  }}
                >
                  Complete Sprint
                </Button>
              )}
              
              <div className="flex items-center gap-2">
                {/* ✅ NEW: Filter Toggle Button */}
                <Button 
                  variant="outline" 
                  size="icon" 
                  className={`h-9 w-9 border-gray-200 ${showFilters ? 'bg-blue-50 text-blue-600' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                  title="Toggle Filters"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {!projectId ? (
            // Check if user has any projects to determine which UI to show
            loadingProjects ? (
              // Show loading while checking user's projects
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="text-gray-600 text-lg">Loading your projects...</span>
                </div>
              </div>
            ) : userProjects.length === 0 ? (
              // NEW USER UI: Enhanced welcome message for users with no projects
              <div className="flex items-center justify-center min-h-[70vh] p-4">
                <div className="text-center max-w-2xl p-12 bg-white rounded-2xl shadow-lg border border-gray-100">
                  {/* Welcome Icon */}
                  <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full text-white shadow-lg">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 21L9.09 15.26L15 14L9.09 13.74L8 8L6.91 13.74L1 14L6.91 15.26L8 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  
                  {/* Welcome Message */}
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to TaskFlow! 🎉</h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    You're new here! Start your journey by creating your first project or join an existing team.
                  </p>
                  
                  {/* Features Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-sm">
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-blue-500 text-white rounded-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Manage Tasks</h4>
                      <p className="text-gray-600">Organize your work with Kanban boards and sprints</p>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                      <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-green-500 text-white rounded-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Team Collaboration</h4>
                      <p className="text-gray-600">Work together with real-time updates and notifications</p>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-purple-500 text-white rounded-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Track Progress</h4>
                      <p className="text-gray-600">Monitor project progress with detailed analytics</p>
                    </div>
                  </div>
                  
                  {/* ✅ NEW: Search Board Section */}
                  <div className="mb-10">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="h-px bg-gray-300 flex-1"></div>
                      <h3 className="text-lg font-semibold text-gray-800 bg-amber-100 text-amber-700 px-4 py-2 rounded-full">
                        🔍 Search for Existing Projects
                      </h3>
                      <div className="h-px bg-gray-300 flex-1"></div>
                    </div>
                    
                    <div className="relative max-w-lg mx-auto">
                      <form onSubmit={handleSearchBoardSubmit} className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search for project boards..."
                          value={searchBoardQuery}
                          onChange={handleSearchBoardChange}
                          onKeyDown={handleSearchBoardKeyDown}
                          className="pl-12 h-12 bg-gray-50 border-gray-200 rounded-xl placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm font-medium shadow-sm"
                        />
                        {isSearchingBoard && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                      </form>
                      
                      {/* Search Results Dropdown */}
                      {showSearchBoardResults && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                          {isSearchingBoard ? (
                            <div className="p-4 text-center text-gray-500">
                              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                              Searching boards...
                            </div>
                          ) : searchBoardResults.length > 0 ? (
                            <div className="py-2">
                              <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                                Found {searchBoardResults.length} project{searchBoardResults.length !== 1 ? 's' : ''}
                              </div>
                              {searchBoardResults.map((result, index) => (
                                <div
                                  key={result.project.id}
                                  onClick={() => handleSelectSearchBoard(result)}
                                  className={`p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-150 ${
                                    selectedBoardIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                          {result.project.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <h4 className="font-semibold text-gray-900">{result.project.name}</h4>
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-gray-500">{result.project.key} • {result.project.projectType || 'Software'}</p>
                                            {result.project.userRole && (
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                result.project.userRole === 'Project Owner' ? 'bg-purple-100 text-purple-700' :
                                                result.project.userRole === 'Member & Owner' ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700' :
                                                'bg-blue-100 text-blue-700'
                                              }`}>
                                                {result.project.userRole}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Project Stats */}
                                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                                        <div className="flex items-center gap-1">
                                          <Target className="w-3 h-3" />
                                          <span>{result.sprintCount} sprints</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          <span>{result.activeTaskCount} active</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Users className="w-3 h-3" />
                                          <span>{result.completedTaskCount} done</span>
                                        </div>
                                      </div>
                                      
                                      {/* Active Sprint Info */}
                                      {result.activeSprint ? (
                                        <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                          <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                            <span className="text-xs font-medium text-green-700">
                                              Active: {result.activeSprint.name}
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                                          <span className="text-xs text-gray-600">No active sprint</span>
                                        </div>
                                      )}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-400 ml-2" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : searchBoardQuery.trim().length > 2 ? (
                            <div className="p-6 text-center text-gray-500">
                              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                              <p className="font-medium">No projects found</p>
                              <p className="text-sm mt-1">No projects found matching "{searchBoardQuery}"</p>
                              <p className="text-xs mt-2 text-gray-400">Try a different search term or ask a team member to invite you</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      Can't find the project you're looking for? Ask a team member to invite you.
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 px-8 py-3 text-base font-semibold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                      onClick={() => router.push('/project/create_project')}
                    >
                      <svg width="20" height="20" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 6V18M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Create Your Project
                    </Button>
                    <Button 
                      variant="outline"
                      className="px-8 py-3 text-base font-semibold border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all duration-200"
                      onClick={() => router.push('/project/view_all_projects')}
                    >
                      <svg width="20" height="20" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 16V8C20.9996 7.64927 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64927 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 4.21L12 6.81L16.5 4.21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 19.79V14.6L3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12L16.5 14.6V19.79" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 22.81V6.81" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Browse Public Projects
                    </Button>
                  </div>
                  
                  {/* Help Text */}
                  <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <svg width="16" height="16" className="inline mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <strong>Need help?</strong> Ask a team member to invite you to their project, or start by creating your own project.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // EXISTING USER UI: Enhanced project selection for users with projects
              <div className="flex items-center justify-center min-h-[70vh] p-4">
                <div className="text-center max-w-4xl p-10 bg-white rounded-2xl shadow-lg border border-gray-100">
                  {/* Header */}
                  <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600 rounded-full text-white shadow-lg">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Select a Project</h2>
                  <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                    You have <span className="font-semibold text-blue-600">{userProjects.length}</span> project{userProjects.length !== 1 ? 's' : ''} available. Choose one to continue working.
                  </p>
                  
                  {/* Recent Projects Section */}
                  {isMounted && (() => {
                    const recentProjects = getRecentProjects();
                    return recentProjects.length > 0 ? (
                      <div className="mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <div className="h-px bg-gray-300 flex-1"></div>
                          <h3 className="text-sm font-semibold text-gray-700 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                            📈 Recent Projects
                          </h3>
                          <div className="h-px bg-gray-300 flex-1"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          {recentProjects.slice(0, 3).map((proj) => (
                            <div
                              key={proj.id}
                              className="p-4 border-2 border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer rounded-xl transition-all duration-200 transform hover:scale-105 hover:shadow-md"
                              onClick={() => router.push(`/project/project_homescreen?projectId=${proj.id}`)}
                            >
                              <div className="flex items-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-sm shadow-md">
                                  {proj.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left flex-1">
                                  <div className="font-semibold text-gray-900 mb-1">{proj.name}</div>
                                  <div className="text-xs text-green-700 font-medium">{proj.projectType || 'Software'}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <Button 
                          className="bg-green-600 text-white hover:bg-green-700 px-6 py-3 text-sm font-semibold rounded-lg shadow-md transform hover:scale-105 transition-all duration-200 mb-6"
                          onClick={() => redirectToMostRecentProject()}
                        >
                          <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Quick Access: Most Recent
                        </Button>
                      </div>
                    ) : null;
                  })()}
                  
                  {/* All Projects Section */}
                  <div className="mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="h-px bg-gray-300 flex-1"></div>
                      <h3 className="text-sm font-semibold text-gray-700 bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                        📁 All Your Projects ({userProjects.length})
                      </h3>
                      <div className="h-px bg-gray-300 flex-1"></div>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto bg-gray-50 border-2 border-gray-200 rounded-xl">
                        {userProjects.map((proj, index) => {
                          const recentProjects = isMounted ? getRecentProjects() : [];
                          const isRecent = recentProjects.some(r => r.id === proj.id);
                          return (
                            <div
                              key={proj.id}
                            className={`p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-200 last:border-b-0 transition-all duration-150 ${
                              index === 0 ? 'rounded-t-xl' : ''
                            } ${
                              index === userProjects.length - 1 ? 'rounded-b-xl' : ''
                            }`}
                              onClick={() => router.push(`/project/project_homescreen?projectId=${proj.id}`)}
                            >
                              <div className="flex items-center">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold mr-4 text-sm shadow-md">
                                  {proj.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="font-semibold text-gray-900">{proj.name}</div>
                                    {isRecent && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                                      🕒 Recent
                                      </span>
                                    )}
                                  </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="bg-gray-200 px-2 py-1 rounded">{proj.projectType || 'Software'}</span>
                                  <span className="bg-gray-200 px-2 py-1 rounded">{proj.access || 'Private'}</span>
                                  {proj.ownerName && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                      👑 {proj.ownerName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-gray-400">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button 
                      className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 text-sm font-semibold rounded-lg shadow-md transform hover:scale-105 transition-all duration-200"
                      onClick={() => {
                        window.location.href = '/project/view_all_projects';
                      }}
                    >
                      <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 16V8C20.9996 7.64927 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64927 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 4.21L12 6.81L16.5 4.21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.5 19.79V14.6L3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12L16.5 14.6V19.79" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 22.81V6.81" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Browse All Projects
                    </Button>
                    <Button 
                      variant="outline"
                      className="px-6 py-3 text-sm font-semibold border-2 border-gray-300 hover:border-green-400 hover:bg-green-50 rounded-lg transition-all duration-200"
                      onClick={() => router.push('/project/create_project')}
                    >
                      <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 6V18M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Create New Project
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : !project ? (
            // Loading state when no project
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-600">Loading project...</span>
              </div>
            </div>
          ) : (
            <>
              {/* ✅ NEW: Task Filter Panel */}
              {showFilters && (
                <div className="mb-6">
                  <TaskFilterPanel
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onToggleArrayFilter={handleToggleArrayFilter}
                    onClearAllFilters={handleClearAllFilters}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                    availableLabels={availableLabels}
                    projectUsers={projectUsers}
                    totalTasks={tasks.length}
                    filteredTasks={filteredTasks.length}
                    AvatarComponent={AvatarDisplay}
                  />
                </div>
              )}
              
              <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex flex-wrap gap-4">
                {renderColumn("To Do", "TODO")}
                {renderColumn("In Progress", "IN_PROGRESS")}
                {renderColumn("Review", "REVIEW")}
                {renderColumn("Done", "DONE")}
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                  {activeTask && (
                    <div className="bg-white rounded-sm p-3 shadow-lg border border-gray-200 opacity-90">
                      <div className="text-sm font-medium mb-4">{activeTask.title}</div>
                      <div className="flex justify-between items-center text-xs text-gray-700">
                        <div className="flex items-center gap-1">
                          <span className="w-4 h-4 border border-blue-600 bg-white rounded-sm flex items-center justify-center text-blue-600 text-[10px]">
                            ✔
                          </span>
                          <span className="font-semibold">{activeTask.shortKey || "T-000"}</span>
                        </div>
                      </div>
              </div>
                  )}
                </DragOverlay>

                {/* API Loading indicator */}
                {apiLoading && (
                  <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                      <span>Updating task...</span>
                    </div>
                  </div>
                )}
              </DndContext>
            </>
          )}
        </div>
      </div>
      
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask as TaskData}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          sprints={sprints}
          onOpenSubtask={(subtask) => {
            // Close current modal and open subtask detail
            setSelectedTask(subtask as Task);
          }}
          onBackToParent={async (parentTaskId) => {
            // Fetch parent task and open its detail modal
            try {
              console.log("Navigating back to parent task:", parentTaskId);
              
              // Find parent task from existing tasks first
              const parentTask = tasks.find(task => task.id === parentTaskId);
              
              if (parentTask) {
                // If found in current tasks, just open it
                setSelectedTask(parentTask);
              } else {
                // If not found, fetch from API
                const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${parentTaskId}`);
                if (response.data?.status === "SUCCESS") {
                  setSelectedTask(response.data.data as Task);
                } else {
                  console.error("Failed to fetch parent task");
                  toast.error("Could not load parent task");
                }
              }
            } catch (error) {
              console.error("Error navigating to parent task:", error);
              toast.error("Failed to navigate to parent task");
            }
          }}
        />
      )}

      {/* Loading indicator for task from URL */}
      {loadingTaskFromUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchParams?.get("from") === "notification" ? "Opening Notification" : "Opening Task"}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchParams?.get("from") === "notification"
                ? "Loading task from notification..." 
                : "Loading task details..."
              }
            </p>
            {urlTaskId && (
              <p className="text-gray-400 text-xs mt-2">
                Task ID: {urlTaskId}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
