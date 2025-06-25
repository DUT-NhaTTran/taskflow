import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/drop-down";
import axios from "axios";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useUser } from "@/contexts/UserContext";
import { 
  getUserPermissions, 
  canEditTask, 
  canDeleteTaskAsUser, 
  canCreateTask,
  UserPermissions 
} from "@/utils/permissions";
import { useUserStorage } from "@/hooks/useUserStorage";
import { useNavigation } from "@/contexts/NavigationContext";
import { API_CONFIG } from "@/lib/config";
import AIEstimationModal from "./AIEstimationModal";

// Import TipTap editor component dynamically to avoid SSR issues
const TiptapEditor = dynamic(() => import("@/components/ui/tiptap-editor"), {
  ssr: false,
  loading: () => (
    <div className="border rounded p-3 min-h-[250px] bg-gray-50">
      Loading editor...
    </div>
  ),
});

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  storyPoint?: number;
  assigneeId?: string | null;
  assigneeName?: string;
  shortKey?: string;
  projectId?: string;
  projectName?: string; // Add projectName field for notifications
  sprintId?: string;
  dueDate?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  parentTaskId?: string | null;
  tags?: string[] | null;
  labels?: string[];
  label?: string;
  priority?: "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST" | "BLOCKER" | "BLOCK"; 
  attachments?: Array<string | Attachment>;
  webLinks?: WebLink[];
  linkedWorkItems?: LinkedWorkItem[];
  createdBy?: string; // Add createdBy field for notifications
}

// Define the Attachment interface to match the database structure
interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_at?: string;
}

export interface SprintOption {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  name?: string; // ✅ Add optional name field
  email: string;
  role?: string;
  avatar?: string;
}

interface WebLink {
  id: string;
  url: string;
  description: string;
  createdAt: string;
}

interface LinkedWorkItem {
  id: string;
  linkType: string;
  targetTask: {
    id: string;
    shortKey: string;
    title: string;
    status: string;
  };
  sourceTaskId: string;
  createdAt: string;
}

interface TaskDetailModalProps {
  task: TaskData;
  onClose: () => void;
  onUpdate: (updatedTask: TaskData) => void;
  sprints?: SprintOption[];
  onOpenSubtask?: (subtask: TaskData) => void; // New prop to handle opening subtask detail
  onBackToParent?: (parentTaskId: string) => void; // New prop to handle back to parent
}

export default function TaskDetailModal({
  task,
  onClose,
  onUpdate,
  sprints = [],
  onOpenSubtask,
  onBackToParent,
}: TaskDetailModalProps) {
  // Use UserContext for global user management
  const { currentUser, isLoading: userContextLoading, users: cachedUsers, getUserById, fetchUserById } = useUser();
  
  // User and navigation contexts  
  const { userData } = useUserStorage();
  const { currentProjectId } = useNavigation();

  // Permission state
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // ✅ NEW: Simple permission check function
  const canEditCurrentTask = () => {
    if (!currentUser?.id) return false;
    
    // Task creator can edit
    if (task.createdBy === currentUser.id) return true;
    
    // Task assignee can edit  
    if (task.assigneeId === currentUser.id) return true;
    
    // Admin users can edit (using existing permission system)
    if (userPermissions?.canManageAnyTask || userPermissions?.isOwner) return true;
    
    return false;
  };

  const isReadOnly = !canEditCurrentTask();

  // State for editing the task
  const [editedTask, setEditedTask] = useState<TaskData>({ ...task });

  // Update local state when task prop changes
  useEffect(() => {
    const enhanceTaskAndSetState = async () => {
      // ✅ Enhance task with assignee name if needed
      let enhancedTask = { ...task };
      
      // If task has assigneeId but no assigneeName, enhance it
      if (task.assigneeId && !task.assigneeName) {
        try {
          const { enhanceTaskWithAssigneeName } = await import('@/utils/taskHelpers');
          enhancedTask = await enhanceTaskWithAssigneeName(task);
          console.log(`✅ TaskDetailModal: Enhanced task "${task.title}" with assignee name:`, enhancedTask.assigneeName);
        } catch (enhanceError) {
          console.warn('Failed to enhance task with assignee name:', enhanceError);
        }
      }
      
      setEditedTask(enhancedTask);
      
      // Only fetch data if task has a valid ID (not temporary or missing)
      // Relaxed validation - only block obvious temporary/invalid tasks
      if (task?.id && 
          !task.id.startsWith('temp-') && 
          !task.id.includes('undefined') &&
          task.id !== 'new' &&
          task.id !== '' &&
          task.id.length > 5) {  // Relaxed from 10 to 5 characters
        
        console.log('✅ MODAL: Fetching data for valid task ID:', task.id);
        
        // Add small delay to ensure task is fully created in backend
        setTimeout(() => {
          fetchAttachments(task.id);
          fetchChildWorkItems(task.id);
          fetchWebLinks(task.id);
          fetchLinkedWorkItems(task.id);
          fetchComments(task.id);
        }, 500);
      } else {
        
        // Clear related data for temporary tasks
        updateField("attachments", []);
        setChildWorkItems([]);
        setWebLinks([]);
        setLinkedWorkItems([]);
        setComments([]);
      }
    };
    
    enhanceTaskAndSetState();
  }, [task]);

  // Fetch user permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.account?.id && task?.projectId) {
        setPermissionsLoading(true);
        try {
          const permissions = await getUserPermissions(userData.account.id, task.projectId);
          
          setUserPermissions(permissions);
        } catch (error) {
          console.error('Error fetching permissions:', error);
          setUserPermissions(null);
        } finally {
          setPermissionsLoading(false);
        }
      } else {
        setPermissionsLoading(false);
      }
    };

    fetchPermissions();
  }, [userData?.account?.id, task?.projectId, task?.createdBy, task?.assigneeId]);

  // State for saving/loading
  const [isSaving, setIsSaving] = useState(false);
  // State for edit mode - default to false (read-only)
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // State for comment
  const [comment, setComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isAddingReply, setIsAddingReply] = useState(false);

  // State for users in the project with caching (separate from UserContext)
  const [projectUsers, setProjectUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersCache, setUsersCache] = useState<{ [key: string]: User[] }>({});

  // ✅ State for AI Estimation
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimationResult, setEstimationResult] = useState<{
    estimated_story_points: number;
    confidence: number;
    reasoning: string;
    features_used?: any;
  } | null>(null);
  const [showAIEstimationModal, setShowAIEstimationModal] = useState(false);

  // State for UI interaction
  const [activeTab, setActiveTab] = useState<
    "all" | "comments" | "history" | "worklog"
  >("comments");
  const [isWatchingTask, setIsWatchingTask] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ✅ State for delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState("");

  // State for Add dropdown
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [showWebLinkForm, setShowWebLinkForm] = useState(false);
  const [showLinkedWorkItemForm, setShowLinkedWorkItemForm] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [webLinkUrl, setWebLinkUrl] = useState("");
  const [webLinkDescription, setWebLinkDescription] = useState("");
  const [linkedWorkItemSearch, setLinkedWorkItemSearch] = useState("");
  const [linkedWorkItemType, setLinkedWorkItemType] = useState("is blocked by");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State for displaying added items
  const [childWorkItems, setChildWorkItems] = useState<any[]>([]);
  const [linkedWorkItems, setLinkedWorkItems] = useState<any[]>([]);
  const [webLinks, setWebLinks] = useState<any[]>([]);

  // Comment interface to match backend
  interface CommentData {
    id: number;
    taskId: string; // This will contain UUID as string from backend
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    parentCommentId?: number;
    isDeleted: boolean;
    replies?: CommentData[];
  }

  // Update task field
  const updateField = (field: keyof TaskData, value: any) => {
    setEditedTask((prev) => ({ ...prev, [field]: value }));
  };

  // Extract and save attachments from description content to attachments table
  const extractAndSaveAttachmentsFromDescription = async (
    htmlContent: string
  ): Promise<void> => {
    if (!htmlContent || !editedTask.id) return;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    // Extract images
    const images = tempDiv.querySelectorAll("img");
    const imagePromises: Promise<any>[] = [];

    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (src && (src.startsWith("/uploads/") || src.startsWith("http"))) {
        // For images that are already uploaded files, create attachment record
        const fileName = src.split("/").pop() || "image";
        const fileType = fileName.split(".").pop()?.toLowerCase() || "jpeg";

        const attachmentData = {
          taskId: editedTask.id,
          fileName: fileName,
          fileUrl: src,
          fileType: `image/${fileType}`,
        };

        // Save to attachments table
        const promise = axios
          .post(`${API_CONFIG.FILE_SERVICE}/api/attachments/create`, attachmentData)
          .then((response) => {
            if (response.data?.status === "SUCCESS") {
             
              return response.data.data;
            }
          })
          .catch((error) => {
            console.error("Error saving image to attachments table:", error);
          });

        imagePromises.push(promise);
      }
    });

    // Extract file links
    const fileLinks = tempDiv.querySelectorAll(
      'a[href*="/uploads/"], a.file-link'
    );
    const fileLinkPromises: Promise<any>[] = [];

    fileLinks.forEach((link) => {
      const href = link.getAttribute("href");
      const fileName =
        link.textContent?.replace(/^[📊📝📄📎]\s*/, "") || "file"; // Remove emoji icons

      if (href && href.startsWith("/uploads/")) {
        const fileType = fileName.split(".").pop()?.toLowerCase() || "unknown";

        const attachmentData = {
          taskId: editedTask.id,
          fileName: fileName,
          fileUrl: href,
          fileType: fileType,
        };

        // Save to attachments table
        const promise = axios
          .post(`${API_CONFIG.FILE_SERVICE}/api/attachments/create`, attachmentData)
          .then((response) => {
            if (response.data?.status === "SUCCESS") {
             
              return response.data.data;
            }
          })
          .catch((error) => {
            console.error("Error saving file to attachments table:", error);
          });

        fileLinkPromises.push(promise);
      }
    });

    // Wait for all attachments to be saved
    const allPromises = [...imagePromises, ...fileLinkPromises];
    if (allPromises.length > 0) {
      try {
        const savedAttachments = await Promise.all(allPromises);
        const validAttachments = savedAttachments.filter(Boolean);

        if (validAttachments.length > 0) {
          // Update local UI state with the saved attachments
          const currentAttachments = editedTask.attachments || [];
          const updatedAttachments = [
            ...currentAttachments,
            ...validAttachments,
          ];
          updateField("attachments", updatedAttachments);

          toast.success(
            `Moved ${validAttachments.length} file(s) to attachments table`,
            {
              duration: 3000,
            }
          );

       
        }
      } catch (error) {
        console.error("Error saving attachments:", error);
        toast.error("Some files could not be moved to attachments table");
      }
    }
  };

  // Fetch users by project ID with caching
  useEffect(() => {
    const fetchUsers = async () => {
      if (!editedTask.projectId) {
        return;
      }

      const projectIdKey = String(editedTask.projectId);

      // Check cache first
      if (usersCache[projectIdKey]) {
        setProjectUsers(usersCache[projectIdKey]);
        return;
      }

      try {
        setLoadingUsers(true);

        const response = await axios.get(
          `${API_CONFIG.USER_SERVICE}/api/users/project/${projectIdKey}`
        );

        if (response.data?.status === "SUCCESS") {
          const fetchedUsers = response.data.data || [];

          // Update cache and state
          setUsersCache((prev) => ({
            ...prev,
            [projectIdKey]: fetchedUsers,
          }));
          setProjectUsers(fetchedUsers);
        } else {
          console.error("Failed to fetch users:", response.data);
          toast.error("Could not load project users");
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load project users");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [editedTask.projectId]);

  // Combine project users and cached users for display
  const allUsers = [...projectUsers, ...cachedUsers].filter((user, index, self) => 
    index === self.findIndex(u => u.id === user.id)
  );

  // Fetch current user from localStorage with caching
  const [currentUserCache, setCurrentUserCache] = useState<{
    [key: string]: User;
  }>({});

  // Toggle description edit mode
  const toggleDescriptionEditMode = () => {
    // If we're currently editing and switching to view mode, save the changes
    if (isEditingDescription) {
      saveChanges();
    }
    setIsEditingDescription(!isEditingDescription);
  };

  // Handle file upload for attachments with retry logic
  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    // File size limits - increased as requested
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
    const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total
    const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB threshold for "large" files

    // Check individual file sizes and total size
    let totalSize = 0;
    const oversizedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalSize += file.size;
      
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(`${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
      }
    }

    // Show warning for oversized files (use warning instead of error)
    if (oversizedFiles.length > 0) {
      toast.warning(`⚠️ Some files exceed the 20MB limit: ${oversizedFiles.join(', ')}. Please compress or choose smaller files.`, {
        duration: 8000
      });
      return;
    }

    // Check total size (use warning instead of error)
    if (totalSize > MAX_TOTAL_SIZE) {
      toast.warning(`⚠️ Total file size exceeds 200MB limit. Current: ${Math.round(totalSize / 1024 / 1024)}MB. Please select fewer or smaller files.`, {
        duration: 8000
      });
      return;
    }

    toast.loading("Uploading files to attachments table...", {
      id: "file-upload",
    });

    try {
      // Array to store uploaded files
      const uploadedAttachments = [];
      let successCount = 0;
      let failCount = 0;

      // Process each file - files will be saved to attachments table via File-Service
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSizeMB = Math.round(file.size / 1024 / 1024);
        const isLargeFile = file.size > LARGE_FILE_THRESHOLD;

        // Show individual file progress
        toast.loading(`Uploading ${file.name} (${fileSizeMB}MB)${isLargeFile ? ' - Large file, please wait...' : ''}`, {
          id: "file-upload",
        });

        // Create FormData to send the file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("taskId", editedTask.id);

        try {
          // Upload the file to the dedicated File Service with enhanced timeout and retry logic
          const response = await axios.post(
            `${API_CONFIG.FILE_SERVICE}/api/attachments/upload`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              timeout: 600000, // Increased to 10 minutes timeout for large files
              maxContentLength: 100 * 1024 * 1024, // 100MB max content length
              maxBodyLength: 100 * 1024 * 1024, // 100MB max body length
              onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                  const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                  const uploadedMB = Math.round(progressEvent.loaded / 1024 / 1024);
                  const totalMB = Math.round(progressEvent.total / 1024 / 1024);
                  
                  // Update loading toast with detailed progress
                  toast.loading(`Uploading ${file.name}: ${percentCompleted}% (${uploadedMB}/${totalMB}MB)`, {
                    id: "file-upload",
                  });
                }
              }
            }
          );

          if (response.data?.status === "SUCCESS" && response.data.data) {
            // Add the attachment object returned from the server (from attachments table)
            uploadedAttachments.push(response.data.data);
            successCount++;
            
            toast.loading(`✅ ${file.name} uploaded. Processing ${i + 1}/${files.length} files...`, {
              id: "file-upload",
            });
          } else {
            console.error(
              "Failed to upload file to attachments table:",
              file.name,
              response.data
            );
            failCount++;
            toast.error(`Failed to upload ${file.name}: Server error`, { duration: 5000 });
          }
        } catch (uploadError: any) {
          console.error(
            "Error uploading file to attachments table:",
            uploadError
          );
          failCount++;
          
          // Handle specific error types with better messaging
          if (axios.isAxiosError(uploadError)) {
            if (uploadError.code === 'ECONNABORTED') {
              toast.error(`Upload timeout for ${file.name}. File too large or connection too slow. Try a smaller file.`, { duration: 8000 });
            } else if (uploadError.message === 'Network Error') {
              toast.error(`Network error uploading ${file.name}. This usually means:\n• File is too large for your connection\n• Server is not responding\n• Try splitting into smaller files`, { duration: 10000 });
            } else if (uploadError.response?.status === 413) {
              toast.warning(`⚠️ File ${file.name} exceeds server upload limit. Please compress or split the file.`, { duration: 8000 });
            } else if (uploadError.response?.status === 400) {
              toast.warning(`⚠️ Invalid file: ${file.name}. Please check file format and try again.`, { duration: 5000 });
            } else if (uploadError.response?.status === 502 || uploadError.response?.status === 504) {
              toast.error(`Server timeout for ${file.name}. File may be too large. Try a smaller file.`, { duration: 8000 });
            } else if (uploadError.response?.status && uploadError.response.status >= 500) {
              toast.error(`Server error uploading ${file.name}. Please try again later.`, { duration: 5000 });
            } else {
              toast.error(`Upload failed for ${file.name}: ${uploadError.response?.status || 'Connection error'}`, { duration: 5000 });
            }
          } else {
            toast.error(`Unexpected error uploading ${file.name}`, { duration: 5000 });
          }
        }
      }

      if (uploadedAttachments.length > 0) {
        // Add new attachments to the local task state (for UI display)
        // Note: These are NOT saved to task table, only displayed locally
        const currentAttachments = editedTask.attachments || [];
        const updatedAttachments = [
          ...currentAttachments,
          ...uploadedAttachments,
        ];

        // Update local state for UI display
        updateField("attachments", updatedAttachments);

        // Count different file types for the success message
        const imageCount = uploadedAttachments.filter((att) => {
          const fileType = att.fileType || att.file_type || "";
          return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(
            fileType.toLowerCase()
          );
        }).length;
        const otherCount = uploadedAttachments.length - imageCount;

        // Display success message
        toast.success(
          `✅ Uploaded ${successCount} file(s) successfully: ${imageCount} image(s), ${otherCount} document(s)${failCount > 0 ? `. ${failCount} failed - try smaller files.` : ''}`,
          {
            id: "file-upload",
            duration: 6000,
          }
        );

        // Scroll to the attachments section
        setTimeout(() => {
          const attachmentsSection = document.querySelector(
            ".task-attachments-section"
          );
          if (attachmentsSection) {
            attachmentsSection.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);

       
      } else {
        toast.error(
          failCount > 0 
            ? `❌ All ${failCount} file(s) failed to upload. Try:\n• Smaller files (under 20MB)\n• Better internet connection\n• Compress large documents`
            : "No files were uploaded successfully", 
          {
            id: "file-upload",
            duration: 10000,
          }
        );
      }
    } catch (error: any) {
      console.error("Error processing files for attachments table:", error);
      
      // Handle general errors with actionable advice
      if (axios.isAxiosError(error) && error.message === 'Network Error') {
        toast.error(`❌ Network connection lost. Please:\n• Check your internet connection\n• Try smaller files (under 15MB)\n• Upload one file at a time\n• Contact support if issue persists`, { 
          id: "file-upload",
          duration: 12000 
        });
      } else {
        toast.error("❌ Upload failed. Please try again with smaller files or check your connection.", { 
          id: "file-upload",
          duration: 8000 
        });
      }
    }
  };

  // Handle attachment upload from TiptapEditor (already saved to attachments table)
  const handleTiptapAttachmentUpload = (newAttachments: any[]) => {
    // These attachments were already uploaded to attachments table by TiptapEditor
    // We just need to update the local UI state to display them
    const currentAttachments = editedTask.attachments || [];

    // Filter out duplicates based on attachment ID
    const uniqueNewAttachments = newAttachments.filter(
      (newAtt) =>
        !currentAttachments.some(
          (currentAtt) =>
            typeof currentAtt === "object" && currentAtt.id === newAtt.id
        )
    );

    if (uniqueNewAttachments.length > 0) {
      const updatedAttachments = [
        ...currentAttachments,
        ...uniqueNewAttachments,
      ];

     

      // Update local UI state only (attachments already in database)
      updateField("attachments", updatedAttachments);

      // Show notification about new attachments
      toast.success(
        `Added ${uniqueNewAttachments.length} attachment(s) to UI (already in database)`,
        {
          duration: 3000,
        }
      );

     
    }
  };

  // Save changes to task
  const saveChanges = async () => {
    try {
      setIsSaving(true);

      // Step 1: Extract and save attachments from description to attachments table
      if (editedTask.description) {
        await extractAndSaveAttachmentsFromDescription(editedTask.description);
      }

      // Step 2: Extract only text content from description (remove images and file links)
      const textOnlyDescription = extractTextFromHtml(
        editedTask.description || ""
      );

      // Create task object WITHOUT attachments (attachments are stored separately in attachments table)
      // Ensure all essential fields are preserved, especially projectId
      const taskToSave = {
        ...editedTask,
        description: textOnlyDescription, // Save only text content to description field
        projectId: editedTask.projectId || task.projectId, // Ensure projectId is not lost
        sprintId: editedTask.sprintId || task.sprintId, // Ensure sprintId is not lost
        id: editedTask.id || task.id, // Ensure id is not lost
      };
      delete taskToSave.attachments; // Remove attachments from task object

      // Validate essential fields before sending
      if (!taskToSave.projectId) {
        console.error("Missing projectId in task object:", taskToSave);
        toast.error("Error: Missing project ID");
        return;
      }
      // Step 3: Check if assignee changed for notification
      const originalAssigneeId = task.assigneeId;
      const newAssigneeId = editedTask.assigneeId;
      const assigneeChanged = originalAssigneeId !== newAssigneeId;

      // Step 3.1: Check if status changed for notification
      const originalStatus = task.status;
      const newStatus = editedTask.status;
      const statusChanged = originalStatus !== newStatus;

      

      // Step 4: Save task with text-only description to Tasks-Service
      const response = await axios.put(
        `${API_CONFIG.TASKS_SERVICE}/api/tasks/${taskToSave.id}`,
        taskToSave,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser?.id && { 'X-User-Id': currentUser.id }), // Send user ID in header for notifications
          },
        }
      );

      if (response.data?.status === "SUCCESS") {
        toast.success(
          "Task updated successfully - images preserved in description, files moved to attachments"
        );

        // Update the task in the UI with the updated data (but keep attachments in local state)
        const updatedTaskWithAttachments = {
          ...taskToSave,
          attachments: editedTask.attachments,
          description: textOnlyDescription, // Update local state with clean description
        };
        onUpdate(updatedTaskWithAttachments);

        // Step 5: Send notification if assignee changed
        if (assigneeChanged && newAssigneeId && newAssigneeId.trim() !== "") {

          
          try {
            const currentUserId = currentUser?.id;
            
            if (!currentUserId) {
              
              return; // Skip notification if no logged-in user
            }
            
                        let currentUserName = "Unknown User";
            let currentUserAvatar = null;
            
            try {
              
              const userApiResponse = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${currentUserId}/username`, {
                timeout: 5000
              });


              if (userApiResponse.data?.status === "SUCCESS" && userApiResponse.data?.data) {
                currentUserName = userApiResponse.data.data;
              } else {
                console.warn(`⚠️ FRONTEND: User Service API returned invalid response:`, userApiResponse.data);
              }
              
              // Try to get avatar from current user context
              if (currentUser?.avatar) {
                currentUserAvatar = currentUser.avatar;
              }
              
            } catch (error) {
              // Không có fallback - giữ nguyên "Unknown User"
            }

          

            if (!currentUserName || currentUserName.trim() === '' || currentUserName === "null" || currentUserName === "undefined") {
              currentUserName = `User-${currentUserId.substring(0, 8)}`;
            }

            const assignedUser = allUsers.find(u => u.id === newAssigneeId);
            const assignedUserName = assignedUser?.username || editedTask.assigneeName || "Unknown User";

            // Skip notification if assigning to self
            if (currentUserId && currentUserId === newAssigneeId) {

            } else {
              
              // Determine if this is a reassignment or new assignment
              const isReassignment = originalAssigneeId && originalAssigneeId.trim() !== "";
              
              // Create notification data with full information
              const notificationData = {
                type: isReassignment ? "TASK_REASSIGNED" : "TASK_ASSIGNED",
                title: isReassignment ? "Task reassigned" : "Task assigned",
                message: `${currentUserName} ${isReassignment ? 'reassigned' : 'assigned'} you to task "${editedTask.title}"`,
                recipientUserId: newAssigneeId,
                actorUserId: currentUserId,
                actorUserName: currentUserName,
                actorUserAvatar: currentUserAvatar,
                projectId: editedTask.projectId,
                projectName: "TaskFlow Project", // Default project name, you can enhance this by fetching actual project data
                taskId: editedTask.id,
                sprintId: editedTask.sprintId || null,
                actionUrl: `/project/project_homescreen?projectId=${editedTask.projectId}&taskId=${editedTask.id}`
              };

             
              // Send notification to notification service
              const notificationResponse = await axios.post(
                `${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`,
                notificationData
              );

              // ✅ UPDATED: Check correct response format from backend for assignee change
              if (notificationResponse.status === 200 || notificationResponse.status === 201) {
                const responseData = notificationResponse.data;
                
                if (responseData?.success && responseData?.data) {
                  // Notification created successfully and saved to database
                  const notification = responseData.data;
                
                  toast.success(
                    `Notification sent to ${assignedUserName} about ${isReassignment ? 'task reassignment' : 'new task assignment'}`
                  );
                } else if (responseData?.success && responseData?.data === null) {
                  // Duplicate notification was detected and not created
                 
                  toast.info(`Task saved (duplicate ${isReassignment ? 'reassignment' : 'assignment'} notification prevented)`, { duration: 3000 });
                } else {
                
                  toast.warning("Task saved but notification may not have been sent");
                }
              } else {
                toast.warning("Task saved but assignee notification failed");
              }
            }
          } catch (notificationError) {
            if (axios.isAxiosError(notificationError)) {
           
            }
            toast.warning("Task saved successfully, but notification could not be sent");
          }
        } else {
;
        }

        // Step 6: Send notification if status changed
        if (statusChanged && originalStatus && newStatus) {
          try {
            const currentUserId = currentUser?.id;
            
            if (!currentUserId) {
              console.log('⚠️ No current user ID for status change notification');
            } else {
              // Get actor name from User Service API
              let currentUserName = "Unknown User";
              
              try {
                console.log(`FRONTEND: Getting username for status change notification: ${currentUserId}`);
                
                const userApiResponse = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${currentUserId}/username`, {
                  timeout: 5000
                });

                if (userApiResponse.data?.status === "SUCCESS" && userApiResponse.data?.data) {
                  currentUserName = userApiResponse.data.data;
                  console.log(`FRONTEND: Got username for status change: ${currentUserName}`);
                } else {
                  console.warn(`⚠️ FRONTEND: User Service API returned invalid response for status change`);
                }
                
              } catch (error) {
                console.error(`❌ FRONTEND: Failed to get username for status change notification:`, error);
                currentUserName = `User-${currentUserId.substring(0, 8)}`;
              }

              // Helper function to convert status to display name
              const getStatusDisplayName = (status: string): string => {
                switch (status) {
                  case "TODO": return "To Do";
                  case "IN_PROGRESS": return "In Progress";
                  case "REVIEW": return "Review";
                  case "DONE": return "Done";
                  default: return status;
                }
              };

              const baseNotificationData = {
                type: "TASK_STATUS_CHANGED",
                title: "Task status changed",
                message: `${currentUserName} changed task "${editedTask.title}" status from "${getStatusDisplayName(originalStatus)}" to "${getStatusDisplayName(newStatus)}"`,
                actorUserId: currentUserId,
                actorUserName: currentUserName,
                projectId: editedTask.projectId,
                projectName: editedTask.projectName || "TaskFlow Project",
                taskId: editedTask.id
              };

              const recipients = [];

              // 1. Add assignee if exists and different from actor
              if (editedTask.assigneeId && editedTask.assigneeId !== currentUserId) {
                recipients.push(editedTask.assigneeId);
                console.log('✅ MODAL: Added assignee to recipients:', editedTask.assigneeId);
              } else {
                console.log('❌ MODAL: Assignee not added:', { 
                  assigneeId: editedTask.assigneeId, 
                  currentUserId: currentUserId 
                });
              }

              // 2. Add task creator if exists and different from actor and assignee
              if (editedTask.createdBy && editedTask.createdBy !== currentUserId && editedTask.createdBy !== editedTask.assigneeId) {
                recipients.push(editedTask.createdBy);
                console.log('✅ MODAL: Added task creator to recipients:', editedTask.createdBy);
              } else {
                console.log('❌ MODAL: Task creator not added:', { 
                  createdBy: editedTask.createdBy, 
                  currentUserId: currentUserId, 
                  assigneeId: editedTask.assigneeId
                });
              }

              // 3. Add scrum master - fetch from project API
              let scrumMasterId = null;
              try {
                if (editedTask.projectId) {
                  const projectResponse = await axios.get(`${API_CONFIG.USER_SERVICE}/api/projects/${editedTask.projectId}`);
                  
                  if (projectResponse.data?.status === "SUCCESS" && projectResponse.data?.data?.scrumMasterId) {
                    scrumMasterId = projectResponse.data.data.scrumMasterId;
                    if (scrumMasterId !== currentUserId && scrumMasterId !== editedTask.assigneeId && scrumMasterId !== editedTask.createdBy) {
                      recipients.push(scrumMasterId);
                      console.log('✅ MODAL: Added scrum master to recipients:', scrumMasterId);
                    } else {
                      console.log('❌ MODAL: Scrum master not added (duplicate)');
                    }
                  } else {
                    console.log('❌ MODAL: No scrum master found in project data');
                  }
                }
              } catch (error) {
                console.warn('⚠️ MODAL: Failed to fetch scrum master info:', error);
              }

              // 🔧 TEMPORARY FIX: Add mock recipients if none found (for testing)
              if (recipients.length === 0) {
                console.log('⚠️ MODAL: No real recipients found, adding mock recipients for testing...');
                
                if (!editedTask.assigneeId) recipients.push('mock-assignee-123');
                if (!editedTask.createdBy) recipients.push('mock-creator-456');
                if (!scrumMasterId) recipients.push('mock-scrum-master-789');
              }

              // Send notifications to all unique recipients
              const uniqueRecipients = [...new Set(recipients)];
              console.log(`📤 MODAL: Final unique recipients (${uniqueRecipients.length}):`, uniqueRecipients);

              if (uniqueRecipients.length > 0) {
                const notificationPromises = uniqueRecipients.map(async (recipientId) => {
                  const statusNotificationData = {
                    ...baseNotificationData,
                    recipientUserId: recipientId
                  };

                  return axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, statusNotificationData);
                });

                const notificationResponses = await Promise.all(notificationPromises);
                
                const successCount = notificationResponses.filter(
                  response => response.status === 200 || response.status === 201
                ).length;

                
              } else {
                toast.success(`Status changed from "${getStatusDisplayName(originalStatus)}" to "${getStatusDisplayName(newStatus)}"`);
              }
            }
          } catch (statusNotificationError) {
            console.error('❌ FRONTEND: Failed to send task status change notification:', statusNotificationError);
            // Don't fail the main operation if notification fails
          }
        }

        // Exit edit mode after saving
        setIsEditingDescription(false);

        console.log(
          "Task saved successfully - images in description, files in attachments table."
        );

        // Close modal after successful save
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        toast.error("Failed to update task");
        console.error("API returned error:", response.data);
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove attachment from attachments table
  const removeAttachment = async (index: number) => {
    try {
      // Get the attachment to remove
      const attachmentToRemove = editedTask.attachments?.[index];
      if (!attachmentToRemove) return;

      // Get a copy of current attachments for local UI state
      const newAttachments = [...(editedTask.attachments || [])];

      // Check if it's a database attachment (object with id) or just a URL string
      if (typeof attachmentToRemove === "object" && attachmentToRemove.id) {
        // If it has an ID and it's not a temporary ID, delete from the attachments table
        if (!attachmentToRemove.id.toString().startsWith("temp-")) {
          try {
            console.log(
              `Deleting attachment ${attachmentToRemove.id} from attachments table`
            );
            const response = await axios.delete(
              `${API_CONFIG.FILE_SERVICE}/api/attachments/${attachmentToRemove.id}`
            );
            if (response.data?.status === "SUCCESS") {
              console.log(
                "Attachment deleted from attachments table successfully"
              );
              toast.success("Attachment deleted from database");
            } else {
              console.error(
                "Failed to delete attachment from attachments table:",
                response.data
              );
              toast.error("Failed to delete attachment from database");
              return; // Don't remove from UI if database deletion failed
            }
          } catch (deleteError) {
            console.error(
              "Error deleting attachment from attachments table:",
              deleteError
            );
            toast.error("Error deleting attachment from database");
            return; // Don't remove from UI if database deletion failed
          }
        }
      }

      // Remove from the local UI state only if database deletion succeeded
      newAttachments.splice(index, 1);

      // Update the local UI state (not saved to task table)
      updateField("attachments", newAttachments);

      // Show success message
      toast.success("Attachment removed from UI");

      console.log(
        "Attachment deleted from attachments table and removed from UI. Task table not affected."
      );
      console.log("Remaining attachments in UI:", newAttachments);
    } catch (error) {
      console.error("Error removing attachment:", error);
      toast.error("Failed to remove attachment");
    }
  };

  // Assign task to the current user
  const assignToMe = () => {
    if (!currentUser) {
      toast.error("Current user information is not available.");
      console.error("Cannot assign task - currentUser is null or undefined");
      return;
    }

    console.log("Assigning task to me, current user:", currentUser);
    updateField("assigneeId", currentUser.id);
    updateField("assigneeName", currentUser.username);

    // Log the updated task to check changes
    setTimeout(() => {
      console.log("Updated task after assignment:", editedTask);
    }, 0);
  };

  // Add URL as attachment
  const addUrlAttachment = () => {
    // Sử dụng hộp thoại nhập liệu với giao diện tốt hơn
    try {
      // Tạo một phần tử dialog giả lập
      const dialog = document.createElement("div");
      dialog.className =
        "fixed inset-0 bg-black/40 flex items-center justify-center z-50";
      dialog.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 w-[400px]">
          <h3 class="text-lg font-medium mb-4">Add URL attachment</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">URL</label>
            <input type="text" id="attachment-url-input" class="w-full border rounded px-3 py-2" placeholder="https://example.com/file.pdf">
            <div id="url-validation-error" class="text-red-500 text-sm mt-1 hidden">Please enter a valid URL</div>
          </div>
          <div class="flex justify-end gap-2">
            <button id="cancel-url-button" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button id="add-url-button" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Add</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Xử lý sự kiện cho các nút
      const input = dialog.querySelector(
        "#attachment-url-input"
      ) as HTMLInputElement;
      const errorDiv = dialog.querySelector(
        "#url-validation-error"
      ) as HTMLDivElement;
      const addButton = dialog.querySelector(
        "#add-url-button"
      ) as HTMLButtonElement;
      const cancelButton = dialog.querySelector(
        "#cancel-url-button"
      ) as HTMLButtonElement;

      // Focus vào ô nhập liệu
      setTimeout(() => input?.focus(), 100);

      // Xử lý sự kiện khi click nút Add
      addButton.onclick = () => {
        const url = input.value.trim();
        if (!url) {
          errorDiv.textContent = "URL cannot be empty";
          errorDiv.classList.remove("hidden");
          return;
        }

        try {
          new URL(url); // Kiểm tra URL hợp lệ

          // Thêm URL vào danh sách đính kèm
          const currentAttachments = editedTask.attachments || [];
          updateField("attachments", [...currentAttachments, url]);

          // Hiển thị thông báo thành công
          const displayUrl =
            url.length > 30 ? url.substring(0, 30) + "..." : url;
          toast.success(`Added link: ${displayUrl}`, {
            duration: 3000,
          });

          // Auto-save the task after adding URL
          saveChanges();

          // Đóng dialog
          document.body.removeChild(dialog);
        } catch (error) {
          errorDiv.textContent = "Please enter a valid URL";
          errorDiv.classList.remove("hidden");
        }
      };

      // Xử lý sự kiện khi click nút Cancel
      cancelButton.onclick = () => {
        document.body.removeChild(dialog);
      };

      // Xử lý sự kiện khi nhấn Enter
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          addButton.click();
        }
      });

      // Xử lý sự kiện khi nhấn Escape
      document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
          document.body.removeChild(dialog);
          document.removeEventListener("keydown", escHandler);
        }
      });
    } catch (error) {
      console.error("Error showing URL dialog:", error);
      toast.error("Failed to add URL attachment");
    }
  };

  // Handle Add dropdown actions
  const handleAddAction = (action: string) => {
    setIsAddDropdownOpen(false);

    switch (action) {
      case "attachment":
        // Trigger file upload
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept =
          "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.exe,.js,.html,.css,.java,.py,.php,.c,.cpp,.json,.xml";
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            handleFileUpload(files);
          }
        };
        input.click();
        break;
      case "child-task":
        setShowSubtaskForm(true);
        break;
      case "linked-task":
        setShowLinkedWorkItemForm(true);
        break;
      case "web-link":
        setShowWebLinkForm(true);
        break;
      default:
        break;
    }
  };

  // Create subtask
  const createSubtask = async () => {
    if (!subtaskTitle.trim()) {
      toast.error("Please enter a subtask title");
      return;
    }

    try {
      const subtaskData = {
        title: subtaskTitle.trim(),
        description: "",
        status: "TODO",
        projectId: editedTask.projectId,
        sprintId: editedTask.sprintId,
        parentTaskId: editedTask.id,
        assigneeId: null,
      };

      // Include user ID in headers
      const headers: any = {
        'Content-Type': 'application/json'
      };
      if (currentUser?.id) {
        headers['X-User-Id'] = currentUser.id;
      }

      const response = await axios.post(
        `${API_CONFIG.TASKS_SERVICE}/api/tasks`,
        subtaskData,
        { headers }
      );

      if (response.data?.status === "SUCCESS") {
        const newSubtask = response.data.data;
        // Add to local state for display
        setChildWorkItems((prev) => [...prev, newSubtask]);

        toast.success("Subtask created successfully");
        setSubtaskTitle("");
        setShowSubtaskForm(false);
        console.log("Created subtask:", newSubtask);
      } else {
        toast.error("Failed to create subtask");
      }
    } catch (error) {
      console.error("Error creating subtask:", error);
      toast.error("Failed to create subtask");
    }
  };

  // Add web link - lưu vào task object
  const addWebLink = async () => {
    if (!webLinkUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    try {
      new URL(webLinkUrl); // Validate URL

      // Save web link to attachments table with type = 'link'
      const attachmentData = {
        taskId: editedTask.id,
        fileName: webLinkDescription.trim() || "Web Link", // Use description as fileName
        fileUrl: webLinkUrl.trim(), // Use URL as fileUrl
        fileType: "link", // Mark as link type
      };

      console.log("Saving web link to attachments table:", attachmentData);

      const response = await axios.post(
        `${API_CONFIG.FILE_SERVICE}/api/attachments/create`,
        attachmentData
      );

      if (response.data?.status === "SUCCESS") {
        const savedWebLink = response.data.data;
        console.log("Web link saved to attachments table:", savedWebLink);

        // Add to local state for immediate UI update
        setWebLinks((prev) => [...prev, savedWebLink]);

        toast.success("Web link added successfully");
        setWebLinkUrl("");
        setWebLinkDescription("");
        setShowWebLinkForm(false);
      } else {
        toast.error("Failed to save web link");
        console.error("API returned error:", response.data);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        toast.error("Please enter a valid URL");
      } else {
        console.error("Error adding web link:", error);
        toast.error("Failed to add web link");
      }
    }
  };

  // Toggle watch status
  const toggleWatch = () => {
    setIsWatchingTask((prev) => !prev);
    toast.success(
      isWatchingTask ? "No longer watching this task" : "Now watching this task"
    );
  };

  // Toggle like status
  const toggleLike = () => {
    setIsLiked((prev) => !prev);
    toast.success(isLiked ? "Removed your like" : "You liked this task");
  };

  // Delete task
  const deleteTask = async () => {
    try {
      setIsLoadingComments(true);

      const subtasks = childWorkItems || [];

      // Prepare confirmation message
      let confirmMessage = "Are you sure you want to delete this task?";
      if (subtasks.length > 0) {
        confirmMessage += ` This will also delete ${subtasks.length} subtask(s).`;
      }
      confirmMessage += " This action cannot be undone.";

      // ✅ Show React modal instead of browser confirm
      setDeleteConfirmMessage(confirmMessage);
      setShowDeleteConfirm(true);
    } catch (error) {
      console.error("Error preparing task deletion:", error);
      toast.error("Failed to prepare task deletion");
    } finally {
      setIsLoadingComments(false);
    }
  };

  // ✅ Actual delete task execution
  const executeTaskDelete = async () => {
    try {
      setIsLoadingComments(true);
      const subtasks = childWorkItems || [];

      // Delete all subtasks first
      if (subtasks.length > 0) {
        
                  const deleteSubtaskPromises = subtasks.map((subtask: any) =>
            axios.delete(`${API_CONFIG.TASKS_SERVICE}/api/tasks/${subtask.id}`)
          );

        try {
          await Promise.all(deleteSubtaskPromises);
          console.log("All subtasks deleted successfully");
          toast.success(`Deleted ${subtasks.length} subtask(s)`);
        } catch (subtaskError) {
          console.error("Error deleting some subtasks:", subtaskError);
          toast.error("Some subtasks could not be deleted");
          // Continue with parent task deletion even if some subtasks failed
        }
      }

      // Send notification before deleting the main task
      if (currentUser?.id && currentUser?.username && editedTask.projectId) {
        try {
          await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, {
            userId: editedTask.assigneeId || editedTask.createdBy, // Notify assignee or creator
            type: 'TASK_DELETED',
            message: `Task "${editedTask.title}" has been deleted by ${currentUser.username}`,
            actionUrl: `/project/${editedTask.projectId}`,
            isRead: false
          });
          console.log('Task deleted notification sent');
        } catch (notifError) {
          console.error('Failed to send task deleted notification:', notifError);
          // Don't fail the main operation if notification fails
        }
      }

      // Delete the main task
      const response = await axios.delete(
        `${API_CONFIG.TASKS_SERVICE}/api/tasks/${editedTask.id}`
      );

      if (response.data?.status === "SUCCESS") {
        toast.success(
          subtasks.length > 0 
            ? `Task and ${subtasks.length} subtask(s) deleted successfully`
            : "Task deleted successfully"
        );
        setShowDeleteConfirm(false); // Close modal
        onClose(); // Close modal
        // Optionally trigger a refresh of the task list in parent component
        window.location.reload(); // Simple way to refresh the board
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Add comment - simplified version using UserContext
  const addComment = async () => {
    if (!comment.trim() || !currentUser?.id || !editedTask.id) {
      toast.error("Please enter a comment and ensure you're logged in");
      return;
    }

    try {
      setIsAddingComment(true);

      const commentData = {
        taskId: editedTask.id,
        userId: currentUser.id,
        content: comment.trim(),
      };

      console.log("Adding comment:", commentData);

      const response = await axios.post(
        `${API_CONFIG.TASKS_SERVICE}/api/comments`,
        commentData
      );

      console.log("Comment response:", response.data);

      if (response.data?.status === "SUCCESS") {
        // Add the new comment to local state
        const newComment = response.data.data;
        newComment.createdAt = new Date().toISOString();
        newComment.updatedAt = new Date().toISOString();

        setComments((prev) => [...prev, newComment]);
        setComment("");
        toast.success("Comment added successfully");

        // ✅ REMOVED: Frontend notification logic 
        // Backend CommentController.sendCommentNotification() already handles this
        console.log("✅ Comment created - backend will handle notifications");

      } else {
        toast.error("Failed to add comment");
      }
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsAddingComment(false);
    }
  };

  // Add reply to comment
  const addReply = async (parentCommentId: number) => {
    if (!replyText.trim() || !currentUser || !editedTask.id) {
      toast.error("Please enter a reply and ensure you're logged in");
      return;
    }

    try {
      setIsAddingReply(true);

      const replyData = {
        userId: currentUser.id,
        content: replyText.trim(),
      };

      console.log("Adding reply to comment:", parentCommentId, replyData);

      const response = await axios.post(
        `${API_CONFIG.TASKS_SERVICE}/api/comments/${parentCommentId}/reply`,
        replyData
      );

      if (response.data?.status === "SUCCESS") {
        // Add the new reply to local state
        const newReply = response.data.data;
        // Ensure the reply has current timestamp for "Just now" display
        newReply.createdAt = new Date().toISOString();
        newReply.updatedAt = new Date().toISOString();

        setComments((prev) => [...prev, newReply]);
        setReplyText("");
        setReplyingTo(null);
        toast.success("Reply added successfully");
        console.log("Reply added:", newReply);
      } else {
        toast.error("Failed to add reply");
        console.error("API returned error:", response.data);
      }
    } catch (error) {
      console.error("Error adding reply:", error);
      toast.error("Failed to add reply");
    } finally {
      setIsAddingReply(false);
    }
  };

  // Fetch comments for the task
  const fetchComments = async (taskId: string) => {
    // Validate task ID before making API call - relaxed validation
    if (!taskId || 
        taskId.startsWith('temp-') || 
        taskId.includes('undefined') || 
        taskId === 'new' ||
        taskId === '' ||
        taskId.length < 5) {  // Relaxed validation
      console.log('⚠️ MODAL: Skipping fetchComments for invalid task ID:', taskId);
      setComments([]);
      return;
    }

    setIsLoadingComments(true);
    try {
      console.log("🔍 Fetching comments for task:", taskId);
      const response = await axios.get(
        `${API_CONFIG.TASKS_SERVICE}/api/comments/task/${taskId}`
      );

      if (response.data?.status === "SUCCESS") {
        const allComments = response.data.data || [];
        console.log("✅ Comments fetched:", allComments);
        
        // Organize comments into parent-child structure
        const organizedComments = organizeComments(allComments);
        setComments(organizedComments);
      } else {
        console.warn("⚠️ Comments API returned non-SUCCESS status");
        setComments([]);
      }
    } catch (error) {
      console.error("❌ Error fetching comments:", error);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Delete comment
  const deleteComment = async (commentId: number) => {
    if (!currentUser) {
      toast.error("You must be logged in to delete comments");
      return;
    }

    try {

      const response = await axios.delete(
        `${API_CONFIG.TASKS_SERVICE}/api/comments/${commentId}?userId=${currentUser.id}`
      );

      if (response.data?.status === "SUCCESS") {
        // Remove the comment from local state
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        toast.success("Comment deleted successfully");
        console.log("Comment deleted successfully");
      } else {
        toast.error("Failed to delete comment");
        console.error("API returned error:", response.data);
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Format comment date
  const formatCommentDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60)
      );

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes} minute(s) ago`;
      if (diffInMinutes < 1440)
        return `${Math.floor(diffInMinutes / 60)} hour(s) ago`;
      if (diffInMinutes < 10080)
        return `${Math.floor(diffInMinutes / 1440)} day(s) ago`;

      return date.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Unknown date";
    }
  };

  // Map status values to display names
  const statusMap: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    REVIEW: "Review",
    DONE: "Done",
  };

  // Status options for dropdown
  const statusOptions = Object.values(statusMap);

  // Handle status change from dropdown
  const handleStatusChange = (displayValue: string) => {
    const statusKey = Object.keys(statusMap).find(
      (key) => statusMap[key] === displayValue
    );

    if (statusKey) {
      updateField("status", statusKey);
    }
  };

  // Handle assignee change
  const handleAssigneeChange = (displayValue: string) => {
    if (displayValue === "Unassigned" || displayValue === "Loading...") {
      updateField("assigneeId", null);
      updateField("assigneeName", "");
      return;
    }

    const selectedUser = allUsers.find((user) => user.username === displayValue);
    if (selectedUser) {
      updateField("assigneeId", selectedUser.id);
      updateField("assigneeName", selectedUser.username);
    } else {
      console.error("User not found for username:", displayValue);
      if (displayValue && displayValue !== "Unassigned") {
        updateField("assigneeName", displayValue);
      }
    }
  };

  // Handle sprint change
  const handleSprintChange = (displayValue: string) => {
    if (displayValue === "None") {
      updateField("sprintId", "");
    } else {
      const sprint = sprints.find((s) => s.name === displayValue);
      if (sprint) {
        updateField("sprintId", sprint.id);
      }
    }
  };

  // Prepare user options for dropdown
  const userOptions = loadingUsers
    ? ["Loading..."]
    : ["Unassigned", ...allUsers.map((user) => user.username)];

  // Find current selected value for assignee dropdown
  const currentAssignee = editedTask.assigneeId
    ? allUsers.find((user) => user.id === editedTask.assigneeId)?.username ||
      editedTask.assigneeName ||
      "Unassigned"
    : "Unassigned";

  // Handle when text in the description is selected and a formatting button is clicked
  const handleDescriptionFormat = (content: string) => {
    updateField("description", content);
  };

  // Hàm để xác định loại file dựa trên extension
  const getFileType = (
    url: string
  ): "image" | "document" | "pdf" | "archive" | "unknown" => {
    const extension = url.split(".").pop()?.toLowerCase() || "";

    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
      return "image";
    } else if (["doc", "docx", "txt", "rtf", "odt"].includes(extension)) {
      return "document";
    } else if (extension === "pdf") {
      return "pdf";
    } else if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
      return "archive";
    }

    return "unknown";
  };

  // Hàm để lấy biểu tượng phù hợp cho từng loại file
  const getFileIcon = (url: string) => {
    const type = getFileType(url);

    switch (type) {
      case "image":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mr-2 text-blue-500"
          >
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
        );
      case "document":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mr-2 text-green-500"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        );
      case "pdf":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mr-2 text-red-500"
          >
            <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
          </svg>
        );
      case "archive":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mr-2 text-yellow-500"
          >
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mr-2 text-gray-500"
          >
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
        );
    }
  };

  // Fetch attachments from the File Service (attachments table) - chỉ lấy file và ảnh thật
  const fetchAttachments = async (taskId: string) => {
    // Validate task ID before making API call - relaxed validation
    if (!taskId || 
        taskId.startsWith('temp-') || 
        taskId.includes('undefined') || 
        taskId === 'new' ||
        taskId === '' ||
        taskId.length < 5) {  // Relaxed from 10 to 5 characters
      console.log('⚠️ MODAL: Skipping fetchAttachments for invalid task ID:', taskId);
      updateField("attachments", []);
      return;
    }

    try {
      console.log("Fetching attachments (files/images only) for task:", taskId);
      const response = await axios.get(
        `${API_CONFIG.FILE_SERVICE}/api/attachments/task/${taskId}`
      );
      if (response.data?.status === "SUCCESS" && response.data.data) {
        // Filter chỉ lấy file và ảnh thật, không lấy web links và task links
        const realAttachments = response.data.data.filter(
          (att: any) =>
            (att.file_type !== "link" && att.file_type !== "task_link") &&
            (att.fileType !== "link" && att.fileType !== "task_link")
        );
        console.log(
          "Real attachments (files/images) fetched:",
          realAttachments
        );
        updateField("attachments", realAttachments);

        
      } else {
        console.log("No real attachments found for task:", taskId);
        updateField("attachments", []);
      }
    } catch (error) {
      console.error("Error fetching real attachments:", error);
      updateField("attachments", []);
    }
  };

  // Fetch child work items (subtasks) - sử dụng API filter hiện có
  const fetchChildWorkItems = async (taskId: string) => {
    // Validate task ID before making API call - relaxed validation
    if (!taskId || 
        taskId.startsWith('temp-') || 
        taskId.includes('undefined') || 
        taskId === 'new' ||
        taskId === '' ||
        taskId.length < 5) {  // Relaxed validation
      console.log('⚠️ MODAL: Skipping fetchChildWorkItems for invalid task ID:', taskId);
      setChildWorkItems([]);
      return;
    }

    try {
      console.log("Fetching child work items for task:", taskId);
      // Sử dụng getAllTasks và filter by parentTaskId ở frontend - API tasks ở port 8085
      const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks`);
      if (response.data?.status === "SUCCESS") {
        const allTasks = response.data.data || [];
        // Filter tasks có parentTaskId = taskId hiện tại và đảm bảo task hợp lệ
        const childTasks = allTasks.filter(
          (task: any) =>
            task && task.id && task.parentTaskId === taskId && task.status
        );
        setChildWorkItems(childTasks);
        console.log("Child work items fetched:", childTasks);
      } else {
        console.warn(
          "No child work items found or API returned non-SUCCESS status"
        );
        setChildWorkItems([]);
      }
    } catch (error) {
      console.error(
        "Error fetching child work items from ${API_CONFIG.TASKS_SERVICE}/api/tasks:",
        error
      );
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      setChildWorkItems([]);
      // Don't show error toast for background operation
    }
  };

  // Fetch web links từ attachments table với file_type = 'link'
  const fetchWebLinks = async (taskId: string) => {
    // Validate task ID before making API call - relaxed validation
    if (!taskId || 
        taskId.startsWith('temp-') || 
        taskId.includes('undefined') || 
        taskId === 'new' ||
        taskId === '' ||
        taskId.length < 5) {  // Relaxed validation
      console.log('⚠️ MODAL: Skipping fetchWebLinks for invalid task ID:', taskId);
      setWebLinks([]);
      return;
    }

    try {
      // Sử dụng File-Service để lấy attachments có type = 'link' - API attachments ở port 8087
      const response = await axios.get(
        `${API_CONFIG.FILE_SERVICE}/api/attachments/task/${taskId}`
      );

      if (response.data?.status === "SUCCESS") {
        const allAttachments = response.data.data || [];
        console.log("🔗 All attachments:", allAttachments);
        // Filter chỉ lấy những attachment có file_type = 'link'
        const links = allAttachments.filter(
          (att: any) => att.file_type === "link" || att.fileType === "link"
        );
        setWebLinks(links);

        
      } else {
        
        setWebLinks([]);
      }
    } catch (error) {
      
      if (error instanceof Error) {
      }
      setWebLinks([]);
      // Don't show error toast for background operation
    }
  };

  // Fetch linked work items từ attachments table với file_type = 'task_link'
  const fetchLinkedWorkItems = async (taskId: string) => {
    // Validate task ID before making API call - relaxed validation
    if (!taskId || 
        taskId.startsWith('temp-') || 
        taskId.includes('undefined') || 
        taskId === 'new' ||
        taskId === '' ||
        taskId.length < 5) {  // Relaxed validation
      console.log('⚠️ MODAL: Skipping fetchLinkedWorkItems for invalid task ID:', taskId);
      setLinkedWorkItems([]);
      return;
    }

    try {
      // Sử dụng File-Service để lấy attachments có type = 'task_link' - API attachments ở port 8087
      const response = await axios.get(
        `${API_CONFIG.FILE_SERVICE}/api/attachments/task/${taskId}`
      );

      if (response.data?.status === "SUCCESS") {
        const allAttachments = response.data.data || [];
        console.log("🔗 All attachments for linked items:", allAttachments);
        // Filter chỉ lấy những attachment có file_type = 'task_link'
        const taskLinks = allAttachments.filter(
          (att: any) => att.file_type === "task_link"
        );
        console.log("🔗 Filtered task links:", taskLinks);

        // Convert attachment data thành linked work item format cho UI
        const linkedItems = await Promise.all(
          taskLinks.map(async (link: any) => {
            try {
              console.log("🔗 Fetching target task:", link.file_url);
              // Fetch thông tin của target task
              const targetTaskResponse = await axios.get(
                `${API_CONFIG.TASKS_SERVICE}/api/tasks/${link.file_url}`
              );
              const targetTask = targetTaskResponse.data?.data;

              return {
                id: link.id,
                linkType: link.file_name, // "is blocked by", "blocks", "relates to", etc.
                targetTask: targetTask
                  ? {
                      id: targetTask.id,
                      shortKey: targetTask.shortKey,
                      title: targetTask.title,
                      status: targetTask.status,
                    }
                  : {
                      id: link.file_url,
                      shortKey: "UNKNOWN",
                      title: "Task not found",
                      status: "UNKNOWN",
                    },
                sourceTaskId: taskId,
                createdAt: link.uploaded_at || new Date().toISOString(),
              };
            } catch (error) {
              console.error(
                "🔗 Error fetching target task:",
                link.file_url,
                error
              );
              // Return placeholder data if target task fetch fails
              return {
                id: link.id,
                linkType: link.file_name,
                targetTask: {
                  id: link.file_url,
                  shortKey: "ERROR",
                  title: "Failed to load task",
                  status: "UNKNOWN",
                },
                sourceTaskId: taskId,
                createdAt: link.uploaded_at || new Date().toISOString(),
              };
            }
          })
        );

        console.log("🔗 Final linked items:", linkedItems);
        setLinkedWorkItems(linkedItems);

        if (linkedItems.length > 0) {
          toast.success(`Found ${linkedItems.length} linked work item(s)`, {
            duration: 2000,
          });
        }
      } else {
        console.warn(
          "🔗 No linked work items found or API returned non-SUCCESS status"
        );
        setLinkedWorkItems([]);
      }
    } catch (error) {
      
      if (error instanceof Error) {
        console.error("🔗 Error details:", error.message);
      }
      setLinkedWorkItems([]);
      // Don't show error toast for background operation
    }
  };

  // Effect to fetch attachments when the modal opens - REPLACED with force refresh
  useEffect(() => {
    if (task?.id) {
      // Update local state
      setEditedTask({ ...task });
      
      // Fetch all data from database to ensure fresh information
      fetchAttachments(task.id);
      fetchChildWorkItems(task.id);
      fetchWebLinks(task.id);
      fetchLinkedWorkItems(task.id);
      fetchComments(task.id);
    }
  }, [task?.id]); // Trigger whenever task.id changes

  // Helper function to get user display name by userId
  const getUserDisplayName = (userId: string): string => {
    if (!userId) return "Unknown User";
    
    const user = getUserById(userId);
    if (user) {
      return user.username;
    }
    
    // Only try to fetch if we don't have the user in cache
    // and it's not already being fetched (don't be aggressive)
    const existingCacheCheck = cachedUsers.find((u: User) => u.id === userId);
    if (!existingCacheCheck) {
      // Use setTimeout to avoid blocking the UI and fetch in background
      setTimeout(() => {
        fetchUserById(userId).catch(error => {
          console.log("Background fetch failed for user:", userId);
        });
      }, 100);
    }
    
    return `User-${userId.substring(0, 8)}`; // Better temporary display
  };

  // Helper function to get user initials by userId
  const getUserInitials = (userId: string): string => {
    if (!userId) return "?";
    
    const user = getUserById(userId);
    if (user && user.username) {
      return user.username
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2);
    }
    
    // Don't trigger fetch for initials - just return a reasonable fallback
    return userId.substring(0, 2).toUpperCase();
  };

  // Function to fetch individual user info and add to users list (now managed by UserContext)
  // Helper function to get user initials from name
  const getInitials = (name: string): string => {
    if (!name || name === "Unassigned") return "?";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  // Helper function to get assigned user
  const getAssignedUser = () => {
    if (!editedTask.assigneeId) return null;
    return allUsers.find((user) => user.id === editedTask.assigneeId);
  };

  // Organize comments into parent-child structure
  const organizeComments = (comments: CommentData[]) => {
    const parentComments = comments.filter(
      (comment) => !comment.parentCommentId
    );
    const childComments = comments.filter((comment) => comment.parentCommentId);

    return parentComments.map((parent) => ({
      ...parent,
      replies: childComments.filter(
        (child) => child.parentCommentId === parent.id
      ),
    }));
  };

  // Handle reply button click
  const handleReplyClick = (commentId: number) => {
    setReplyingTo(commentId);
    setReplyText("");
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText("");
  };

  // SubtaskAssigneeDropdown component
  const SubtaskAssigneeDropdown = ({
    item,
    users,
    onAssigneeChange,
  }: {
    item: any;
    users: User[];
    onAssigneeChange: (
      assigneeId: string | null,
      assigneeName: string | null
    ) => void;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    const handleAssign = (userId: string | null, userName: string | null) => {
      onAssigneeChange(userId, userName);
      setIsOpen(false);
    };

    return (
      <div className="relative" ref={dropdownRef}>
        {/* Avatar clickable để mở dropdown */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
          onClick={() => setIsOpen(!isOpen)}
          title={`Assigned to: ${
            item.assigneeName || "Unassigned"
          } - Click to change`}
        >
          {item.assigneeId ? (
            allUsers.find((u) => u.id === item.assigneeId) ? (
              <UserAvatar
                user={allUsers.find((u) => u.id === item.assigneeId)!}
                size="sm"
                className="w-6 h-6"
              />
            ) : (
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                {item.assigneeName?.charAt(0).toUpperCase() || "U"}
              </div>
            )
          ) : (
            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs">
              ?
            </div>
          )}
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute right-0 top-8 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            <div className="py-1">
              {/* Unassigned option */}
              <button
                onClick={() => handleAssign(null, null)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
              >
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs">
                  ?
                </div>
                <span className="text-sm">Unassigned</span>
              </button>

              {/* User options */}
              {allUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAssign(user.id, user.username)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <UserAvatar user={user} size="sm" className="w-6 h-6" />
                  <span className="text-sm">{user.username}</span>
                  {item.assigneeId === user.id && (
                    <svg
                      className="w-4 h-4 text-blue-600 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Custom Assignee Dropdown Component
  const AssigneeDropdown = () => {
    // Prepare user options for dropdown
    const userOptions = loadingUsers
      ? ["Loading..."]
      : ["Unassigned", ...allUsers.map((user) => user.username)];

    // Find current selected value for assignee dropdown
    const currentAssignee = editedTask.assigneeId
      ? allUsers.find((user) => user.id === editedTask.assigneeId)?.username ||
        editedTask.assigneeName ||
        "Unassigned"
      : "Unassigned";

    return (
      <Dropdown
        placeholder="Select assignee"
        options={userOptions}
        onSelect={handleAssigneeChange}
        defaultValue={currentAssignee}
        disabled={loadingUsers || allUsers.length === 0}
      />
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isAddDropdownOpen && !target.closest(".relative")) {
        setIsAddDropdownOpen(false);
      }
      if (showMoreMenu && !target.closest(".more-menu-container")) {
        setShowMoreMenu(false);
      }
      // Close assignee dropdown when clicking outside
      if (!target.closest(".assignee-dropdown") && !target.closest(".assignee-selector")) {
        const dropdown = document.querySelector('.assignee-dropdown') as HTMLElement;
        if (dropdown && dropdown.style.display === 'block') {
          dropdown.style.display = 'none';
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddDropdownOpen, showMoreMenu]);

  // Search for tasks to link
  const searchTasks = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      // Search all tasks in the project
      const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks`);

      if (response.data?.status === "SUCCESS") {
        const allTasks = response.data.data || [];
        // Filter tasks that match search term and exclude current task
        const filteredTasks = allTasks.filter(
          (task: any) =>
            task &&
            task.id !== editedTask.id && // Exclude current task
            (task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.shortKey?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.id?.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        setSearchResults(filteredTasks.slice(0, 10)); // Limit to 10 results
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching tasks:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Link a work item - lưu vào attachments table
  const linkWorkItem = async (targetTask: any) => {
    try {
      // Save linked work item to attachments table with type = 'task_link'
      const attachmentData = {
        taskId: editedTask.id,
        fileName: linkedWorkItemType, // Use link type as fileName ("is blocked by", "blocks", etc.)
        fileUrl: targetTask.id, // Use target task ID as fileUrl
        fileType: "task_link", // Mark as task link type
      };

      console.log("Saving linked work item to attachments table:", attachmentData);

      const response = await axios.post(
        `${API_CONFIG.FILE_SERVICE}/api/attachments/create`,
        attachmentData
      );

      if (response.data?.status === "SUCCESS") {
        const savedLinkAttachment = response.data.data;
        console.log("Linked work item saved to attachments table:", savedLinkAttachment);

        // Convert to UI format and add to local state
        const newLinkedItem = {
          id: savedLinkAttachment.id,
          linkType: linkedWorkItemType,
          targetTask: {
            id: targetTask.id,
            shortKey: targetTask.shortKey,
            title: targetTask.title,
            status: targetTask.status,
          },
          sourceTaskId: editedTask.id,
          createdAt: savedLinkAttachment.uploaded_at || new Date().toISOString(),
        };

        // Add to local state for immediate UI update
        setLinkedWorkItems((prev) => [...prev, newLinkedItem]);

        setShowLinkedWorkItemForm(false);
        setLinkedWorkItemSearch("");
        setSearchResults([]);

        toast.success(
          `Linked work item added: ${linkedWorkItemType} ${
            targetTask.shortKey || targetTask.id
          }`
        );
        console.log("Added linked work item:", newLinkedItem);
      } else {
        toast.error("Failed to save linked work item");
        console.error("API returned error:", response.data);
      }
    } catch (error) {
      console.error("Error linking work item:", error);
      toast.error("Failed to link work item");
    }
  };

  // Handle priority change
  const handlePriorityChange = (displayValue: string) => {
    // Map display values to enum values
    const priorityMap: Record<string, "LOWEST" | "LOW" | "MEDIUM" | "HIGH" | "HIGHEST" | "BLOCKER" | "BLOCK"> = {
      "🔵 Lowest": "LOWEST",
      "🟢 Low": "LOW", 
      "🟡 Medium": "MEDIUM",
      "🟠 High": "HIGH",
      "🔴 Highest": "HIGHEST",
      "🚫 Blocker": "BLOCKER",
      "🛑 Block": "BLOCK"
    };

    const priority = priorityMap[displayValue];
    if (priority) {
      updateField("priority", priority);
    }
  };

  // ✅ AI Story Point Estimation
  const estimateStoryPoints = async () => {
    if (!editedTask.id) {
      toast.error("Task ID is required for estimation");
      return;
    }

    try {
      setIsEstimating(true);
      setEstimationResult(null);

      console.log("Starting AI estimation for task:", editedTask.id);

      // Get assignee's completed tasks history
      let assigneeHistory = [];
      if (editedTask.assigneeId) {
        try {
          const historyResponse = await axios.get(
            `${API_CONFIG.TASKS_SERVICE}/api/tasks/user/${editedTask.assigneeId}/completed`
          );
          assigneeHistory = historyResponse.data.data || [];
        } catch (error) {
          console.warn("Could not fetch assignee history:", error);
        }
      }

      // Call the AI service API for task estimation
      const response = await axios.post(
        `${API_CONFIG.TASKS_SERVICE}/api/tasks/${editedTask.id}/estimate-story-points`,
        {
          title: editedTask.title,
          description: editedTask.description || "",
          priority: editedTask.priority,
          assignee_history: assigneeHistory,
          attachments_count: editedTask.attachments?.length || 0
        }
      );

      if (response.data?.status === "SUCCESS" && response.data.data?.success) {
        const aiResult = response.data.data.data;
        console.log("AI estimation result:", aiResult);

        // Map the response to match our interface
        const mappedResult = {
          estimated_story_points: aiResult.estimated_story_points,
          confidence: aiResult.confidence,
          reasoning: aiResult.reasoning,
          features_used: aiResult.features_used || aiResult.features
        };

        setEstimationResult(mappedResult);
        setShowAIEstimationModal(true);

        // Show success notification with estimation result
        toast.success(
          `AI estimation complete! Review the detailed analysis.`,
          {
            duration: 3000,
          }
        );
      } else {
        const errorMsg = response.data?.data?.error || "AI estimation failed";
        console.error("AI estimation failed:", errorMsg);
        toast.error(`AI estimation failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Error during AI estimation:", error);
      toast.error("Failed to estimate story points. Check if AI service is running.");
    } finally {
      setIsEstimating(false);
    }
  };

  // Accept AI estimation result
  const acceptEstimation = (storyPoints: number) => {
    updateField("storyPoint", storyPoints);
    toast.success(`Story point updated to ${storyPoints} based on AI recommendation`);
    setEstimationResult(null);
    setShowAIEstimationModal(false);
  };

  // Reject AI estimation result
  const rejectEstimation = () => {
    setEstimationResult(null);
    setShowAIEstimationModal(false);
    toast.info("AI estimation rejected");
  };

  // Get priority display value with icon
  const getPriorityDisplayValue = (priority?: string) => {
    const priorityMap: Record<string, string> = {
      "LOWEST": "🔵 Lowest",
      "LOW": "🟢 Low",
      "MEDIUM": "🟡 Medium", 
      "HIGH": "🟠 High",
      "HIGHEST": "🔴 Highest",
      "BLOCKER": "🚫 Blocker",
      "BLOCK": "🛑 Block"
    };
    
    return priorityMap[priority || "MEDIUM"] || "🟡 Medium";
  };

  // Utility function to extract only text from HTML content
  const extractTextFromHtml = (htmlContent: string): string => {
    if (!htmlContent) return "";

    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    // Remove ONLY file links (NOT images)
    const fileLinks = tempDiv.querySelectorAll(
      'a[href*="/uploads/"], a.file-link, a[data-attachment-id]'
    );
    fileLinks.forEach((link) => link.remove());

    // Get content with images preserved
    let contentWithImages = tempDiv.innerHTML;

    // Clean up extra line breaks and empty paragraphs
    contentWithImages = contentWithImages
      .replace(/<p><br><\/p>/g, "<p></p>")
      .replace(/<p>\s*<\/p>/g, "")
      .replace(/(<p><\/p>){2,}/g, "<p></p>")
      .trim();

    return contentWithImages;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[80%] max-w-5xl h-[80%] flex flex-col relative">
        {/* Header with task ID and action buttons */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-2">
            {/* Back to parent button nếu đây là subtask */}
            {editedTask.parentTaskId && (
              <button
                onClick={() => {
                  if (onBackToParent) {
                    onBackToParent(editedTask.parentTaskId!);
                  } else {
                    console.log(
                      "Back to parent task:",
                      editedTask.parentTaskId
                    );
                    toast.info(
                      "Please implement onBackToParent prop to navigate to parent task"
                    );
                  }
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded mr-2"
                title="Back to parent task"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
              </button>
            )}
            <span className="text-blue-600 font-medium">
              {editedTask.shortKey || "TASK"}-{editedTask.id?.substring(0, 5)}
              {editedTask.parentTaskId && (
                <span className="text-gray-500 text-xs ml-1">(Subtask)</span>
              )}
            </span>
            <input
              type="text"
              className="text-lg font-semibold border-none focus:ring-1 focus:ring-blue-300 rounded px-1"
              value={editedTask.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              className={`p-2 hover:bg-gray-100 rounded ${
                isLiked ? "text-red-500" : "text-gray-500"
              }`}
              onClick={toggleLike}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isLiked ? "currentColor" : "none"}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="relative more-menu-container">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                ⋮
              </button>

              {/* More menu dropdown */}
              {showMoreMenu && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {/* Only show delete button if user has permission */}
                    {userData?.account?.id && canDeleteTaskAsUser(userPermissions, task.createdBy || null, userData.account.id) ? (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          deleteTask();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-3 text-red-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1 -1 2 -2 2H7c-1 0 -2 -1 -2 -2V6"></path>
                          <path d="M8 6V4c0 -1 1 -2 2 -2h4c1 0 2 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        <span className="text-sm">Delete task</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-400 italic">
                        Only task creators and project admins can delete tasks
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content - left side */}
          <div className="flex-1 overflow-y-auto p-6 w-full">
            {/* Status selection using Dropdown component */}
            <div className="flex items-center mb-6">
              <div className="mr-4">
                <span className="text-gray-700">Status:</span>
              </div>
              <div className="w-40">
                <Dropdown
                  options={statusOptions}
                  placeholder="Select Status"
                  onSelect={handleStatusChange}
                  defaultValue={statusMap[editedTask.status] || "To Do"}
                  disabled={isReadOnly}
                />
              </div>
              {/* Only show Save changes button if user has permission to edit the task */}
              {!isReadOnly && (
                <button
                  className={`ml-4 px-3 py-1 rounded-md ${
                    isSaving
                      ? "bg-gray-100 text-gray-400"
                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  }`}
                  onClick={saveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              )}
              {isReadOnly && (
                <div className="ml-4 px-3 py-1 text-sm text-gray-400 italic flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Read-only - Only task creators and assignees can edit
                </div>
              )}

              {/* Add dropdown button - moved from attachments section */}
              {/* Only show Add button if user has permission to edit the task */}
              {!isReadOnly && (
                <div className="relative ml-4">
                  <button
                    onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    title="Add item"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add
                  </button>

                  {/* Dropdown menu */}
                  {isAddDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="py-1">
                        {/* Attachment option */}
                        <button
                          onClick={() => handleAddAction("attachment")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-500"
                          >
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
                          </svg>
                          <span className="text-sm">Attachment</span>
                        </button>

                        {/* Child work item option */}
                        <button
                          onClick={() => handleAddAction("child-task")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-500"
                          >
                            <path d="M9 12h6"></path>
                            <path d="M9 16h6"></path>
                            <path d="m5 8 2-2"></path>
                            <path d="m7 6 2 2"></path>
                            <path d="m3 12 2-2"></path>
                            <path d="m5 10 2 2"></path>
                            <path d="m3 18 2-2"></path>
                            <path d="m5 16 2 2"></path>
                            <rect
                              width="14"
                              height="16"
                              x="7"
                              y="2"
                              rx="2"
                            ></rect>
                          </svg>
                          <span className="text-sm">Child work item</span>
                        </button>

                        {/* Linked work item option */}
                        <button
                          onClick={() => handleAddAction("linked-task")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-500"
                          >
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path>
                          </svg>
                          <span className="text-sm">Linked work item</span>
                        </button>

                        {/* Web link option */}
                        <button
                          onClick={() => handleAddAction("web-link")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-500"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M2 12h20"></path>
                            <path d="a15.3 15.3 0 0 1 0-6"></path>
                            <path d="a15.3 15.3 0 0 0 0 6"></path>
                          </svg>
                          <span className="text-sm">Web link</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Show info message when user doesn't have edit permissions */}
              {isReadOnly && (
                <div className="ml-4 px-3 py-1 text-sm text-gray-400 italic flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Only product-owner and assignees can add items
                </div>
              )}
            </div>

            {/* Description section with TipTap Rich Text Editor */}
            <div className="mb-8 w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Description</h3>
                {!isReadOnly && (
                  <button
                    onClick={toggleDescriptionEditMode}
                    className="text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    {isEditingDescription ? (
                      <span className="flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Done
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* TipTap editor component with full width or read-only view */}
              <div className="w-full task-description-content">
                {isEditingDescription && !isReadOnly ? (
                  <TiptapEditor
                    content={editedTask.description || ""}
                    onChange={(val) => updateField("description", val)}
                    taskId={editedTask.id}
                    onAttachmentUpload={handleTiptapAttachmentUpload}
                  />
                ) : (
                  <div
                    className={`border rounded p-4 bg-gray-50 min-h-[150px] prose max-w-none transition-colors ${
                      !isReadOnly ? "cursor-pointer hover:bg-gray-100" : "cursor-default"
                    }`}
                    onClick={!isReadOnly ? toggleDescriptionEditMode : undefined}
                  >
                    {editedTask.description ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: editedTask.description,
                        }}
                      />
                    ) : (
                      <p className="text-gray-400 italic">
                        {isReadOnly ? "No description" : "Click to add description..."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Attachments section */}
            <div className="mb-8 task-attachments-section">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">
                  Attachments
                  {editedTask.attachments &&
                    editedTask.attachments.length > 0 && (
                      <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                        {editedTask.attachments.length}
                      </span>
                    )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="More options"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Display attachments */}
              <div
                className="border-t pt-2 transition-colors duration-200"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add("bg-blue-50");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("bg-blue-50");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("bg-blue-50");
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
              >
                {editedTask.attachments && editedTask.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {editedTask.attachments.map((attachment, index) => {
                      // Get file extension and details
                      let fileName = "",
                        fileUrl = "",
                        fileType = "";

                      if (typeof attachment === "string") {
                        // Legacy format: just URL string
                        fileUrl = attachment;
                        fileName = attachment.split("/").pop() || attachment;
                        fileType =
                          fileName.split(".").pop()?.toLowerCase() || "";
                      } else if (typeof attachment === "object") {
                        // New format: attachment object from database
                        fileName = attachment.file_name || "";
                        fileUrl = attachment.file_url || "";
                        fileType = attachment.file_type || "";
                      }

                      // Handle filenames with timestamp prefix
                      const displayName = fileName.includes("-")
                        ? fileName.substring(fileName.indexOf("-") + 1)
                        : fileName;
                      const isImage = [
                        "jpg",
                        "jpeg",
                        "png",
                        "gif",
                        "webp",
                        "svg",
                        "bmp",
                      ].includes(fileType);

                      // Format the date for display
                      const uploadDate =
                        typeof attachment === "object" && attachment.uploaded_at
                          ? new Date(attachment.uploaded_at)
                          : new Date();

                      const formattedDate = `${uploadDate.getDate()} ${
                        [
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ][uploadDate.getMonth()]
                      } ${uploadDate.getFullYear()}, ${String(
                        uploadDate.getHours()
                      ).padStart(2, "0")}:${String(
                        uploadDate.getMinutes()
                      ).padStart(2, "0")} ${
                        uploadDate.getHours() >= 12 ? "PM" : "AM"
                      }`;

                      return (
                        <div
                          key={index}
                          className="bg-white border rounded-lg overflow-hidden shadow-sm relative group hover:shadow-md transition-shadow"
                        >
                          <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img
                                src={
                                  fileUrl.startsWith("/api")
                                    ? `${API_CONFIG.FILE_SERVICE}${fileUrl}`
                                    : fileUrl.startsWith("/uploads/")
                                    ? `${API_CONFIG.FILE_SERVICE}${fileUrl}`
                                    : fileUrl
                                }
                                alt={displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // If image fails to load, show a placeholder
                                  (e.target as HTMLImageElement).src =
                                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTk5OTkiPkltYWdlPC90ZXh0Pjwvc3ZnPg==";
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-4 text-gray-500">
                                {/* File type icon */}
                                {fileType === "xlsx" || fileType === "xls" ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="32"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-green-600"
                                  >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                ) : fileType === "docx" ||
                                  fileType === "doc" ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="32"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-blue-600"
                                  >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="32"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                  </svg>
                                )}
                                <span className="mt-2 text-xs font-medium">
                                  {fileType.toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <div
                              className="font-medium text-sm truncate"
                              title={displayName}
                            >
                              {displayName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formattedDate}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              File type: {fileType.toUpperCase()}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 group-hover:opacity-100 flex gap-1">
                            {/* Download button */}
                            <a
                              href={
                                typeof attachment === "object" && attachment.id
                                  ? `${API_CONFIG.FILE_SERVICE}/api/attachments/download/${attachment.id}`
                                  : fileUrl.startsWith("/api")
                                  ? `${API_CONFIG.FILE_SERVICE}${fileUrl}`
                                  : fileUrl.startsWith("/uploads/")
                                  ? `${API_CONFIG.FILE_SERVICE}${fileUrl}`
                                  : fileUrl
                              }
                              download={displayName}
                              className="p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-blue-500"
                              title="Download"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                            </a>

                            {/* Remove button */}
                            <button
                              onClick={() => removeAttachment(index)}
                              className="p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500"
                              title="Remove attachment"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4h-3.5z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-2 text-gray-400"
                    >
                      <path d="M13 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    <p className="font-medium">No attachments yet</p>
                    <p className="text-sm mt-1">
                      Drag and drop files here or use the + button above
                    </p>
                  </div>
                )}
              </div>

              {/* Child work items section */}
              {showSubtaskForm && (
                <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Child work items
                    </h4>
                    <div className="flex items-center gap-3">
                      {/* Progress bar cho form - 0% vì chưa có subtask nào */}
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="h-full bg-gray-300 w-0" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium min-w-[3rem]">
                          0% Done
                        </span>
                      </div>
                      <button
                        onClick={() => setShowSubtaskForm(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border rounded p-3 mb-3">
                    <input
                      type="text"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      className="w-full border-none outline-none text-sm"
                      placeholder="What needs to be done?"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowSubtaskForm(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createSubtask}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                      disabled={!subtaskTitle.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Display existing child work items */}
              {childWorkItems.length > 0 && (
                <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Child work items ({childWorkItems.length})
                    </h4>
                    <div className="flex items-center gap-3">
                      {/* Progress bar container */}
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-300 ease-out"
                            style={{
                              width: `${
                                childWorkItems.length > 0
                                  ? Math.round(
                                      (childWorkItems.filter(
                                        (item) => item && item.status === "DONE"
                                      ).length /
                                        childWorkItems.length) *
                                        100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium min-w-[3rem]">
                          {childWorkItems.length > 0
                            ? Math.round(
                                (childWorkItems.filter(
                                  (item) => item && item.status === "DONE"
                                ).length /
                                  childWorkItems.length) *
                                  100
                              )
                            : 0}
                          % Done
                        </span>
                      </div>
                      <button
                        onClick={() => setShowSubtaskForm(true)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        + Add child
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 overflow-visible">
                    {childWorkItems
                      .filter((item) => item && item.id)
                      .map((item, index) => (
                        <div
                          key={item.id}
                          className={`bg-white border rounded p-3 hover:bg-gray-50 transition-colors ${
                            index >= childWorkItems.length - 2 ? 'relative z-10' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            {/* Left side - Task info (clickable) */}
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => {
                                // Open TaskDetailModal for this subtask
                                if (onOpenSubtask) {
                                  onOpenSubtask(item);
                                } else {
                                  console.log(
                                    "Opening detail for subtask:",
                                    item
                                  );
                                  toast.info(
                                    "Click handled! Please pass onOpenSubtask prop to open detail modal"
                                  );
                                }
                              }}
                            >
                              <div className="flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  className="text-blue-600"
                                >
                                  <rect
                                    width="18"
                                    height="18"
                                    x="3"
                                    y="3"
                                    rx="2"
                                  ></rect>
                                  <path d="m9 12 2 2 4-4"></path>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-blue-600 hover:underline">
                                  {item.shortKey || "TASK"}-
                                  {item.id?.substring(0, 5)} {item.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Priority: Normal • Created:{" "}
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt
                                      ).toLocaleDateString()
                                    : "Today"}
                                </div>
                              </div>
                            </div>

                            {/* Right side - Quick actions */}
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Status dropdown */}
                              <div className={`w-32 ${index >= childWorkItems.length - 2 ? 'dropdown-force-up' : ''}`}>
                                <Dropdown
                                  options={[
                                    "To Do",
                                    "In Progress",
                                    "Review",
                                    "Done",
                                  ]}
                                  defaultValue={
                                    item.status === "DONE"
                                      ? "Done"
                                      : item.status === "IN_PROGRESS"
                                      ? "In Progress"
                                      : item.status === "REVIEW"
                                      ? "Review"
                                      : "To Do"
                                  }
                                  onSelect={async (selectedStatus) => {
                                    const newStatus =
                                      selectedStatus === "Done"
                                        ? "DONE"
                                        : selectedStatus === "In Progress"
                                        ? "IN_PROGRESS"
                                        : selectedStatus === "Review"
                                        ? "REVIEW"
                                        : "TODO";

                                    try {
                                      // Update status via API
                                      const response = await axios.put(
                                        `${API_CONFIG.TASKS_SERVICE}/api/tasks/${item.id}`,
                                        {
                                          ...item,
                                          status: newStatus,
                                          completedAt:
                                            newStatus === "DONE"
                                              ? new Date().toISOString()
                                              : null,
                                        },
                                        {
                                          headers: {
                                            'Content-Type': 'application/json',
                                            ...(currentUser?.id && { 'X-User-Id': currentUser.id }),
                                          },
                                        }
                                      );

                                      if (response.data?.status === "SUCCESS") {
                                        // Update local state
                                        setChildWorkItems((prev) =>
                                          prev.map((child) =>
                                            child.id === item.id
                                              ? { ...child, status: newStatus }
                                              : child
                                          )
                                        );
                                        toast.success(
                                          "Status updated successfully"
                                        );
                                      }
                                    } catch (error) {
                                      console.error(
                                        "Error updating status:",
                                        error
                                      );
                                      toast.error("Failed to update status");
                                    }
                                  }}
                                />
                              </div>

                              {/* Assignee dropdown */}
                              <SubtaskAssigneeDropdown
                                item={item}
                                users={allUsers}
                                onAssigneeChange={async (
                                  newAssigneeId,
                                  newAssigneeName
                                ) => {
                                  try {
                                    // Update assignee via API
                                    const response = await axios.put(
                                      `${API_CONFIG.TASKS_SERVICE}/api/tasks/${item.id}`,
                                      {
                                        ...item,
                                        assigneeId: newAssigneeId,
                                        assigneeName: newAssigneeName,
                                      }
                                    );

                                    if (response.data?.status === "SUCCESS") {
                                      // Update local state
                                      setChildWorkItems((prev) =>
                                        prev.map((child) =>
                                          child.id === item.id
                                            ? {
                                                ...child,
                                                assigneeId: newAssigneeId,
                                                assigneeName: newAssigneeName,
                                              }
                                            : child
                                        )
                                      );
                                      toast.success(
                                        "Assignee updated successfully"
                                      );
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error updating assignee:",
                                      error
                                    );
                                    toast.error("Failed to update assignee");
                                  }
                                }}
                              />

                              {/* More actions button */}
                              <button
                                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                                title="More actions"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Linked work items section */}
              {showLinkedWorkItemForm && (
                <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Link work item
                    </h4>
                    <button
                      onClick={() => {
                        setShowLinkedWorkItemForm(false);
                        setLinkedWorkItemSearch("");
                        setSearchResults([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="bg-white border rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-32">
                        <Dropdown
                          options={[
                            "is blocked by",
                            "blocks",
                            "relates to",
                            "duplicates",
                            "is duplicated by",
                          ]}
                          defaultValue={linkedWorkItemType}
                          onSelect={(value) => {
                            setLinkedWorkItemType(value);
                          }}
                        />
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={linkedWorkItemSearch}
                          onChange={(e) => {
                            setLinkedWorkItemSearch(e.target.value);
                            searchTasks(e.target.value);
                          }}
                          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                          placeholder="Search for work items by title, key, or ID..."
                          autoFocus
                        />

                        {/* Search results dropdown */}
                        {linkedWorkItemSearch.trim() &&
                          (searchResults.length > 0 || isSearching) && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                              {isSearching ? (
                                <div className="p-3 text-center text-gray-500">
                                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent mx-auto mb-2"></div>
                                  Searching...
                                </div>
                              ) : searchResults.length > 0 ? (
                                <div className="py-1">
                                  {searchResults.map((task) => (
                                    <div
                                      key={task.id}
                                      onClick={() => linkWorkItem(task)}
                                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border border-blue-600 bg-white rounded-sm flex items-center justify-center text-blue-600 text-[10px]">
                                          ✔
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-blue-600">
                                            {task.shortKey || "TASK"}-
                                            {task.id?.substring(0, 5)}{" "}
                                            {task.title}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Status:{" "}
                                            {task.status?.replace("_", " ")} •
                                            ID: {task.id}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-3 text-center text-gray-500">
                                  No work items found matching "
                                  {linkedWorkItemSearch}"
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowLinkedWorkItemForm(false);
                        setLinkedWorkItemSearch("");
                        setSearchResults([]);
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Display existing linked work items */}
              {(linkedWorkItems.length > 0 || showLinkedWorkItemForm) && (
                <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Linked work items ({linkedWorkItems.length})
                    </h4>
                    <button
                      onClick={() => setShowLinkedWorkItemForm(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      + Link item
                    </button>
                  </div>

                  {linkedWorkItems.length > 0 ? (
                    <div className="space-y-2">
                      {linkedWorkItems.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="bg-white border rounded p-3 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-gray-600"
                              >
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path>
                              </svg>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                                {item.linkType}{" "}
                                {item.targetTask?.shortKey || "TASK"}-
                                {item.targetTask?.id?.substring(0, 5)}{" "}
                                {item.targetTask?.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                Status:{" "}
                                {item.targetTask?.status?.replace("_", " ") ||
                                  "Unknown"}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                // Xóa linked work item từ database
                                console.log("Deleting linked work item from database:", item.id);
                                const response = await axios.delete(
                                  `${API_CONFIG.FILE_SERVICE}/api/attachments/${item.id}`
                                );

                                if (response.data?.status === "SUCCESS") {
                                  // Xóa từ local state sau khi xóa thành công từ database
                                  const updatedLinkedItems = linkedWorkItems.filter(
                                    (link) => link.id !== item.id
                                  );
                                  setLinkedWorkItems(updatedLinkedItems);

                                  toast.success("Linked work item removed");
                                  console.log("Linked work item removed from database:", item.id);
                                } else {
                                  toast.error("Failed to remove linked work item");
                                  console.error("API returned error:", response.data);
                                }
                              } catch (error) {
                                console.error("Error removing linked work item:", error);
                                toast.error("Failed to remove linked work item");
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : showWebLinkForm ? null : (
                    <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-2 text-gray-400"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path>
                      </svg>
                      <p className="font-medium">No web links</p>
                      <p className="text-sm mt-1">
                        Add external links and resources
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Web link form section */}
              {showWebLinkForm && (
                <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Add web link
                    </h4>
                    <button
                      onClick={() => {
                        setShowWebLinkForm(false);
                        setWebLinkUrl("");
                        setWebLinkDescription("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="bg-white border rounded p-3 mb-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={webLinkUrl}
                        onChange={(e) => setWebLinkUrl(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        placeholder="https://example.com"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={webLinkDescription}
                        onChange={(e) => setWebLinkDescription(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Link description"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowWebLinkForm(false);
                        setWebLinkUrl("");
                        setWebLinkDescription("");
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addWebLink}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                      disabled={!webLinkUrl.trim()}
                    >
                      Add link
                    </button>
                  </div>
                </div>
              )}

              {/* Display existing web links */}
              {(webLinks.length > 0 || showWebLinkForm) && (
                <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Web links ({webLinks.length})
                    </h4>
                    <button
                      onClick={() => setShowWebLinkForm(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      + Add link
                    </button>
                  </div>

                  {webLinks.length > 0 ? (
                    <div className="space-y-2">
                      {webLinks.map((link, index) => (
                        <div
                          key={link.id || index}
                          className="bg-white border rounded p-3 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-blue-600"
                              >
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M2 12h20"></path>
                                <path d="a15.3 15.3 0 0 1 0-6"></path>
                                <path d="a15.3 15.3 0 0 0 0 6"></path>
                              </svg>
                            </div>
                            <div className="flex-1">
                              {/* Debug: Log the link object structure */}
                              {console.log("🔗 Web link object structure:", link)}
                              <a
                                href={link.fileUrl || link.file_url || link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-blue-600 hover:underline block"
                              >
                                {link.fileUrl || link.file_url || link.url || 'No URL available'}
                              </a>
                              {(link.fileName || link.file_name) && (link.fileName || link.file_name) !== "Web Link" && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {link.fileName || link.file_name}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                // Xóa web link từ database
                                console.log("Deleting web link from database:", link.id);
                                const response = await axios.delete(
                                  `${API_CONFIG.FILE_SERVICE}/api/attachments/${link.id}`
                                );

                                if (response.data?.status === "SUCCESS") {
                                  // Xóa từ local state sau khi xóa thành công từ database
                                  const updatedWebLinks = webLinks.filter(
                                    (item) => item.id !== link.id
                                  );
                                  setWebLinks(updatedWebLinks);

                                  toast.success("Web link removed");
                                  console.log("Web link removed from database:", link.id);
                                } else {
                                  toast.error("Failed to remove web link");
                                  console.error("API returned error:", response.data);
                                }
                              } catch (error) {
                                console.error("Error removing web link:", error);
                                toast.error("Failed to remove web link");
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : showWebLinkForm ? null : (
                    <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-2 text-gray-400"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M2 12h20"></path>
                        <path d="a15.3 15.3 0 0 1 0-6"></path>
                        <path d="a15.3 15.3 0 0 0 0 6"></path>
                      </svg>
                      <p className="font-medium">No web links</p>
                      <p className="text-sm mt-1">
                        Add external links and resources
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Activity section */}
            <div className="mb-8">
              <h3 className="text-base font-semibold mb-2">Activity</h3>
              <div className="flex border-b mb-4">
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === "all"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-700"
                  }`}
                  onClick={() => setActiveTab("all")}
                >
                  All
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === "comments"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-700"
                  }`}
                  onClick={() => setActiveTab("comments")}
                >
                  Comments
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === "history"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-700"
                  }`}
                  onClick={() => setActiveTab("history")}
                >
                  History
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === "worklog"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-700"
                  }`}
                  onClick={() => setActiveTab("worklog")}
                >
                  Work log
                </button>
              </div>

              <div className="mb-4">
                <div className="flex gap-3">
                  {currentUser ? (
                    <UserAvatar user={currentUser} size="sm" />
                  ) : (
                    <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white">
                      NT
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (comment.trim()) {
                            addComment();
                          }
                        }
                      }}
                      placeholder="Add a comment... (Press Enter to send, Shift+Enter for new line)"
                      rows={3}
                      disabled={isAddingComment}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-gray-500">
                        Press Enter to send • Shift+Enter for new line
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="border px-3 py-1 rounded-md text-sm hover:bg-gray-50 transition-colors"
                          onClick={() => setComment("")}
                          disabled={isAddingComment}
                        >
                          Cancel
                        </button>
                        <button
                          className={`px-4 py-1 rounded-md text-sm transition-colors ${
                            isAddingComment || !comment.trim()
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          onClick={addComment}
                          disabled={isAddingComment || !comment.trim()}
                        >
                          {isAddingComment ? "Adding..." : "Comment"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {isLoadingComments ? (
                  <div className="text-center text-gray-500 py-4">
                    Loading comments...
                  </div>
                ) : (
                  organizeComments(comments).map((cmt) => (
                    <div key={cmt.id} className="space-y-3">
                      {/* Parent Comment */}
                      <div className="flex gap-3 group hover:bg-gray-50/50 rounded-lg p-3 -m-3 transition-colors">
                        {/* ✅ Use UserAvatar component for real avatar */}
                        {getUserById(cmt.userId) ? (
                          <UserAvatar user={getUserById(cmt.userId)!} size="sm" className="w-8 h-8" />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                            {getUserInitials(cmt.userId)}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-blue-700">
                                  {getUserDisplayName(cmt.userId)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatCommentDate(cmt.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleReplyClick(cmt.id)}
                                  className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded-md hover:bg-blue-50 transition-all"
                                  title="Reply to comment"
                                >
                                  Reply
                                </button>
                                {currentUser &&
                                  currentUser.id === cmt.userId && (
                                    <button
                                      onClick={() => deleteComment(cmt.id)}
                                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded-md hover:bg-red-50 transition-all"
                                      title="Delete comment"
                                    >
                                      Delete
                                    </button>
                                  )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 leading-relaxed">
                              {cmt.content}
                            </div>
                          </div>

                          {/* Reply Form */}
                          {replyingTo === cmt.id && (
                            <div className="mt-4 ml-4 border-l-4 border-blue-200 bg-blue-50/30 rounded-r-lg py-3 px-4">
                              <div className="flex gap-3">
                                {currentUser ? (
                                  <UserAvatar user={currentUser} size="sm" />
                                ) : (
                                  <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs">
                                    NT
                                  </div>
                                )}
                                <div className="flex-1">
                                  <textarea
                                    className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white shadow-sm"
                                    value={replyText}
                                    onChange={(e) =>
                                      setReplyText(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (replyText.trim()) {
                                          addReply(cmt.id);
                                        }
                                      }
                                      if (e.key === "Escape") {
                                        cancelReply();
                                      }
                                    }}
                                    placeholder="Write a reply... (Press Enter to send, Esc to cancel)"
                                    rows={2}
                                    disabled={isAddingReply}
                                    autoFocus
                                  />
                                  <div className="flex justify-between items-center mt-2">
                                    <div className="text-xs text-gray-500">
                                      Enter to send • Esc to cancel •
                                      Shift+Enter for new line
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        className="border px-3 py-1 rounded-md text-sm hover:bg-gray-50 transition-colors"
                                        onClick={cancelReply}
                                        disabled={isAddingReply}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className={`px-4 py-1 rounded-md text-sm transition-colors ${
                                          isAddingReply || !replyText.trim()
                                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                        }`}
                                        onClick={() => addReply(cmt.id)}
                                        disabled={
                                          isAddingReply || !replyText.trim()
                                        }
                                      >
                                        {isAddingReply
                                          ? "Replying..."
                                          : "Reply"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Replies */}
                          {cmt.replies && cmt.replies.length > 0 && (
                            <div className="mt-4 ml-4 border-l-4 border-green-200 bg-green-50/20 rounded-r-lg py-2 px-4 space-y-3">
                              <div className="text-xs text-green-700 font-medium mb-2">
                                {cmt.replies.length}{" "}
                                {cmt.replies.length === 1 ? "reply" : "replies"}
                              </div>
                              {cmt.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="flex gap-3 group"
                                >
                                  {/* ✅ Use UserAvatar component for real avatar */}
                                  {getUserById(reply.userId) ? (
                                    <UserAvatar user={getUserById(reply.userId)!} size="sm" className="w-7 h-7" />
                                  ) : (
                                    <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-medium shadow-sm">
                                      {getUserInitials(reply.userId)}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="bg-white border border-green-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-green-700">
                                            {getUserDisplayName(reply.userId)}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {formatCommentDate(reply.createdAt)}
                                          </span>
                                        </div>
                                        {currentUser &&
                                          currentUser.id === reply.userId && (
                                            <button
                                              onClick={() =>
                                                deleteComment(reply.id)
                                              }
                                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded-md hover:bg-red-50 transition-all"
                                              title="Delete reply"
                                            >
                                              Delete
                                            </button>
                                          )}
                                      </div>
                                      <div className="text-sm text-gray-700 leading-relaxed">
                                        {reply.content}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar for details */}
          <div className="w-[280px] border-l bg-gray-50 p-4 overflow-y-auto">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-base font-medium">Details</h3>
              <button className="text-gray-500">⚙️</button>
            </div>

            <div className="space-y-6">
              {/* Assignee with integrated dropdown */}
              <div className="mb-3">
                <span className="text-gray-700 block mb-1">Assignee</span>
                <Dropdown
                  placeholder="Unassigned"
                  options={userOptions}
                  onSelect={handleAssigneeChange}
                  defaultValue={currentAssignee}
                  className="w-full text-sm"
                  disabled={isReadOnly}
                />

                <button
                  className="text-blue-600 text-sm mt-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                  onClick={assignToMe}
                  disabled={allUsers.length === 0 || loadingUsers || isReadOnly}
                >
                  Assign to me
                </button>
              </div>

              <div className="mb-3">
                <span className="text-gray-700 block mb-1">Label</span>
                <Input
                  className="w-full text-sm"
                  placeholder="Add a label"
                  value={editedTask.label || ""}
                  onChange={(e) => updateField("label", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>

              {/* Priority with Dropdown component */}
              <div className="mb-3">
                <span className="text-gray-700 block mb-1">Priority</span>
                <Dropdown
                  placeholder="🟡 Medium"
                  options={[
                    "🔴 Highest",
                    "🟠 High", 
                    "🟡 Medium",
                    "🟢 Low",
                    "🔵 Lowest"
                  ]}
                  onSelect={handlePriorityChange}
                  defaultValue={getPriorityDisplayValue(editedTask.priority)}
                  disabled={isReadOnly}
                />
              </div>

              <div className="mb-3">
                <span className="text-gray-700 block mb-1">Due date</span>
                <Input
                  type="date"
                  className="w-full text-sm"
                  value={editedTask.dueDate || ""}
                  onChange={(e) => updateField("dueDate", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>

              {/* Sprint with Dropdown component */}
              <div className="mb-3">
                <span className="text-gray-700 block mb-1">Sprint</span>
                <Dropdown
                  placeholder="None"
                  options={[...sprints.map((s) => s.name)]}
                  onSelect={handleSprintChange}
                  defaultValue={
                    sprints.find((s) => s.id === editedTask.sprintId)?.name ||
                    "None"
                  }
                  disabled={isReadOnly}
                />
              </div>

              {/* Story Point Estimate with AI */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">Story point estimate</span>
                  <button
                    onClick={estimateStoryPoints}
                    disabled={isEstimating}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                      isEstimating
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                    }`}
                    title="Use AI to estimate story points"
                  >
                    {isEstimating ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-purple-600 rounded-full border-t-transparent"></div>
                        <span>Estimating...</span>
                      </>
                    ) : (
                      <>
                        🤖
                        <span>AI Estimate</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="flex-1 text-sm"
                    min={0}
                    value={editedTask.storyPoint || ""}
                    onChange={(e) =>
                      updateField("storyPoint", parseInt(e.target.value))
                    }
                    placeholder="Enter story points"
                  />
                </div>


              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.863-.833-2.633 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">
                  {deleteConfirmMessage}
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeTaskDelete}
                  disabled={isLoadingComments}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoadingComments ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Estimation Modal */}
      {showAIEstimationModal && estimationResult && (
        <AIEstimationModal
          isOpen={showAIEstimationModal}
          onClose={() => setShowAIEstimationModal(false)}
          onAccept={acceptEstimation}
          onReject={rejectEstimation}
          estimationData={estimationResult}
          taskTitle={editedTask.title}
          currentEstimate={editedTask.storyPoint}
        />
      )}
    </div>
  );
}
