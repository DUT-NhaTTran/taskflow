"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { TopNavigation } from "@/components/ui/top-navigation"
import { Sidebar } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NavigationProgress } from "@/components/ui/LoadingScreen"
import { useNavigation } from "@/contexts/NavigationContext"
import { 
    Calendar, 
    Clock, 
    Users, 
    TrendingUp, 
    AlertCircle, 
    CheckCircle2, 
    BarChart3,
    PieChart,
    Activity,
    Target,
    GitBranch,
    Timer,
    User,
    Plus,
    Filter,
    MoreHorizontal,
    ChevronRight,
    Edit3,
    FileText,
    Bug,
    Zap,
    ChevronDown,
    FolderOpen
} from "lucide-react"
import axios from "axios"
import { 
    PieChart as RechartsPieChart, 
    Cell, 
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Pie
} from 'recharts'
import { DropdownMenu } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { API_CONFIG } from "@/lib/config";

interface Project {
    id: string;
    name: string;
    key: string;
    description?: string;
    projectType?: string;
    access?: string;
    createdAt?: string;
    deadline?: string;
}

interface Sprint {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    goal?: string;
}

interface TaskStats {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    completedLast14Days: number;
    updatedLast14Days: number;
    createdLast14Days: number;
    dueSoon14Days: number;
}

interface ProjectMember {
    id: string;
    username: string;
    email: string;
    roleInProject: string;
    avatar?: string;
}

export default function ProjectSummaryPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { currentProjectId, setCurrentProjectId } = useNavigation()
    
    // Ưu tiên projectId từ context (từ board), sau đó mới lấy từ URL
    const urlProjectId = searchParams?.get("projectId")
    const projectId = currentProjectId || urlProjectId
    
    // Chỉ cập nhật context nếu có URL projectId nhưng context chưa có (backward compatibility)
    useEffect(() => {
        if (urlProjectId && !currentProjectId) {
            setCurrentProjectId(urlProjectId)
        }
    }, [urlProjectId, currentProjectId, setCurrentProjectId])
    
    const [project, setProject] = useState<Project | null>(null)
    const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null)
    const [taskStats, setTaskStats] = useState<TaskStats>({
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
        completedLast14Days: 0,
        updatedLast14Days: 0,
        createdLast14Days: 0,
        dueSoon14Days: 0
    })
    const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // New state for API data
    const [teamWorkload, setTeamWorkload] = useState<any[]>([])
    const [recentActivity, setRecentActivity] = useState<any[]>([])
    const [workTypes, setWorkTypes] = useState<any[]>([])
    const [allTasks, setAllTasks] = useState<any[]>([])
    const [sprintBreakdown, setSprintBreakdown] = useState<any[]>([])
    const [allSprints, setAllSprints] = useState<Sprint[]>([])
    const [priorityData, setPriorityData] = useState([
        { name: 'Highest', value: 0, color: '#dc2626' },
        { name: 'High', value: 0, color: '#ea580c' },
        { name: 'Medium', value: 0, color: '#d97706' },
        { name: 'Low', value: 0, color: '#059669' },
        { name: 'Lowest', value: 0, color: '#0891b2' }
    ])
    const [selectedSprintId, setSelectedSprintId] = useState<string>('all')
    
    // Enhanced state for project selection
    const [userProjects, setUserProjects] = useState<Project[]>([])
    const [showProjectDropdown, setShowProjectDropdown] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [projectSearchQuery, setProjectSearchQuery] = useState("")
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [recentProjects, setRecentProjects] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [errorState, setErrorState] = useState<{ type: string; title: string; message: string; showProjectSelector: boolean } | null>(null)

    useEffect(() => {
        // Get current user from localStorage with multiple fallbacks
        const getUserId = () => {
            return localStorage.getItem("userId") || 
                   localStorage.getItem("currentUserId") || 
                   localStorage.getItem("user_id") ||
                   localStorage.getItem("ownerId") ||
                   "d90e8bd8-72e2-47cc-b9f0-edb92fe60c5a"; // Fallback for testing
        }
        
        const userId = getUserId();
        setCurrentUserId(userId)
        
        if (userId) {
            fetchUserProjects(userId)
        }
        
        if (projectId) {
            fetchProjectData()
            fetchProjectMembers()
            fetchCurrentSprint()
            fetchTaskStatistics()
            fetchAllTasksWithDetails()
            fetchAllSprints()
        } else {
            setIsLoading(false)
        }
    }, [projectId])

    // ✅ NEW: Calculate team workload when both tasks and project members are available
    useEffect(() => {
        if (allTasks.length > 0) {
            calculateTeamWorkload(allTasks)
        }
    }, [allTasks, projectMembers])

    // ✅ UPDATED: Fetch activity when both tasks and project members are available for PO fallback
    useEffect(() => {
        if (allTasks.length > 0 && projectMembers.length > 0) {
            fetchRecentActivity()
        }
    }, [allTasks, projectMembers])

    // Calculate priority breakdown when both tasks and sprints are loaded, or when selected sprint changes
    useEffect(() => {
        if (allTasks.length > 0) {
            calculatePriorityBreakdown(allTasks, selectedSprintId)
        }
    }, [allTasks, allSprints, selectedSprintId])

    // Enhanced project selection tracking
    useEffect(() => {
        // Get recent projects from localStorage
        const recent = localStorage.getItem("recentProjects")
        if (recent) {
            setRecentProjects(JSON.parse(recent))
        }
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showProjectDropdown) {
                setShowProjectDropdown(false)
                setProjectSearchQuery("")
                setSelectedIndex(-1)
            }
        }
        
        if (showProjectDropdown) {
            document.addEventListener('click', handleClickOutside)
        }
        
        return () => {
            document.removeEventListener('click', handleClickOutside)
        }
    }, [showProjectDropdown])

    // Enhanced keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!showProjectDropdown) return

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault()
                    setSelectedIndex(prev => Math.min(prev + 1, filteredProjects.length - 1))
                    break
                case 'ArrowUp':
                    event.preventDefault()
                    setSelectedIndex(prev => Math.max(prev - 1, -1))
                    break
                case 'Enter':
                    event.preventDefault()
                    if (selectedIndex >= 0 && filteredProjects[selectedIndex]) {
                        handleProjectChange(filteredProjects[selectedIndex])
                    }
                    break
                case 'Escape':
                    event.preventDefault()
                    setShowProjectDropdown(false)
                    setProjectSearchQuery("")
                    setSelectedIndex(-1)
                    break
            }
        }

        if (showProjectDropdown) {
            document.addEventListener('keydown', handleKeyDown)
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [showProjectDropdown, selectedIndex, filteredProjects])

    // Filter projects based on search query
    useEffect(() => {
        if (projectSearchQuery.trim() === "") {
            // When no search, show recent projects first, then all projects
            const recentProjectsData = userProjects.filter(p => recentProjects.includes(p.id))
            const otherProjects = userProjects.filter(p => !recentProjects.includes(p.id))
            setFilteredProjects([...recentProjectsData, ...otherProjects])
        } else {
            const filtered = userProjects.filter(project =>
                project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                project.key.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                (project.description && project.description.toLowerCase().includes(projectSearchQuery.toLowerCase()))
            )
            setFilteredProjects(filtered)
        }
        setSelectedIndex(-1) // Reset selection when filtering
    }, [projectSearchQuery, userProjects, recentProjects])

    const fetchProjectData = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}`);
            if (response.data?.status === "SUCCESS" && response.data?.data) {
                setProject(response.data.data);
            } else {
                handleProjectNotFound();
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
                } else {
                    handleNetworkError();
                }
            } else {
                handleUnknownError();
            }
        }
    };

    // Handle different error scenarios with appropriate UI
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

    const fetchProjectMembers = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/users`);
            const users = response.data?.data || [];
            
            const members = users.map((user: any) => ({
                id: user.id,
                username: user.username,
                email: user.email,
                roleInProject: user.roleInProject || 'Member',
                avatar: user.avatar
            }));
            
            setProjectMembers(members);
        } catch (error) {
            setProjectMembers([
                {
                    id: '1',
                    username: 'John Doe',
                    email: 'john@example.com',
                    roleInProject: 'Project Lead'
                },
                {
                    id: '2', 
                    username: 'Jane Smith',
                    email: 'jane@example.com',
                    roleInProject: 'Developer'
                }
            ]);
        }
    }

    const fetchCurrentSprint = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`);
            const sprints = response.data?.data || [];
            const activeSprint = sprints.find((sprint: any) => sprint.status === 'ACTIVE') || sprints[0];
            if (activeSprint) {
                setCurrentSprint(activeSprint);
            }
        } catch (error) {
            setCurrentSprint({
                id: '1',
                name: 'Sprint 1',
                status: 'ACTIVE',
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                goal: 'Complete core features'
            });
        }
    }

    const fetchTaskStatistics = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${projectId}`);
            const tasks = Array.isArray(response.data) ? response.data : [];
            
            // Calculate date thresholds
            const now = new Date();
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            
            // ✅ NEW LOGIC: Count ALL tasks (parents + subtasks) separately
            const parentTasks = tasks.filter((task: any) => !task.parentTaskId);
            const subtasks = tasks.filter((task: any) => task.parentTaskId);
            
            const stats = {
                total: tasks.length, // Count ALL tasks (parent + subtasks)
                todo: tasks.filter((task: any) => task.status === 'TODO').length,
                inProgress: tasks.filter((task: any) => task.status === 'IN_PROGRESS').length,
                done: tasks.filter((task: any) => task.status === 'DONE').length,
                overdue: tasks.filter((task: any) => {
                    if (!task.dueDate) return false;
                    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
                }).length,
                
                // 14-day statistics (count all tasks)
                completedLast14Days: tasks.filter((task: any) => {
                    if (task.status !== 'DONE') return false;
                    const dateToCheck = task.completedAt || task.updatedAt;
                    if (!dateToCheck) return false;
                    const completedDate = new Date(dateToCheck);
                    return completedDate >= fourteenDaysAgo && completedDate <= now;
                }).length,
                
                updatedLast14Days: tasks.filter((task: any) => {
                    if (!task.updatedAt) return false;
                    const updatedDate = new Date(task.updatedAt);
                    return updatedDate >= fourteenDaysAgo && updatedDate <= now;
                }).length,
                
                createdLast14Days: tasks.filter((task: any) => {
                    if (!task.createdAt) return false;
                    const createdDate = new Date(task.createdAt);
                    return createdDate >= fourteenDaysAgo && createdDate <= now;
                }).length,
                
                dueSoon14Days: tasks.filter((task: any) => {
                    if (!task.dueDate || task.status === 'DONE') return false;
                    const dueDate = new Date(task.dueDate);
                    return dueDate >= now && dueDate <= fourteenDaysFromNow;
                }).length
            };
            
            setTaskStats(stats);
        } catch (error) {
            setTaskStats({
                total: 12,
                todo: 4,
                inProgress: 3,
                done: 5,
                overdue: 2,
                completedLast14Days: 3,
                updatedLast14Days: 5,
                createdLast14Days: 1,
                dueSoon14Days: 0
            });
        } finally {
            setIsLoading(false);
        }
    }

    const fetchAllTasksWithDetails = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${projectId}`);
            const tasks = Array.isArray(response.data) ? response.data : [];
            setAllTasks(tasks);
            
            // Calculate work types breakdown based on actual logic
            const totalTasks = tasks.length;
            
            // Count subtasks (tasks with parentTaskId)
            const subtasks = tasks.filter(task => task.parentTaskId !== null && task.parentTaskId !== undefined);
            
            // Count main tasks (tasks without parentTaskId and not specific types)
            const mainTasks = tasks.filter(task => 
                (task.parentTaskId === null || task.parentTaskId === undefined) && 
                task.type !== 'Epic' && 
                task.type !== 'Bug'
            );
            
            // Count epics and bugs based on type
            const epics = tasks.filter(task => task.type === 'Epic');
            const bugs = tasks.filter(task => task.type === 'Bug');
            
            setWorkTypes([
                {
                    name: 'Task',
                    count: mainTasks.length,
                    percentage: totalTasks > 0 ? Math.round((mainTasks.length / totalTasks) * 100) : 0,
                    icon: 'task',
                    color: 'blue'
                },
                {
                    name: 'Subtask',
                    count: subtasks.length,
                    percentage: totalTasks > 0 ? Math.round((subtasks.length / totalTasks) * 100) : 0,
                    icon: 'subtask',
                    color: 'blue'
                }
            ]);
            
            // Calculate team workload
            await calculateTeamWorkload(tasks);
            
            // Fetch recent activity immediately after tasks are loaded
            if (tasks.length > 0) {
                await fetchRecentActivity();
            }
            
        } catch (error) {
            setAllTasks([]);
        }
    }

    const fetchAllSprints = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`);
            const sprints = response.data?.data || [];
            setAllSprints(sprints);
            
        } catch (error) {
            setAllSprints([]);
        }
    }

    const calculateTeamWorkload = async (tasks: any[]) => {
        try {
            // ✅ Count ALL tasks (parents + subtasks) for workload calculation
            const allTasks = tasks;
            
            // Get all assigned tasks
            const assignedTasks = allTasks.filter(task => task.assigneeId);
            const unassignedTasks = allTasks.filter(task => !task.assigneeId);
            
            const assigneeGroups = assignedTasks.reduce((acc: any, task: any) => {
                let assigneeName = 'Unknown User';
                let assigneeAvatar = null;
                let groupKey = task.assigneeId;
                
                // Try to find the actual user in projectMembers first
                const actualAssignee = projectMembers.find(member => member.id === task.assigneeId);
                
                if (actualAssignee) {
                    assigneeName = actualAssignee.username || actualAssignee.email?.split('@')[0] || 'User';
                    assigneeAvatar = actualAssignee.avatar;
                    groupKey = actualAssignee.id;
                } else {
                    // Try using task's assigneeName if it exists and looks valid
                    if (task.assigneeName && 
                        task.assigneeName !== 'Unknown User' && 
                        !task.assigneeName.includes('Unknown') &&
                        task.assigneeName.trim().length > 0) {
                        assigneeName = task.assigneeName;
                        assigneeAvatar = task.assigneeAvatar || null;
                        groupKey = task.assigneeId;
                    } else {
                        // Fallback to Project Owner
                        const projectOwner = projectMembers.find(member => 
                            member.roleInProject === 'OWNER' || 
                            member.roleInProject === 'Project Lead' || 
                            member.roleInProject === 'PRODUCT_OWNER'
                        );
                        
                        if (projectOwner) {
                            assigneeName = projectOwner.username || projectOwner.email?.split('@')[0] || 'Product Owner';
                            assigneeAvatar = projectOwner.avatar;
                            groupKey = `po-fallback-${task.assigneeId}`;
                        } else {
                            assigneeName = 'Product Owner';
                            assigneeAvatar = null;
                            groupKey = `generic-po-${task.assigneeId}`;
                        }
                    }
                }
                
                if (!acc[groupKey]) {
                    acc[groupKey] = {
                        id: groupKey,
                        name: assigneeName,
                        avatar: assigneeAvatar,
                        tasks: []
                    };
                }
                
                acc[groupKey].tasks.push(task);
                return acc;
            }, {});
            
            const totalTasks = allTasks.length;
            const workloadData: any[] = [];
            
            // Add unassigned work
            if (unassignedTasks.length > 0) {
                workloadData.push({
                    id: 'unassigned',
                    name: 'Unassigned',
                    avatar: null,
                    taskCount: unassignedTasks.length,
                    percentage: totalTasks > 0 ? Math.round((unassignedTasks.length / totalTasks) * 100) : 0,
                    isUnassigned: true
                });
            }
            
            // Add assigned work
            Object.values(assigneeGroups).forEach((assignee: any) => {
                workloadData.push({
                    id: assignee.id,
                    name: assignee.name,
                    avatar: assignee.avatar,
                    taskCount: assignee.tasks.length,
                    percentage: totalTasks > 0 ? Math.round((assignee.tasks.length / totalTasks) * 100) : 0,
                    isUnassigned: false
                });
            });
            
            setTeamWorkload(workloadData);
            
        } catch (error) {
            setTeamWorkload([]);
        }
    }
    
    const fetchRecentActivity = async () => {
        try {
            const response = await axios.get(`${API_CONFIG.TASKS_SERVICE}/api/tasks/project/${projectId}/activity`);
            
            const activities = response.data?.data || response.data || [];
            
            if (Array.isArray(activities) && activities.length > 0) {
                // Add timeAgo calculation and PO fallback to each activity
                const activitiesWithTimeAgo = activities.map(activity => {
                    // Find real user info from projectMembers first
                    let userName = 'Unknown User';
                    let userAvatar = null;
                    
                    // Try to find actual user in projectMembers (if activity has userId)
                    if (activity.userId) {
                        const actualUser = projectMembers.find(member => member.id === activity.userId);
                        if (actualUser) {
                            userName = actualUser.username || actualUser.email?.split('@')[0] || 'User';
                            userAvatar = actualUser.avatar;
                            return {
                                ...activity,
                                user: userName,
                                userAvatar: userAvatar,
                                timeAgo: getTimeAgo(activity.timestamp)
                            };
                        }
                    }
                    
                    // Try to find user by name matching if no userId
                    if (activity.user && activity.user !== 'Unknown User') {
                        const userByName = projectMembers.find(member => 
                            member.username === activity.user || 
                            member.email?.split('@')[0] === activity.user ||
                            member.username?.includes(activity.user) ||
                            activity.user.includes(member.username || '')
                        );
                        
                        if (userByName) {
                            userName = userByName.username || userByName.email?.split('@')[0] || 'User';
                            userAvatar = userByName.avatar;
                            return {
                                ...activity,
                                user: userName,
                                userAvatar: userAvatar,
                                timeAgo: getTimeAgo(activity.timestamp)
                            };
                        }
                    }
                    
                    // Use activity.user if it exists and looks valid
                    if (activity.user && 
                        activity.user !== 'Unknown User' && 
                        !activity.user.includes('Unknown') &&
                        activity.user.trim().length > 0) {
                        userName = activity.user;
                        userAvatar = activity.userAvatar || null;
                    } else {
                        // Fallback to Project Owner only as last resort
                        const projectOwner = projectMembers.find(member => 
                            member.roleInProject === 'OWNER' || 
                            member.roleInProject === 'Project Lead' || 
                            member.roleInProject === 'PRODUCT_OWNER'
                        );
                        
                        if (projectOwner) {
                            userName = projectOwner.username || projectOwner.email?.split('@')[0] || 'Product Owner';
                            userAvatar = projectOwner.avatar;
                        } else {
                            // Final fallback to generic PO
                            userName = 'Product Owner';
                            userAvatar = null;
                        }
                    }
                    
                    return {
                        ...activity,
                        user: userName,
                        userAvatar: userAvatar,
                        timeAgo: getTimeAgo(activity.timestamp)
                    };
                });
                
                setRecentActivity(activitiesWithTimeAgo);
            } else {
                // Fallback: generate activity from recent task updates
                if (allTasks.length > 0) {
                    const recentTasks = allTasks
                        .filter(task => task.createdAt || task.updatedAt)
                        .sort((a, b) => {
                            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                            return dateB - dateA;
                        })
                        .slice(0, 5);
                    
                    const activityData = recentTasks.map(task => {
                        // Find real assignee from projectMembers first
                        let userName = 'Unknown User';
                        let userAvatar = null;
                        
                        // Try to find the actual assignee in projectMembers
                        if (task.assigneeId) {
                            const actualAssignee = projectMembers.find(member => member.id === task.assigneeId);
                            if (actualAssignee) {
                                userName = actualAssignee.username || actualAssignee.email?.split('@')[0] || 'User';
                                userAvatar = actualAssignee.avatar;
                                return {
                                    id: task.id,
                                    type: 'task_updated',
                                    user: userName,
                                    userAvatar: userAvatar,
                                    task: task.title,
                                    taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                                    status: task.status,
                                    timestamp: task.updatedAt || task.createdAt,
                                    timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                                };
                            }
                        }
                        
                        // Try to find assignee by name matching
                        if (task.assigneeName && task.assigneeName !== 'Unknown User') {
                            const assigneeByName = projectMembers.find(member => 
                                member.username === task.assigneeName || 
                                member.email?.split('@')[0] === task.assigneeName ||
                                member.username?.includes(task.assigneeName) ||
                                task.assigneeName.includes(member.username || '')
                            );
                            
                            if (assigneeByName) {
                                userName = assigneeByName.username || assigneeByName.email?.split('@')[0] || 'User';
                                userAvatar = assigneeByName.avatar;
                                return {
                                    id: task.id,
                                    type: 'task_updated',
                                    user: userName,
                                    userAvatar: userAvatar,
                                    task: task.title,
                                    taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                                    status: task.status,
                                    timestamp: task.updatedAt || task.createdAt,
                                    timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                                };
                            }
                        }
                        
                        // Use task.assigneeName if it exists and looks valid
                        if (task.assigneeName && 
                            task.assigneeName !== 'Unknown User' && 
                            !task.assigneeName.includes('Unknown') &&
                            task.assigneeName.trim().length > 0) {
                            userName = task.assigneeName;
                            userAvatar = task.assigneeAvatar || null;
                        } else {
                            // Fallback to Project Owner only as last resort
                            const projectOwner = projectMembers.find(member => 
                                member.roleInProject === 'OWNER' || 
                                member.roleInProject === 'Project Lead' || 
                                member.roleInProject === 'PRODUCT_OWNER'
                            );
                            
                            if (projectOwner) {
                                userName = projectOwner.username || projectOwner.email?.split('@')[0] || 'Product Owner';
                                userAvatar = projectOwner.avatar;
                            } else {
                                // Final fallback to generic PO
                                userName = 'Product Owner';
                                userAvatar = null;
                            }
                        }
                        
                        return {
                            id: task.id,
                            type: 'task_updated',
                            user: userName,
                            userAvatar: userAvatar,
                            task: task.title,
                            taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                            status: task.status,
                            timestamp: task.updatedAt || task.createdAt,
                            timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                        };
                    });
                    
                    setRecentActivity(activityData);
                } else {
                    setRecentActivity([]);
                }
            }
        } catch (error) {
            // Fallback: generate activity from recent task updates
            if (allTasks.length > 0) {
                const recentTasks = allTasks
                    .filter(task => task.createdAt || task.updatedAt)
                    .sort((a, b) => {
                        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
                        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
                        return dateB - dateA;
                    })
                    .slice(0, 5);
                
                const activityData = recentTasks.map(task => {
                    // Find real assignee from projectMembers first
                    let userName = 'Unknown User';
                    let userAvatar = null;
                    
                    // Try to find the actual assignee in projectMembers
                    if (task.assigneeId) {
                        const actualAssignee = projectMembers.find(member => member.id === task.assigneeId);
                        if (actualAssignee) {
                            userName = actualAssignee.username || actualAssignee.email?.split('@')[0] || 'User';
                            userAvatar = actualAssignee.avatar;
                            return {
                                id: task.id,
                                type: 'task_updated',
                                user: userName,
                                userAvatar: userAvatar,
                                task: task.title,
                                taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                                status: task.status,
                                timestamp: task.updatedAt || task.createdAt,
                                timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                            };
                        }
                    }
                    
                    // Try to find assignee by name matching
                    if (task.assigneeName && task.assigneeName !== 'Unknown User') {
                        const assigneeByName = projectMembers.find(member => 
                            member.username === task.assigneeName || 
                            member.email?.split('@')[0] === task.assigneeName ||
                            member.username?.includes(task.assigneeName) ||
                            task.assigneeName.includes(member.username || '')
                        );
                        
                        if (assigneeByName) {
                            userName = assigneeByName.username || assigneeByName.email?.split('@')[0] || 'User';
                            userAvatar = assigneeByName.avatar;
                            return {
                                id: task.id,
                                type: 'task_updated',
                                user: userName,
                                userAvatar: userAvatar,
                                task: task.title,
                                taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                                status: task.status,
                                timestamp: task.updatedAt || task.createdAt,
                                timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                            };
                        }
                    }
                    
                    // Use task.assigneeName if it exists and looks valid
                    if (task.assigneeName && 
                        task.assigneeName !== 'Unknown User' && 
                        !task.assigneeName.includes('Unknown') &&
                        task.assigneeName.trim().length > 0) {
                        userName = task.assigneeName;
                        userAvatar = task.assigneeAvatar || null;
                    } else {
                        // Fallback to Project Owner only as last resort
                        const projectOwner = projectMembers.find(member => 
                            member.roleInProject === 'OWNER' || 
                            member.roleInProject === 'Project Lead' || 
                            member.roleInProject === 'PRODUCT_OWNER'
                        );
                        
                        if (projectOwner) {
                            userName = projectOwner.username || projectOwner.email?.split('@')[0] || 'Product Owner';
                            userAvatar = projectOwner.avatar;
                        } else {
                            // Final fallback to generic PO
                            userName = 'Product Owner';
                            userAvatar = null;
                        }
                    }
                    
                    return {
                        id: task.id,
                        type: 'task_updated',
                        user: userName,
                        userAvatar: userAvatar,
                        task: task.title,
                        taskKey: task.shortKey || `TASK-${task.id?.toString().substring(0, 8)}`,
                        status: task.status,
                        timestamp: task.updatedAt || task.createdAt,
                        timeAgo: getTimeAgo(task.updatedAt || task.createdAt)
                    };
                });
                
                setRecentActivity(activityData);
            } else {
                setRecentActivity([]);
            }
        }
    }
    
    const getTimeAgo = (dateString: string) => {
        const now = new Date()
        const date = new Date(dateString)
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
        
        if (diffInHours < 1) return 'just now'
        if (diffInHours < 24) return `${diffInHours} hours ago`
        if (diffInHours < 48) return 'yesterday'
        return `${Math.floor(diffInHours / 24)} days ago`
    }

    const getCompletionPercentage = () => {
        if (taskStats.total === 0) return 0
        return Math.round((taskStats.done / taskStats.total) * 100)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate)
        const now = new Date()
        const diffTime = end.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const fetchUserProjects = async (userId: string) => {
        try {
            setIsLoadingProjects(true);
            
            // Fetch both owned projects and member projects
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                // Get projects where user is owner - FIXED: Use correct API
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/owner/${userId}`),
                // Get projects where user is member
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=&userId=${userId}`)
            ]);

            let allProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled' && ownedResponse.value.data?.data) {
                const ownedProjects = ownedResponse.value.data.data;
                allProjects.push(...ownedProjects);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled' && memberResponse.value.data?.data) {
                const memberProjects = memberResponse.value.data.data;
                allProjects.push(...memberProjects);
            }

            // Remove duplicates by ID (in case user is both owner and member)
            const uniqueProjects = allProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );

            setUserProjects(uniqueProjects);
            setFilteredProjects(uniqueProjects);
            
        } catch (error) {
            setUserProjects([]);
            setFilteredProjects([]);
        } finally {
            setIsLoadingProjects(false);
        }
    }
    
    const handleProjectChange = (selectedProject: Project) => {
        // Update current project in navigation context
        setCurrentProjectId(selectedProject.id);
        
        // Store selected project info in localStorage for sync across pages
        localStorage.setItem("currentProjectId", selectedProject.id);
        localStorage.setItem("currentProjectName", selectedProject.name);
        localStorage.setItem("currentProjectKey", selectedProject.key);
        if (selectedProject.projectType) {
            localStorage.setItem("currentProjectType", selectedProject.projectType);
        }

        // Update recent projects
        const updatedRecent = [selectedProject.id, ...recentProjects.filter(id => id !== selectedProject.id)].slice(0, 5);
        setRecentProjects(updatedRecent);
        localStorage.setItem("recentProjects", JSON.stringify(updatedRecent));
        
        // Navigate to summary of selected project
        router.push(`/project/summary?projectId=${selectedProject.id}`);
        
        // Close dropdown and reset search
        setShowProjectDropdown(false);
        setProjectSearchQuery("");
        setSelectedIndex(-1);
        
        // Reset loading state to fetch new project data
        setIsLoading(true);
    }

    const getProjectTypeIcon = (projectType?: string) => {
        switch (projectType?.toLowerCase()) {
            case 'scrum':
                return '🏃‍♂️';
            case 'kanban':
                return '📋';
            case 'software':
                return '💻';
            default:
                return '📁';
        }
    }

    const getProjectTypeColor = (projectType?: string) => {
        switch (projectType?.toLowerCase()) {
            case 'scrum':
                return 'bg-blue-500';
            case 'kanban':
                return 'bg-green-500';
            case 'software':
                return 'bg-purple-500';
            default:
                return 'bg-gray-500';
        }
    }

    const isRecentProject = (projectId: string) => {
        return recentProjects.includes(projectId);
    }

    const calculatePriorityBreakdown = (tasks: any[], selectedSprintId: string) => {
        try {
            // ✅ Include ALL tasks (parents + subtasks)
            let allTasks = tasks;
            
            // Filter tasks based on selected sprint
            if (selectedSprintId === 'all') {
                // Use all tasks
            } else {
                allTasks = allTasks.filter(task => task.sprintId === selectedSprintId);
            }
            
            const priorityBreakdown = allTasks.reduce((acc: any, task: any) => {
                const priority = task.priority || 'Medium';
                acc[priority] = (acc[priority] || 0) + 1;
                return acc;
            }, {});

            setPriorityData([
                { name: 'Highest', value: priorityBreakdown['HIGHEST'] || 0, color: '#dc2626' },
                { name: 'High', value: priorityBreakdown['HIGH'] || 0, color: '#ea580c' },
                { name: 'Medium', value: priorityBreakdown['MEDIUM'] || 0, color: '#d97706' },
                { name: 'Low', value: priorityBreakdown['LOW'] || 0, color: '#059669' },
                { name: 'Lowest', value: priorityBreakdown['LOWEST'] || 0, color: '#0891b2' }
            ]);
        } catch (error) {
            setPriorityData([
                { name: 'Highest', value: 0, color: '#dc2626' },
                { name: 'High', value: 0, color: '#ea580c' },
                { name: 'Medium', value: 0, color: '#d97706' },
                { name: 'Low', value: 0, color: '#059669' },
                { name: 'Lowest', value: 0, color: '#0891b2' }
            ]);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex">
                <NavigationProgress />
                <Sidebar projectId={projectId || undefined} />
                
                <div className="flex-1 flex flex-col">
                    <TopNavigation />
                    
                    <main className="flex-1 p-6 overflow-y-auto">
                        <div className="flex items-center justify-center h-64">
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="text-gray-600">Loading project summary...</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        )
    }

    // Show error state if there's an error
    if (errorState) {
        return (
            <div className="min-h-screen bg-gray-50 flex">
                <NavigationProgress />
                <Sidebar projectId={projectId || undefined} />
                
                <div className="flex-1 flex flex-col">
                    <TopNavigation />
                    
                    <main className="flex-1 p-6 overflow-y-auto">
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center max-w-lg p-6">
                                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-red-100 rounded-full text-red-500">
                                    {errorState.type === 'not-found' && (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M10 3H3V10H10V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M21 3H14V10H21V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M21 14H14V21H21V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M10 14H3V21H10V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                    {errorState.type === 'server-error' && (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                    {(errorState.type === 'access-denied' || errorState.type === 'network-error' || errorState.type === 'unknown-error') && (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">{errorState.title}</h3>
                                <p className="text-gray-500 mb-4">{errorState.message}</p>
                                
                                {errorState.showProjectSelector && (
                                    <div className="mt-6">
                                        <div className="mb-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">Select another project:</h4>
                                            {userProjects.length > 0 ? (
                                                <div className="max-h-32 overflow-y-auto bg-white border rounded-md">
                                                    {userProjects.map((proj) => (
                                                        <div
                                                            key={proj.id}
                                                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                            onClick={() => handleProjectChange(proj)}
                                                        >
                                                            <div className="flex items-center">
                                                                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600 font-semibold mr-3">
                                                                    {proj.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-sm">{proj.name}</div>
                                                                    <div className="text-xs text-gray-500">{proj.projectType || 'Software'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <p className="text-sm text-gray-500 mb-3">No other projects found</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex gap-2 justify-center">
                                            <Button 
                                                className="bg-blue-600 text-white hover:bg-blue-700"
                                                onClick={() => {
                                                    window.location.href = '/project/view_all_projects';
                                                }}
                                            >
                                                Browse All Projects
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                onClick={() => {
                                                    setErrorState(null);
                                                    setIsLoading(true);
                                                    // Retry loading current project
                                                    if (projectId) {
                                                        fetchProjectData();
                                                    }
                                                }}
                                            >
                                                Retry
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <NavigationProgress />
            <Sidebar projectId={projectId || undefined} />
            
            <div className="flex-1 flex flex-col">
                <TopNavigation />
                
                <main className="flex-1 p-6 overflow-y-auto">
                    {/* Header with Project Selector */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Enhanced Project Selector */}
                                <div className="relative">
                                    <div 
                                        className="group"
                                        title="Click to switch between projects"
                                    >
                                        <Button
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowProjectDropdown(!showProjectDropdown)
                                            }}
                                            className="flex items-center gap-3 min-w-[320px] justify-between h-12 px-4 bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 hover:shadow-md cursor-pointer"
                                            disabled={isLoadingProjects}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${getProjectTypeColor(project?.projectType)} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                    <span className="text-white font-bold text-sm">
                                                        {project?.key || project?.name?.charAt(0)?.toUpperCase() || 'P'}
                                                    </span>
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                                                        {project?.name || 'Select Project'}
                                                        {userProjects.length === 0 && (
                                                            <span className="ml-2 text-xs text-gray-400">(Loading...)</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span>{getProjectTypeIcon(project?.projectType)}</span>
                                                        <span>{project?.projectType || 'Software project'}</span>
                                                        {project?.key && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="font-mono">{project.key}</span>
                                                            </>
                                                        )}
                                                        {userProjects.length > 1 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-blue-600">{userProjects.length} projects</span>
                                                            </>
                                                        )}
                                                        {userProjects.length === 1 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-gray-400">1 project</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {userProjects.length > 1 && (
                                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded hidden group-hover:block">
                                                        Switch
                                                    </span>
                                                )}
                                                {isLoadingProjects ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                                ) : (
                                                    <ChevronDown className={`h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-all duration-200 ${showProjectDropdown ? 'rotate-180' : ''}`} />
                                                )}
                                            </div>
                                        </Button>
                                    </div>
                                    
                                    {showProjectDropdown && (
                                        <>
                                            {/* Enhanced Backdrop */}
                                            <div 
                                                className="fixed inset-0 z-10 bg-black bg-opacity-5 backdrop-blur-sm" 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShowProjectDropdown(false)
                                                    setProjectSearchQuery("")
                                                    setSelectedIndex(-1)
                                                }}
                                            ></div>
                                            
                                            {/* Enhanced Dropdown menu with animations */}
                                            <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden transform transition-all duration-200 animate-in slide-in-from-top-1">
                                                {/* Header with search */}
                                                <div className="p-4 border-b border-gray-100 bg-gray-50">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="font-semibold text-gray-900">Switch Project</h3>
                                                        <div className="flex items-center gap-2">
                                                            {recentProjects.length > 0 && !projectSearchQuery && (
                                                                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                                                    Recent
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                                                {userProjects.length} projects
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Enhanced search input */}
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search projects..."
                                                            value={projectSearchQuery}
                                                            onChange={(e) => setProjectSearchQuery(e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        {projectSearchQuery && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setProjectSearchQuery("")
                                                                }}
                                                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Projects list */}
                                                <div className="max-h-72 overflow-y-auto">
                                                    {userProjects.length === 0 ? (
                                                        <div className="py-8 text-center text-gray-500">
                                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-3"></div>
                                                            <div className="text-sm">Loading projects...</div>
                                                        </div>
                                                    ) : filteredProjects.length > 0 ? (
                                                        <div className="py-2">
                                                            {!projectSearchQuery && recentProjects.length > 0 && (
                                                                <div className="px-4 py-2 text-xs font-medium text-purple-600 bg-purple-50 border-b border-purple-100">
                                                                    Recent Projects
                                                                </div>
                                                            )}
                                                            {filteredProjects.map((proj, index) => (
                                                                <button
                                                                    key={proj.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleProjectChange(proj)
                                                                    }}
                                                                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-all duration-150 ${
                                                                        proj.id === projectId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                                                                    } ${
                                                                        selectedIndex === index ? 'bg-gray-100' : ''
                                                                    }`}
                                                                >
                                                                    <div className={`w-10 h-10 ${getProjectTypeColor(proj.projectType)} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                                        <span className="text-white font-bold text-sm">
                                                                            {proj.key || proj.name.charAt(0).toUpperCase()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`font-semibold truncate ${
                                                                                proj.id === projectId ? 'text-blue-700' : 'text-gray-900'
                                                                            }`}>
                                                                                {proj.name}
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                {isRecentProject(proj.id) && !projectSearchQuery && (
                                                                                    <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Recent</span>
                                                                                )}
                                                                                {proj.id === projectId && (
                                                                                    <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs text-gray-500 truncate mt-1 flex items-center gap-2">
                                                                            <span>{getProjectTypeIcon(proj.projectType)}</span>
                                                                            <span>{proj.projectType || 'Software'}</span>
                                                                            {proj.key && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span className="font-mono">{proj.key}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        {proj.description && (
                                                                            <div className="text-xs text-gray-400 truncate mt-1">
                                                                                {proj.description}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 text-center text-gray-500">
                                                            <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                                            <div className="text-sm">No projects found</div>
                                                            <div className="text-xs mt-1">
                                                                {projectSearchQuery ? `Try a different search term` : 'No projects available'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Enhanced Footer */}
                                                {filteredProjects.length > 0 && (
                                                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                                            <span>
                                                                {filteredProjects.length} of {userProjects.length} projects shown
                                                            </span>
                                                           
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                               
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filter
                                </Button>
                                <Button size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Issue
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Cards Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-full">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{taskStats.completedLast14Days}</div>
                                        <div className="text-sm text-gray-600">completed</div>
                                        <div className="text-xs text-gray-500">in the last 14 days</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-full">
                                        <Edit3 className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{taskStats.updatedLast14Days}</div>
                                        <div className="text-sm text-gray-600">updated</div>
                                        <div className="text-xs text-gray-500">in the last 14 days</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-full">
                                        <FileText className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{taskStats.createdLast14Days}</div>
                                        <div className="text-sm text-gray-600">created</div>
                                        <div className="text-xs text-gray-500">in the last 14 days</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-full">
                                        <Calendar className="h-5 w-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{taskStats.dueSoon14Days}</div>
                                        <div className="text-sm text-gray-600">due soon</div>
                                        <div className="text-xs text-gray-500">in the next 14 days</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Status Overview with Pie Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Status overview</CardTitle>
                                    <CardDescription>
                                        Get a snapshot of the status of your work items. <a href="#" className="text-blue-600 hover:underline">View all work items</a>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="w-48 h-48 relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'To Do', value: taskStats.todo, color: '#ec4899' },
                                                            { name: 'In Progress', value: taskStats.inProgress, color: '#3b82f6' },
                                                            { name: 'Done', value: taskStats.done, color: '#10b981' }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {[
                                                            { name: 'To Do', value: taskStats.todo, color: '#ec4899' },
                                                            { name: 'In Progress', value: taskStats.inProgress, color: '#3b82f6' },
                                                            { name: 'Done', value: taskStats.done, color: '#10b981' }
                                                        ].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <div className="text-3xl font-bold">{taskStats.total}</div>
                                                <div className="text-sm text-gray-600">Total tasks</div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-pink-500 rounded"></div>
                                                <span className="text-sm">To Do: {taskStats.todo}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                                <span className="text-sm">In Progress: {taskStats.inProgress}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                                <span className="text-sm">Done: {taskStats.done}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Priority Breakdown by Sprint */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg">Priority breakdown</CardTitle>
                                            <CardDescription>
                                                Get a breakdown of task priorities by sprint. <a href="#" className="text-blue-600 hover:underline">View all priorities</a>
                                            </CardDescription>
                                        </div>
                                        
                                        {/* Sprint Selector */}
                                        <div className="w-48">
                                            <DropdownMenu
                                                trigger={
                                                    <Button variant="outline" className="w-full justify-between">
                                                        <span>
                                                            {selectedSprintId === 'all' 
                                                                ? 'All Sprints' 
                                                                : selectedSprintId === 'backlog'
                                                                    ? 'Backlog'
                                                                    : allSprints.find(s => s.id === selectedSprintId)?.name || 'Select Sprint'
                                                            }
                                                        </span>
                                                        <ChevronDown className="h-4 w-4" />
                                                    </Button>
                                                }
                                                options={[
                                                    { value: 'all', label: 'All Sprints' },
                                                    { value: 'backlog', label: 'Backlog' },
                                                    ...allSprints.map(sprint => ({
                                                        value: sprint.id,
                                                        label: sprint.name
                                                    }))
                                                ]}
                                                value={selectedSprintId}
                                                onSelect={(value: string) => {
                                                    setSelectedSprintId(value)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsBarChart
                                                data={priorityData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip 
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const value = payload[0].value
                                                            const sprintName = selectedSprintId === 'all' 
                                                                ? 'All Sprints' 
                                                                : selectedSprintId === 'backlog'
                                                                    ? 'Backlog'
                                                                    : allSprints.find(s => s.id === selectedSprintId)?.name || 'Unknown Sprint'
                                                            
                                                            return (
                                                                <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg">
                                                                    <p className="font-semibold text-gray-900">{label} Priority</p>
                                                                    <p className="text-sm text-gray-600">Sprint: {sprintName}</p>
                                                                    <p className="text-sm text-blue-600 font-medium">{value} tasks</p>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }}
                                                />
                                                <Bar 
                                                    dataKey="value" 
                                                    radius={[4, 4, 0, 0]}
                                                >
                                                    {priorityData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    
                                    {/* Priority Legend */}
                                    <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
                                        {priorityData.map((priority) => (
                                            <div key={priority.name} className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded"
                                                    style={{ backgroundColor: priority.color }}
                                                ></div>
                                                <span className="text-sm text-gray-600">
                                                    {priority.name} ({priority.value})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Selected Sprint Info */}
                                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                                        <div className="text-sm text-gray-600">
                                            <span className="font-medium">Current view:</span> {
                                                selectedSprintId === 'all' 
                                                    ? 'All Sprints' 
                                                    : selectedSprintId === 'backlog'
                                                        ? 'Backlog Tasks'
                                                        : allSprints.find(s => s.id === selectedSprintId)?.name || 'Unknown Sprint'
                                            }
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Total tasks: {priorityData.reduce((sum, p) => sum + p.value, 0)}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Team Workload */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Team workload</CardTitle>
                                    <CardDescription>
                                        Monitor the capacity of your team. <a href="#" className="text-blue-600 hover:underline">Reassign work items to get the right balance</a>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Assignee</span>
                                            <span className="text-sm font-medium">Work distribution</span>
                                        </div>
                                        <div className="space-y-3">
                                            {teamWorkload.length > 0 ? (
                                                teamWorkload.map((member) => (
                                                    <div key={member.id} className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 w-32">
                                                            {member.isUnassigned ? (
                                                                <User className="h-4 w-4 text-gray-600" />
                                                            ) : (
                                                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                                                                    {member.avatar ? (
                                                                        <img 
                                                                            src={member.avatar} 
                                                                            alt={member.name} 
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => {
                                                                                // Fallback to initials if image fails to load
                                                                                const target = e.target as HTMLImageElement;
                                                                                target.style.display = 'none';
                                                                                const parent = target.parentElement;
                                                                                if (parent) {
                                                                                    parent.classList.add('bg-green-500', 'text-white');
                                                                                    const initials = member.name
                                                                                        .split(' ')
                                                                                        .map((n: string) => n[0])
                                                                                        .join('')
                                                                                        .slice(0, 2)
                                                                                        .toUpperCase();
                                                                                    parent.textContent = initials;
                                                                                }
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        // Show initials if no avatar
                                                                        member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="text-sm truncate">{member.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                                <div 
                                                                    className="bg-gray-600 h-2 rounded-full" 
                                                                    style={{ width: `${member.percentage}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm text-gray-600 w-12 text-right">
                                                                {member.percentage}% ({member.taskCount})
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-gray-500">
                                                    No workload data available
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Recent Activity */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Recent activity</CardTitle>
                                    <CardDescription>
                                        Stay up to date with what's happening across the project.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {recentActivity.length > 0 ? (
                                            <>
                                                <div className="text-sm font-medium text-gray-700">Recent Updates</div>
                                                <div className="space-y-3">
                                                    {recentActivity.map((activity, index) => (
                                                        <div key={activity.id || index} className="flex items-start gap-3">
                                                            {/* ✅ IMPROVED: Use real avatar if available, fallback to initials */}
                                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                                                                {activity.userAvatar ? (
                                                                    <img 
                                                                        src={activity.userAvatar} 
                                                                        alt={activity.user} 
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            // Fallback to initials if image fails to load
                                                                            const target = e.target as HTMLImageElement;
                                                                            target.style.display = 'none';
                                                                            const parent = target.parentElement;
                                                                            if (parent) {
                                                                                parent.classList.add('bg-green-500', 'text-white');
                                                                                const initials = activity.user
                                                                                    .split(' ')
                                                                                    .map((n: string) => n[0])
                                                                                    .join('')
                                                                                    .slice(0, 2)
                                                                                    .toUpperCase();
                                                                                parent.textContent = initials;
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    // Show initials if no avatar
                                                                    activity.user.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm">
                                                                    <span className="text-blue-600 hover:underline cursor-pointer">{activity.user}</span> updated{" "}
                                                                    <span className="text-blue-600 hover:underline cursor-pointer">📋 {activity.taskKey}: {activity.task}</span>{" "}
                                                                    <Badge variant="outline" className="ml-1">{activity.status}</Badge>
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1">{activity.timeAgo}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500">
                                                <div className="text-sm">No recent activity</div>
                                                <div className="text-xs mt-1">Activity will appear here when team members update tasks</div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Types of Work */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Types of work</CardTitle>
                                    <CardDescription>
                                        Get a breakdown of work items by their types. Shows both parent tasks and subtasks separately. Most tasks are standalone parents, some have 1 subtask. <a href="#" className="text-blue-600 hover:underline">View all items</a>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">Type</span>
                                            <span className="text-sm font-medium text-gray-700">Distribution</span>
                                        </div>
                                        <div className="space-y-4">
                                            {workTypes.length > 0 ? (
                                                workTypes.map((type) => (
                                                    <div key={type.name} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                                                                    {type.icon === 'task' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                                                                    {type.icon === 'subtask' && <div className="text-blue-600 text-lg">📋</div>}
                                                                    {type.icon === 'epic' && <Zap className="h-5 w-5 text-purple-600" />}
                                                                    {type.icon === 'bug' && <Bug className="h-5 w-5 text-red-600" />}
                                                                </div>
                                                                <div>
                                                                    <span className="text-base font-medium text-gray-900">
                                                                {type.name}
                                                            </span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {type.count} {type.count === 1 ? 'item' : 'items'}
                                                        </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 min-w-0 flex-1 ml-6">
                                                                <div className="flex-1 bg-gray-200 rounded-full h-3">
                                                                <div 
                                                                        className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                                                                    style={{ width: `${type.percentage}%` }}
                                                                ></div>
                                                            </div>
                                                                <span className="text-base font-semibold text-gray-900 w-16 text-right">
                                                                    {type.percentage}%
                                                            </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <div className="text-sm">No work type data available</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
} 