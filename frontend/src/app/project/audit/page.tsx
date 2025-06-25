"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { Sidebar } from "@/components/ui/sidebar";
import { TopNavigation } from "@/components/ui/top-navigation";
import { toast } from "sonner";
import { useUserStorage } from "@/hooks/useUserStorage";
import { useNavigation } from "@/contexts/NavigationContext";
import { API_CONFIG } from "@/lib/config";

interface DeletedSprint {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  deletedAt?: string;
  updatedAt?: string;
}

interface DeletedTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  sprintId?: string;
  assigneeId?: string;
  deletedAt?: string;
}

export default function AuditPage() {
  const searchParams = useSearchParams();
  const { userData } = useUserStorage();
  const { currentProjectId } = useNavigation();

  const [deletedSprints, setDeletedSprints] = useState<DeletedSprint[]>([]);
  const [cancelledSprints, setCancelledSprints] = useState<DeletedSprint[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([]);
  const [activeTab, setActiveTab] = useState<"sprints" | "tasks">("sprints");
  const [sprintSubTab, setSprintSubTab] = useState<"deleted" | "cancelled">("deleted");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = searchParams?.get("projectId") || currentProjectId || undefined;
  const userId = userData?.account?.id || userData?.profile?.id;

  useEffect(() => {
    if (!projectId) {
      setError("Không tìm thấy projectId. Vui lòng truy cập từ trang backlog hoặc chọn project.");
      setLoading(false);
      return;
    }
    if (!userId) {
      setError("Không xác định được người dùng. Vui lòng đăng nhập lại.");
      setLoading(false);
      return;
    }
    setError(null);
    fetchAuditData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, userId]);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      // Fetch deleted sprints from Sprints service
      const deletedSprintsResponse = await axios.get(
        `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}/deleted`,
        {
          headers: {
            "X-User-Id": userId
          }
        }
      );
      // Fetch cancelled sprints from Sprints service
      const cancelledSprintsUrl = `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}/cancelled`;
      const cancelledSprintsResponse = await axios.get(
        cancelledSprintsUrl,
        {
          headers: {
            "X-User-Id": userId
          }
        }
      );
      // Parse responses
      if (deletedSprintsResponse.data?.status === "SUCCESS") {
        setDeletedSprints(deletedSprintsResponse.data.data || []);
      } else if (Array.isArray(deletedSprintsResponse.data)) {
        setDeletedSprints(deletedSprintsResponse.data);
      }
      if (cancelledSprintsResponse.data?.status === "SUCCESS") {
        setCancelledSprints(cancelledSprintsResponse.data.data || []);
      } else if (Array.isArray(cancelledSprintsResponse.data)) {
        setCancelledSprints(cancelledSprintsResponse.data);
      }
      setDeletedTasks([]); // Placeholder
    } catch (error: any) {
      console.error("Error fetching audit data:", error);
      setError("Không thể tải dữ liệu audit. Vui lòng thử lại hoặc kiểm tra quyền truy cập.");
      toast.error("Failed to load audit data");
    } finally {
      setLoading(false);
    }
  };

  const restoreSprint = async (sprintId: string) => {
    if (!userId) {
      toast.error("User authentication required");
      return;
    }
    try {
      await axios.put(
        `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprintId}/restore`,
        {},
        {
          headers: {
            "X-User-Id": userId,
            "Content-Type": "application/json"
          }
        }
      );
      toast.success("Sprint restored successfully");
      fetchAuditData(); // Refresh data
    } catch (error: any) {
      console.error("Error restoring sprint:", error);
      if (error?.response?.status === 403) {
        toast.error("Access denied: Only Project Owners can restore sprints");
      } else if (error?.response?.status === 404) {
        toast.error("Sprint not found");
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || "Unknown error";
        toast.error(`Failed to restore sprint: ${errorMessage}`);
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELETED":
        return "bg-red-100 text-red-800 border-red-200";
      case "CANCELLED":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar projectId={projectId ?? undefined} />
        <div className="flex-1 flex flex-col">
          <TopNavigation />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-lg">Loading audit data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar projectId={projectId ?? undefined} />
        <div className="flex-1 flex flex-col">
          <TopNavigation />
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white p-8 rounded shadow text-center">
              <div className="text-red-600 font-semibold mb-2">{error}</div>
              <div className="text-gray-500 text-sm">Nếu bạn là PO/SM, hãy kiểm tra lại quyền truy cập hoặc đăng nhập lại.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar projectId={projectId ?? undefined} />
      <div className="flex-1 flex flex-col">
        <TopNavigation />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Project Audit</h1>
              <p className="text-gray-600">View deleted and cancelled items for audit purposes</p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab("sprints")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "sprints"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Sprints ({deletedSprints.length + cancelledSprints.length})
                </button>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "tasks"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Tasks ({deletedTasks.length})
                </button>
              </nav>
            </div>

            {/* Sprint Tab Content */}
            {activeTab === "sprints" && (
              <div>
                {/* Sprint Sub-tabs */}
                <div className="border-b border-gray-200 mb-4">
                  <nav className="-mb-px flex space-x-4">
                    <button
                      onClick={() => setSprintSubTab("deleted")}
                      className={`py-2 px-3 border-b-2 font-medium text-sm ${
                        sprintSubTab === "deleted"
                          ? "border-red-500 text-red-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Deleted ({deletedSprints.length})
                    </button>
                    <button
                      onClick={() => setSprintSubTab("cancelled")}
                      className={`py-2 px-3 border-b-2 font-medium text-sm ${
                        sprintSubTab === "cancelled"
                          ? "border-yellow-500 text-yellow-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Cancelled ({cancelledSprints.length})
                    </button>
                  </nav>
                </div>

                {/* Sprint Content */}
                <div className="space-y-4">
                  {sprintSubTab === "deleted" && (
                    <>
                      {deletedSprints.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No deleted sprints found
                        </div>
                      ) : (
                        deletedSprints.map((sprint) => (
                          <div key={sprint.id} className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-medium text-gray-900">{sprint.name}</h3>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(sprint.status)}`}>
                                    {sprint.status}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{sprint.goal}</p>
                                <div className="text-xs text-gray-500 mt-2">
                                  Deleted: {formatDate(sprint.deletedAt)}
                                  {sprint.startDate && (
                                    <span className="ml-4">
                                      Duration: {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => restoreSprint(sprint.id)}
                                className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                              >
                                🔄 Restore
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}

                  {sprintSubTab === "cancelled" && (
                    <>
                      {cancelledSprints.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No cancelled sprints found
                          <pre className="text-xs text-left mt-2 bg-gray-100 p-2 rounded max-w-xl mx-auto overflow-x-auto">{JSON.stringify(cancelledSprints, null, 2)}</pre>
                        </div>
                      ) : (
                        cancelledSprints.map((sprint) => (
                          <div key={sprint.id} className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-medium text-gray-900">{sprint.name}</h3>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(sprint.status)}`}>
                                    {sprint.status}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{sprint.goal}</p>
                                <div className="text-xs text-gray-500 mt-2">
                                  Cancelled: {formatDate(sprint.updatedAt)}
                                  {sprint.startDate && (
                                    <span className="ml-4">
                                      Duration: {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => restoreSprint(sprint.id)}
                                className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                              >
                                🔄 Restore
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tasks Tab Content */}
            {activeTab === "tasks" && (
              <div className="text-center py-8 text-gray-500">
                Task audit functionality coming soon...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 