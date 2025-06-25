"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/ui/sidebar";
import { TopNavigation } from "@/components/ui/top-navigation";
import { SortDropdown } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Circle,
  MoreHorizontal,
  User,
  Calendar,
  FolderOpen,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { API_CONFIG } from "@/lib/config";

// Types
interface Task {
  id: string;
  title: string;
  description?: string;
  shortKey: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  projectName?: string;
  storyPoint?: number;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

type FilterType = "recent-views" | "assigned-to-me" | "created-by-me" | "done" | "overdue";
type SortType = "updated" | "created" | "due-date" | "status" | "title";

// Badge component
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const Badge = ({ children, variant = "default", className = "" }: BadgeProps) => {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default function AllWorkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get userId from localStorage
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const localUserIds = [
        localStorage.getItem("userId"),
        localStorage.getItem("ownerId"), 
        localStorage.getItem("currentUserId"),
        localStorage.getItem("user_id")
      ];
      
      for (const id of localUserIds) {
        if (id && id.trim()) {
          setUserId(id);
          break;
        }
      }
      
      // Try parsing userInfo object
      if (!userId) {
        const userInfo = localStorage.getItem("userInfo");
        if (userInfo) {
          try {
            const parsed = JSON.parse(userInfo);
            if (parsed.id) {
              setUserId(parsed.id);
            }
          } catch (e) {
            console.warn("Failed to parse userInfo from localStorage");
          }
        }
      }
      
      // Check URL params as fallback  
      const urlUserId = searchParams?.get("userId");
      if (urlUserId && !userId) {
        setUserId(urlUserId);
      }
    }
  }, [searchParams, userId]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("recent-views");
  const [sortBy, setSortBy] = useState<SortType>("updated");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProjectForView, setSelectedProjectForView] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  
  // Get current projectId from localStorage for sidebar
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProjectId = localStorage.getItem("currentProjectId");
      setCurrentProjectId(savedProjectId);
    }
  }, []);

  // Fetch all data

  const fetchAllData = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Fetch projects using the correct API
      const projectsRes = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=&userId=${userId}`);
      const userProjects = Array.isArray(projectsRes.data?.data) ? projectsRes.data.data : [];
      

      
      setProjects(userProjects);
      
      // Fetch tasks from all projects
      const allTasks: Task[] = [];
      for (const project of userProjects) {
        try {
          const tasksRes = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${project.id}`);
          const projectTasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
          
          const tasksWithProjectInfo = projectTasks.map((task: Task) => ({
            ...task,
            projectId: project.id,
            projectName: project.name,
            status: task.status?.toUpperCase().replace(" ", "_") as Task["status"],
            assigneeName: task.assigneeId === userId && !task.assigneeName ? "You" : task.assigneeName
          }));
          
          allTasks.push(...tasksWithProjectInfo);
        } catch (projectErr) {
          console.warn(`Error fetching tasks for project ${project.name}:`, projectErr);
        }
      }
      
      console.log('📋 Total tasks fetched:', allTasks.length);
      // ✅ Enhance tasks with assignee names
      try {
        const { enhanceTasksWithAssigneeNames } = await import('@/utils/taskHelpers');
        const enhancedTasks = await enhanceTasksWithAssigneeNames(allTasks as any);
        setTasks(enhancedTasks as Task[]);
        console.log(`✅ Enhanced ${enhancedTasks.filter(t => t.assigneeId).length} tasks with assignee names in work page`);
      } catch (enhanceError) {
        console.warn('Failed to enhance tasks with assignee names:', enhanceError);
        setTasks(allTasks);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load data");
    }
  }, [userId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Filter tasks based on active filter - memoized
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply project view filter first (if a specific project is selected for viewing)
    if (selectedProjectForView) {
      filtered = filtered.filter(task => task.projectId === selectedProjectForView);
    }

    // Apply main filter
    switch (activeFilter) {
      case "recent-views":
        // For now, show recently updated tasks assigned to user (can be enhanced later)
        filtered = filtered.filter(task => task.assigneeId === userId)
                          .sort((a, b) => {
                            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                            return bTime - aTime;
                          })
                          .slice(0, 20); // Show recent 20 items
        break;
      case "assigned-to-me":
        filtered = filtered.filter(task => task.assigneeId === userId);
        break;
      case "created-by-me":
        // Note: This would need a createdBy field in the API
        filtered = filtered.filter(task => task.assigneeId === userId);
        break;
      case "done":
        // Only show done tasks assigned to current user
        filtered = filtered.filter(task => task.status === "DONE" && task.assigneeId === userId);
        break;
      case "overdue":
        const now = new Date();
        filtered = filtered.filter(task => 
          task.dueDate && new Date(task.dueDate) < now && task.status !== "DONE" && task.assigneeId === userId
        );
        break;
      default:
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.title?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.shortKey?.toLowerCase().includes(searchLower) ||
        task.projectName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply project filter from advanced filters (different from project view filter)
    if (selectedProjects.length > 0) {
      filtered = filtered.filter(task => 
        task.projectId && selectedProjects.includes(task.projectId)
      );
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(task => 
        selectedStatuses.includes(task.status)
      );
    }

    return filtered;
  }, [tasks, selectedProjectForView, activeFilter, userId, searchTerm, selectedProjects, selectedStatuses]);

  // Sort tasks - memoized
  const filteredAndSortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    
    switch (sortBy) {
      case "updated":
        return sorted.sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
      case "created":
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      case "due-date":
        return sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
      case "status":
        return sorted.sort((a, b) => {
          const aStatus = a.status || "";
          const bStatus = b.status || "";
          return aStatus.localeCompare(bStatus);
        });
      case "title":
        return sorted.sort((a, b) => {
          const aTitle = a.title || "";
          const bTitle = b.title || "";
          return aTitle.localeCompare(bTitle);
        });
      default:
        return sorted;
    }
  }, [filteredTasks, sortBy]);

  // Filter stats - memoized
  const filters = useMemo(() => [
    { 
      key: "recent-views", 
      label: "Recent views", 
      count: Math.min(20, tasks.filter(t => t.assigneeId === userId).length)
    },
    { key: "assigned-to-me", label: "Assigned to me", count: tasks.filter(t => t.assigneeId === userId).length },
    { key: "created-by-me", label: "Created by me", count: tasks.filter(t => t.assigneeId === userId).length },
    { key: "done", label: "Done", count: tasks.filter(t => t.status === "DONE" && t.assigneeId === userId).length },
    { key: "overdue", label: "Overdue", count: tasks.filter(t => {
      const now = new Date();
      return t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE" && t.assigneeId === userId;
    }).length }
  ], [tasks, userId]);

  // Get status icon
  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "TODO":
        return <Circle className="h-4 w-4 text-gray-400" />;
      case "IN_PROGRESS":
        return <Circle className="h-4 w-4 text-blue-500 fill-current" />;
      case "REVIEW":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "DONE":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: Task["status"]) => {
    switch (status) {
      case "TODO":
        return <Badge variant="outline">To Do</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "REVIEW":
        return <Badge className="bg-yellow-100 text-yellow-800">Review</Badge>;
      case "DONE":
        return <Badge className="bg-green-100 text-green-800">Done</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "No due date";
    
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    const isToday = date.toDateString() === now.toDateString();
    
    const formatted = date.toLocaleDateString();
    
    if (isOverdue) {
      return <span className="text-red-600 font-medium">{formatted} (Overdue)</span>;
    } else if (isToday) {
      return <span className="text-yellow-600 font-medium">{formatted} (Today)</span>;
    }
    
    return formatted;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar projectId={currentProjectId || undefined} />
      <div className="flex-1 flex flex-col">
        <TopNavigation />
        
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your work</h1>
                <p className="text-gray-600 mt-1">
                  {userId 
                    ? "Tasks assigned to you across all your projects" 
                    : "Please select a user to view their work"
                  }
                </p>
              </div>
              {userId && (
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchAllData}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>

            {/* Search and Filters */}
            {userId && (
              <div className="mt-4 space-y-4">
                {/* Projects Section - Full Width */}
                <div className="w-full">
                  {/* Project Cards - Full Width Grid with Fixed Card Width */}
                  <div className="space-y-4">
                    {/* Projects Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Your Projects ({projects.length + 1})
                      </h3>
                     
                      {projects.length > 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAllProjects(!showAllProjects)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          {showAllProjects ? 'Show Less' : `Show All (${projects.length})`}
                        </Button>
                      )}
                    </div>

                    {/* Projects Grid */}
                    <div className="flex flex-wrap gap-4">
                      {/* All Projects Card */}
                      <div 
                        className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer w-64 h-48 flex-shrink-0 ${
                          selectedProjectForView === null 
                            ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-500' 
                            : 'bg-gray-100 border-gray-300'
                        }`}
                        onClick={() => setSelectedProjectForView(null)}
                      >
                        <div className="flex items-start space-x-3 h-full">
                          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-xs">All</span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col h-full">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              All Projects
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">
                              View tasks from all projects
                            </p>
                            <div className="mt-2 flex-1">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">Total open items</span>
                                  <span className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded-full text-xs font-medium">
                                    {tasks.filter(t => t.status !== "DONE" && t.assigneeId === userId).length}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">Total done items</span>
                                  <span className="text-gray-600 text-xs">
                                    {tasks.filter(t => t.status === "DONE" && t.assigneeId === userId).length}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Project Cards */}
                      {(showAllProjects ? projects : projects.slice(0, 3)).map(project => {
                        const projectTasks = tasks.filter(t => t.projectId === project.id);
                        const openTasks = projectTasks.filter(t => t.status !== "DONE" && t.assigneeId === userId).length;
                        const doneTasks = projectTasks.filter(t => t.status === "DONE" && t.assigneeId === userId).length;
                        const isSelected = selectedProjectForView === project.id;
                        
                        return (
                          <div 
                            key={project.id} 
                            className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer w-64 h-48 flex-shrink-0 ${
                              isSelected 
                                ? 'bg-yellow-100 border-yellow-300 ring-2 ring-yellow-500' 
                                : 'bg-yellow-50 border-yellow-200'
                            }`}
                            onClick={() => setSelectedProjectForView(project.id)}
                          >
                            <div className="flex items-start space-x-3 h-full">
                              {/* Project Icon - Smaller */}
                              <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-medium text-xs">
                                  {project.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              
                              {/* Project Info - Compact */}
                              <div className="flex-1 min-w-0 flex flex-col h-full">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {project.name}
                                </h4>
                                <p className="text-xs text-gray-600 mt-1">
                                  Team-managed software
                                </p>
                                
                                {/* Quick Links - Compact */}
                                <div className="mt-2 flex-1">
                                  <h5 className="text-xs font-medium text-gray-700 mb-1">Quick links</h5>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">My open work items</span>
                                      <span className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded-full text-xs font-medium">
                                        {openTasks}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">Done work items</span>
                                      <span className="text-gray-600 text-xs">{doneTasks}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Board Info - Compact - At bottom */}
                                <div className="pt-2 border-t border-yellow-300 mt-auto">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600">1 board</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        localStorage.setItem("currentProjectId", project.id);
                                        router.push(`/project/project_homescreen?projectId=${project.id}`);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      View Board
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Additional Actions */}
                    {projects.length > 0 && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Showing {showAllProjects ? projects.length : Math.min(3, projects.length)} of {projects.length} projects
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/project/view_all_projects')}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Browse All Projects
                          </Button>
                          
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <SortDropdown
                      value={sortBy}
                      onSelect={(value) => setSortBy(value as SortType)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            {userId && projects.length > 0 && (
              <div className="mt-4 flex items-center space-x-1 border-b">
                {filters.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key as FilterType)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                      activeFilter === filter.key
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>
            )}

            {/* Advanced Filters */}
            {userId && showFilters && projects.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Projects</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {projects.map(project => (
                        <label key={project.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(project.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjects([...selectedProjects, project.id]);
                              } else {
                                setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{project.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <div className="space-y-2">
                      {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map(status => (
                        <label key={status} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{status.replace("_", " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div className="p-6">
            {/* Selected Project Header */}
            {selectedProjectForView && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FolderOpen className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">
                      Viewing tasks from: {projects.find(p => p.id === selectedProjectForView)?.name}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProjectForView(null)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    View All Projects
                  </Button>
                </div>
              </div>
            )}

            {!userId ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full text-gray-400">
                  <User className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No user selected</h3>
                <p className="text-gray-500">Please log in to view your work items.</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 rounded-full text-blue-600">
                  <FolderOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
                <p className="text-gray-500 mb-4">
                  Once you create or join projects, your assigned tasks will appear here.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => router.push('/project/create_project')}
                  >
                    Create Project
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/project/view_all_projects')}
                  >
                    Browse Projects
                  </Button>
                </div>
              </div>
            ) : filteredAndSortedTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full text-gray-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks found</h3>
                <p className="text-gray-500">
                  {activeFilter === "assigned-to-me" 
                    ? "You don't have any tasks assigned to you at the moment."
                    : activeFilter === "recent-views"
                    ? "No recent activity found. Start working on some tasks!"
                    : activeFilter === "done"
                    ? "You haven't completed any tasks yet."
                    : activeFilter === "overdue"
                    ? "Great! You don't have any overdue tasks."
                    : `No tasks match your current filter: ${filters.find(f => f.key === activeFilter)?.label}`
                  }
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assignee
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAndSortedTasks.map((task) => (
                        <tr 
                          key={task.id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            if (task.projectId) {
                              localStorage.setItem("currentProjectId", task.projectId);
                            }
                            router.push(`/project/project_homescreen?projectId=${task.projectId}&taskId=${task.id}`);
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(task.status)}
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {task.title}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {task.shortKey}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <FolderOpen className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">{task.projectName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(task.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                              {formatDate(task.dueDate)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <User className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">
                                {task.assigneeId === userId ? "You" : (task.assigneeName || "Unassigned")}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}