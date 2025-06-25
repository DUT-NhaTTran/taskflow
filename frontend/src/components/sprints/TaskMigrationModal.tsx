"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_CONFIG } from "@/lib/config";
import { useUserStorage } from "@/hooks/useUserStorage";

interface Task {
  id: string;
  title: string;
  status: string;
  storyPoint?: number;
}

interface Sprint {
  id: string;
  name: string;
  status: string;
}

interface TaskMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprintId: string;
  sprintName: string;
  projectId: string;
  onComplete: () => void;
  action: "cancel" | "delete";
}

export function TaskMigrationModal({
  isOpen,
  onClose,
  sprintId,
  sprintName,
  projectId,
  onComplete,
  action
}: TaskMigrationModalProps) {
  const { userData } = useUserStorage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [globalChoice, setGlobalChoice] = useState<"backlog" | "sprint" | "keep">("backlog");
  const [targetSprintId, setTargetSprintId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
//   Lấy danh sách incomplete tasks trong sprint sắp bị cancel/delete
// Lấy danh sách sprints khả dụng để di chuyển tasks
  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, sprintId]);

  const fetchData = async () => {
    try {
      setFetching(true);
      const userId = userData?.account?.id || userData?.profile?.id;
      
      const [tasksRes, sprintsRes] = await Promise.all([
        axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprintId}/incomplete-tasks`, {
          headers: { "X-User-Id": userId }
        }),
        axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`, {
          headers: { "X-User-Id": userId }
        })
      ]);

      // Handle tasks response
      const tasksData = tasksRes.data?.status === "SUCCESS" ? tasksRes.data.data : tasksRes.data;
      setTasks(tasksData || []);

      // Handle sprints response - only active/not-started sprints except current one
      const sprintsData = sprintsRes.data?.data || sprintsRes.data;
      const availableSprints = (sprintsData || []).filter((s: Sprint) => 
        s.id !== sprintId && (s.status === "NOT_STARTED" || s.status === "ACTIVE")
      );
      setSprints(availableSprints);
      
    } catch (error) {
      toast.error("Failed to load migration options");
    } finally {
      setFetching(false);
    }
  };

  const handleMigration = async () => {
    try {
      setLoading(true);
      const userId = userData?.account?.id || userData?.profile?.id;

      // ✅ DEBUG: Log user info and permissions
      console.log('🔍 TaskMigrationModal DEBUG:', {
        userData: userData,
        userId: userId,
        userDataAccount: userData?.account,
        userDataProfile: userData?.profile,
        action: action,
        sprintId: sprintId
      });

      if (!userId) {
        toast.error("User ID not found. Please log in again.");
        return;
      }

      // ✅ DEBUG: Check user permissions before delete/cancel
      try {
        console.log('🔍 Checking user permissions...');
        const permissionsResponse = await axios.get(
          `${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members/${userId}/permissions`,
          { headers: { "X-User-Id": userId } }
        );
        console.log('🔍 User permissions:', permissionsResponse.data);
      } catch (permError: any) {
        console.error('❌ Permission check failed:', permError?.response?.data);
      }

      const taskIds = tasks.map(task => task.id);

      // Step 1: Migrate tasks based on choice
      if (globalChoice === "backlog" && taskIds.length > 0) {
        await axios.put(
          `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/move-specific-tasks-to-backlog`,
          { taskIds },
          { headers: { "X-User-Id": userId, "Content-Type": "application/json" } }
        );
        toast.success(`${taskIds.length} tasks moved to backlog`);
      } else if (globalChoice === "sprint" && targetSprintId && taskIds.length > 0) {
        await axios.put(
          `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/move-specific-tasks-to-sprint/${targetSprintId}`,
          { taskIds },
          { headers: { "X-User-Id": userId, "Content-Type": "application/json" } }
        );
        const targetSprint = sprints.find(s => s.id === targetSprintId);
        toast.success(`${taskIds.length} tasks moved to ${targetSprint?.name}`);
      } else if (globalChoice === "keep" && taskIds.length > 0) {
        toast.info(`${taskIds.length} tasks will remain in the ${action === "cancel" ? "cancelled" : "deleted"} sprint`);
      }

      // Step 2: Cancel or delete the sprint
      const endpoint = action === "cancel" ? "cancel" : "soft-delete";
      
      // ✅ DEBUG: Log API call details before making the request
      console.log('🚀 Making API call:', {
        method: 'PUT',
        url: `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprintId}/${endpoint}`,
        headers: { "X-User-Id": userId, "Content-Type": "application/json" },
        body: {}
      });
      
      await axios.put(
        `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprintId}/${endpoint}`,
        {},
        { headers: { "Content-Type": "application/json" } }
      );
      
      toast.success(`Sprint ${action}${action === "cancel" ? "l" : "d"}ed successfully`);
      onComplete();
      onClose();
      
    } catch (error: any) {
      // ✅ DEBUG: Enhanced error logging
      console.error('❌ TaskMigrationModal Error:', {
        error: error,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        headers: error?.response?.headers,
        config: error?.config
      });
      
      if (error?.response?.status === 403) {
        const message = error?.response?.data?.message || error?.response?.data?.error;
        toast.error(`Access denied: ${message || 'Permission check failed'}`);
      } else {
        toast.error(`Failed to ${action} sprint: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isFormValid = globalChoice === "sprint" ? targetSprintId : true;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {action === "cancel" ? "Cancel" : "Delete"} Sprint: {sprintName}
            </h3>
            
            {fetching ? (
              <div className="text-center py-4 text-gray-500">Loading tasks...</div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  This sprint has {tasks.length} incomplete task(s). Choose what to do with them:
                </p>
                
                {tasks.length > 0 && (
                  <>
                    {/* Task List Preview */}
                    <div className="mb-4 p-3 bg-gray-50 rounded border max-h-32 overflow-y-auto">
                      {tasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="text-sm text-gray-600 py-1">
                          • {task.title} ({task.status})
                          {task.storyPoint && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                              {task.storyPoint}pts
                            </span>
                          )}
                        </div>
                      ))}
                      {tasks.length > 3 && (
                        <div className="text-sm text-gray-500 italic">
                          ...and {tasks.length - 3} more tasks
                        </div>
                      )}
                    </div>

                    {/* Migration Options */}
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="migration"
                          value="backlog"
                          checked={globalChoice === "backlog"}
                          onChange={(e) => setGlobalChoice(e.target.value as any)}
                          className="mr-3"
                        />
                        <span className="text-sm">Move all tasks to Backlog</span>
                      </label>
                      
                      <label className="flex items-start">
                        <input
                          type="radio"
                          name="migration"
                          value="sprint"
                          checked={globalChoice === "sprint"}
                          onChange={(e) => setGlobalChoice(e.target.value as any)}
                          className="mr-3 mt-1"
                          disabled={sprints.length === 0}
                        />
                        <div className="flex-1">
                          <span className="text-sm">Move all tasks to another Sprint:</span>
                          {globalChoice === "sprint" && (
                            <select
                              value={targetSprintId}
                              onChange={(e) => setTargetSprintId(e.target.value)}
                              className="ml-2 mt-1 px-2 py-1 border border-gray-300 rounded text-sm w-full"
                              disabled={sprints.length === 0}
                            >
                              <option value="">Choose sprint...</option>
                              {sprints.map((sprint) => (
                                <option key={sprint.id} value={sprint.id}>
                                  {sprint.name} ({sprint.status})
                                </option>
                              ))}
                            </select>
                          )}
                          {sprints.length === 0 && (
                            <span className="block mt-1 text-xs text-gray-500">No available sprints</span>
                          )}
                        </div>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="migration"
                          value="keep"
                          checked={globalChoice === "keep"}
                          onChange={(e) => setGlobalChoice(e.target.value as any)}
                          className="mr-3"
                        />
                        <span className="text-sm">Keep tasks in {action === "cancel" ? "cancelled" : "deleted"} sprint</span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMigration}
              disabled={loading || fetching || !isFormValid}
              className={`px-4 py-2 rounded-md text-white disabled:bg-gray-400 disabled:cursor-not-allowed ${
                action === "cancel" 
                  ? "bg-yellow-600 hover:bg-yellow-700" 
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Processing..." : `${action === "cancel" ? "Cancel" : "Delete"} Sprint`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 