"use client"

import React, { useState, useEffect, useRef } from "react"
import { Bell, Check, X, MoreHorizontal, Settings, Circle, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import axios from "axios"
import { formatDistanceToNow, format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { API_CONFIG } from "@/lib/config"

interface Notification {
    id: string
    type: 'TASK_ASSIGNED' | 'TASK_REASSIGNED' | 'TASK_UPDATED' | 'TASK_COMMENT' | 'TASK_CREATED' | 'TASK_DELETED' | 'TASK_MOVED' | 'TASK_STATUS_CHANGED' | 'PROJECT_INVITE' | 'PROJECT_DELETED' | 'SPRINT_UPDATED' | 'SPRINT_CREATED' | 'SPRINT_STARTED' | 'SPRINT_COMPLETED' | 'TASK_MENTIONED' | 'MENTIONED_IN_COMMENT' | 'FILE_ATTACHED' | 'TAGGED_IN_TASK' | 'REMINDER'
    title: string
    message: string
    recipientUserId: string
    actorUserId?: string
    actorUserName?: string
    actorUserAvatar?: string
    projectId?: string
    projectName?: string
    taskId?: string
    sprintId?: string
    commentId?: string
    actionUrl?: string
    isRead: boolean
    createdAt: string
    readAt?: string
}

interface NotificationDropdownProps {
    userId: string
}

// Simple time formatting - add 7 hours to server time and show "recent" if too close
const formatTimeAgo = (dateString: string): string => {
    try {
        // Parse server timestamp and add 7 hours (convert to VN local time for comparison)
        const serverDate = new Date(dateString)
        const adjustedDate = new Date(serverDate.getTime() + (7 * 60 * 60 * 1000)) // Add 7 hours
        const now = new Date()
        
        const minutesAgo = differenceInMinutes(now, adjustedDate)
        const hoursAgo = differenceInHours(now, adjustedDate)
        const daysAgo = differenceInDays(now, adjustedDate)
        
        if (minutesAgo < 30) {
            return "Vừa xong"
        } else if (minutesAgo < 60) {
            return `${minutesAgo} phút trước`
        } else if (hoursAgo < 24) {
            return `${hoursAgo} giờ trước`
        } else if (daysAgo === 1) {
            return "Hôm qua"
        } else if (daysAgo < 7) {
            return `${daysAgo} ngày trước`
        } else {
            // Show exact date for older notifications
            return format(adjustedDate, "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })
        }
    } catch (error) {
        console.error("Error formatting time:", error)
        return "Thời gian không xác định"
    }
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('all')
    const [previousNotificationCount, setPreviousNotificationCount] = useState(0)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const router = useRouter()

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    // Get user ID from localStorage - simplified and reliable
    const getUserId = (): string | null => {
        // If userId is provided directly, use it
        if (userId) {
            return userId;
        }
        
        const possibleKeys = ["ownerId", "userId", "currentUserId", "user_id", "id"]
        
        for (const key of possibleKeys) {
            const value = localStorage.getItem(key)
            if (value) {
                return value
            }
        }
        
        return null
    }

   
    // Simple refresh function
    const handleSimpleRefresh = () => {
        setIsRefreshing(true)
        // Clear current notifications to force complete refresh
        setNotifications([])
        setUnreadCount(0)
        // Set a small timeout to ensure UI shows loading state
        setTimeout(() => {
            fetchDirectFromDatabase(true)
        }, 100)
    }
    
    // Load notifications on mount and set up polling
    useEffect(() => {
        // Set current user ID once on mount
        const userId = getUserId();
        setCurrentUserId(userId);
        
        // Initial fetch
        fetchDirectFromDatabase()
        
        // Set up polling interval for realtime updates - 5 seconds
        const interval = setInterval(() => {
            fetchDirectFromDatabase()
        }, 5000) // Poll every 5 seconds as requested
        
        // Save interval reference for cleanup
        pollingIntervalRef.current = interval;
        
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [])
    
    // Force refresh when dropdown is opened
    useEffect(() => {
        if (isOpen) {
            fetchDirectFromDatabase(true)
        }
    }, [isOpen])

    // Mark single notification as read
    const markAsRead = async (notificationId: string) => {
        try {
            const userId = getUserId();
            if (!userId) {
                console.error("No user ID found for marking notification as read")
                return
            }
            
            console.log(`Marking notification ${notificationId} as read`)
            console.log("Using userId:", userId)
            
            const response = await axios.patch(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/${notificationId}/read`, {}, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })
            
            console.log("Mark as read response:", response.status, response.data)
            
            // Update local state
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notificationId ? { ...n, isRead: true } : n
                )
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
            
        } catch (error: any) {
            // Don't log notification read errors to avoid console spam
            if (error.response?.status !== 404) {
                console.log("📝 Failed to mark notification as read - ignoring gracefully");
            }
        }
    }

    // Mark all notifications as read
    const markAllAsRead = async () => {
        try {
            if (unreadCount === 0) {
                toast.info("No unread notifications to mark")
                return
            }

            const unreadNotifications = notifications.filter(n => !n.isRead)
            const markPromises = unreadNotifications.map(notification =>
                fetch(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/${notification.id}/read`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                })
            )

            await Promise.all(markPromises)

            // Update local state
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)

            toast.success(`Marked ${unreadNotifications.length} notifications as read`)
        } catch (error) {
            // Don't log notification errors to avoid console spam
            console.log("📝 Failed to mark all notifications as read - ignoring gracefully");
        }
    }

    // Handle accepting project invitation
    const handleAcceptInvitation = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation()
        
        if (!notification.projectId) {
            toast.error("Project ID not found in invitation")
            return
        }

        try {
            console.log("🎯 Starting accept invitation process...")
            
            // Add user to project members
            const response = await axios.post(`/api/projects/${notification.projectId}/members`, {
                userId: getUserId()
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })

            console.log("✅ Add member response:", response.status, response.data)

            if (response.status === 200 || response.status === 201) {
                // Send accept notification back to project owner with standard format
                console.log("📤 Sending accept notification...")
                await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, {
                    type: "PROJECT_INVITE",
                    title: "Invitation Accepted! 🎉",
                    message: `${notification.recipientUserId} has joined your project "${notification.projectName}"`,
                    recipientUserId: notification.actorUserId,
                    actorUserId: getUserId(),
                    actorUserName: "Project Member", // You might want to get actual username here
                    projectId: notification.projectId,
                    projectName: notification.projectName,
                    taskId: null // No task associated with invitation response
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                })

                console.log("✅ Accept notification sent successfully")
                
                // Delete the invitation notification (no need to mark as read)
                console.log("🗑️ Deleting invitation notification...")
                await deleteNotification(notification.id)

                toast.success(`Successfully joined project "${notification.projectName}"!`)
                
                // Refresh notifications to update UI
                console.log("🔄 Refreshing notifications...")
                fetchDirectFromDatabase(true)
            }
        } catch (error: any) {
            console.error("❌ Error accepting invitation:", error)
            
            // Simple duplicate check
            const isDuplicateError = error && error.response && 
                (error.response.status === 409 || 
                 (error.response.status === 500 && 
                  String(error.response.data || '').includes("duplicate key")))
            
            if (isDuplicateError) {
                console.log("ℹ️ User already member, deleting notification...")
                toast.info("You are already a member of this project")
                
                // Delete notification since user is already member
                await deleteNotification(notification.id)
                
                // Still refresh to update UI
                fetchDirectFromDatabase(true)
            } else {
                // Don't show error toast to avoid exposing technical errors
                console.log("📝 Failed to accept invitation - handling gracefully");
            }
        }
    }

    // Handle declining project invitation  
    const handleDeclineInvitation = async (notification: Notification, e: React.MouseEvent) => {
        e.stopPropagation()

        try {
            // Send decline notification back to project owner with standard format
            await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, {
                type: "PROJECT_INVITE",
                title: "Invitation Declined",
                message: `${notification.recipientUserId} has declined to join your project "${notification.projectName}"`,
                recipientUserId: notification.actorUserId,
                actorUserId: getUserId(),
                actorUserName: "Project Member", // You might want to get actual username here  
                projectId: notification.projectId,
                projectName: notification.projectName,
                taskId: null // No task associated with invitation response
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })

            // Delete the invitation notification (no need to mark as read)
            await deleteNotification(notification.id)

            toast.info(`Declined invitation to project "${notification.projectName}"`)
            
            // Refresh notifications to update UI
            fetchDirectFromDatabase(true)
        } catch (error: any) {
            console.log("📝 Failed to decline invitation - handling gracefully");
        }
    }

    const deleteNotification = async (notificationId: string) => {
        try {
            await axios.delete(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/${notificationId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })
            setNotifications(prev => prev.filter(n => n.id !== notificationId))
            const deletedNotification = notifications.find(n => n.id === notificationId)
            if (deletedNotification && !deletedNotification.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1))
            }
        } catch (error) {
            // Don't log notification deletion errors to avoid console spam
            console.log("📝 Failed to delete notification - ignoring gracefully");
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        // Don't allow clicking on PROJECT_DELETED notifications since the project no longer exists
        if (notification.type === 'PROJECT_DELETED') {
            return;
        }
        
        if (!notification.isRead) {
            markAsRead(notification.id)
        }
        
        // Debug logging to see what actionUrl we have
        console.log('🔍 NOTIFICATION CLICK DEBUG:', {
            notificationId: notification.id,
            type: notification.type,
            actionUrl: notification.actionUrl,
            projectId: notification.projectId,
            taskId: notification.taskId,
            hasActionUrl: !!notification.actionUrl
        })
        
        // Navigate using the action URL from backend (already has correct format)
        if (notification.actionUrl) {
            console.log('✅ Using actionUrl from backend:', notification.actionUrl)
            router.push(notification.actionUrl)
        } else if (notification.projectId) {
            // Fallback: navigate to project homescreen if no actionUrl but has projectId
            const fallbackUrl = notification.taskId 
                ? `/project/project_homescreen?projectId=${notification.projectId}&taskId=${notification.taskId}&from=notification`
                : `/project/project_homescreen?projectId=${notification.projectId}&from=notification`;
            console.log('⚠️ Using fallback URL (no actionUrl from backend):', fallbackUrl)
            router.push(fallbackUrl)
        } else {
            console.error('❌ No actionUrl or projectId available for navigation')
        }
        
        setIsOpen(false)
    }

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'TASK_ASSIGNED':
            case 'TASK_REASSIGNED':
                return '👤'
            case 'TASK_UPDATED':
            case 'TASK_STATUS_CHANGED':
            case 'TASK_MOVED':
                return '🔄'
            case 'TASK_COMMENT':
            case 'MENTIONED_IN_COMMENT':
                return '💬'
            case 'TASK_CREATED':
                return '✅'
            case 'TASK_DELETED':
                return '🗑️'
            case 'PROJECT_INVITE':
            case 'PROJECT_DELETED':
                return '📋'
            case 'SPRINT_UPDATED':
            case 'SPRINT_CREATED':
            case 'SPRINT_STARTED':
            case 'SPRINT_COMPLETED':
                return '🏃‍♂️'
            case 'TASK_MENTIONED':
            case 'TAGGED_IN_TASK':
                return '🏷️'
            case 'FILE_ATTACHED':
                return '📎'
            case 'REMINDER':
                return '⏰'
            default:
                return '📢'
        }
    }

    const getNotificationColor = (type: Notification['type']) => {
        switch (type) {
            case 'TASK_ASSIGNED':
            case 'TASK_REASSIGNED':
                return 'bg-blue-500'
            case 'TASK_UPDATED':
            case 'TASK_STATUS_CHANGED':
            case 'TASK_MOVED':
                return 'bg-green-500'
            case 'TASK_COMMENT':
            case 'MENTIONED_IN_COMMENT':
                return 'bg-purple-500'
            case 'TASK_CREATED':
                return 'bg-emerald-500'
            case 'TASK_DELETED':
                return 'bg-red-500'
            case 'PROJECT_INVITE':
            case 'PROJECT_DELETED':
                return 'bg-orange-500'
            case 'SPRINT_UPDATED':
            case 'SPRINT_CREATED':
            case 'SPRINT_STARTED':
            case 'SPRINT_COMPLETED':
                return 'bg-indigo-500'
            case 'TASK_MENTIONED':
            case 'TAGGED_IN_TASK':
                return 'bg-pink-500'
            case 'FILE_ATTACHED':
                return 'bg-amber-500'
            case 'REMINDER':
                return 'bg-yellow-500'
            default:
                return 'bg-gray-500'
        }
    }

    const filteredNotifications = selectedTab === 'unread' 
        ? notifications.filter(n => !n.isRead)
        : notifications

    // Fetch notifications directly from database - realtime approach
    const fetchDirectFromDatabase = async (forceRefresh = false) => {
        // Show loading state only when manually refreshing or force refresh
        if (isRefreshing || forceRefresh) {
            setIsLoading(true)
        }
        
        try {
            // Get current user ID
            const userId = getUserId()
            if (!userId) {
                console.error("No user ID found")
                return
            }
            
            // Set current user ID if not already set
            if (!currentUserId) {
                setCurrentUserId(userId)
            }
            
            // Create a completely unique URL to bypass all caching
            const timestamp = Date.now()
            const url = `${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/user/${userId}?t=${timestamp}&refresh=${forceRefresh ? 'true' : 'false'}`
            
            console.log("Fetching notifications from:", url)
            
            // Make a direct fetch call with timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for manual refresh
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'X-Force-Refresh': forceRefresh ? 'true' : 'false'
                    },
                    cache: 'no-store',
                    signal: controller.signal
                })
                
                clearTimeout(timeoutId)
                
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`)
                }
                
                // Parse JSON response
                const data = await response.json()
                
                // Extract notifications from response
                let fetchedNotifications = []
                if (Array.isArray(data)) {
                    fetchedNotifications = data
                } else if (data?.data && Array.isArray(data.data)) {
                    fetchedNotifications = data.data
                } else {
                    console.error("Unexpected response format:", data)
                    return
                }
                
                // Sort by creation date in descending order to ensure newest first
                fetchedNotifications.sort((a: Notification, b: Notification) => {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                })
                
                // Log the number of notifications received
                
                // Update state
                setNotifications(fetchedNotifications)
                const newUnreadCount = fetchedNotifications.filter((n: Notification) => !n.isRead).length
                setUnreadCount(newUnreadCount)
                
                // Show notification for new unread items if dropdown is not open
                if (!isOpen && newUnreadCount > unreadCount && unreadCount > 0) {
                    toast.info('You have ${newUnreadCount - unreadCount} new notification(s)')
                }
                
                if (isRefreshing || forceRefresh) {
                    toast.success(`Loaded ${fetchedNotifications.length} notifications`)
                }
                
                console.log(`Successfully loaded ${fetchedNotifications.length} notifications (${newUnreadCount} unread)`)
            } catch (fetchError: any) {
                clearTimeout(timeoutId)
                // Check if this is an abort error (timeout)
                if (fetchError.name === 'AbortError') {
                    console.log("📝 Request timed out after 10 seconds - handling gracefully");
                    // Don't show error toast to avoid bothering users
                } else {
                    throw fetchError // rethrow for outer catch
                }
            }
        } catch (error: any) {
            // Don't log notification fetch errors to avoid console spam
            console.log("📝 Failed to fetch notifications - showing empty state gracefully");
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && (
                    <Badge 
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center p-0 border-2 border-white"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                )}
            </button>

            {/* Notification Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[600px] overflow-hidden">
                    {/* Header with tabs and actions */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-1">
                            <button
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    selectedTab === 'all'
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                                onClick={() => setSelectedTab('all')}
                            >
                                All ({notifications.length})
                            </button>
                            <button
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    selectedTab === 'unread'
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                                onClick={() => setSelectedTab('unread')}
                            >
                                Unread ({unreadCount})
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            
                            
                            {/* Manual refresh button */}
                            <button
                                onClick={() => {
                                    handleSimpleRefresh()
                                }}
                                disabled={isRefreshing}
                                className={`p-1 rounded-md transition-colors ${
                                    isRefreshing
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                                title="Refresh notifications"
                            >
                                <svg 
                                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2} 
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                                    />
                                </svg>
                            </button>
                            
                            {/* Mark all as read button */}
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-2"></div>
                                <p className="text-gray-500">Loading notifications...</p>
                            </div>
                        ) : filteredNotifications.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {filteredNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 transition-colors group ${
                                            notification.type === 'PROJECT_INVITE' || notification.type === 'PROJECT_DELETED' 
                                                ? 'cursor-default opacity-75' 
                                                : 'cursor-pointer hover:bg-gray-50'
                                        } ${
                                            !notification.isRead ? 'bg-blue-50' : ''
                                        }`}
                                        onClick={notification.type === 'PROJECT_INVITE' || notification.type === 'PROJECT_DELETED' ? undefined : () => handleNotificationClick(notification)}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`w-10 h-10 ${getNotificationColor(notification.type)} rounded-full flex items-center justify-center text-white flex-shrink-0`}>
                                                <span className="text-lg">
                                                    {getNotificationIcon(notification.type)}
                                                </span>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                            {notification.title}
                                                        </p>
                                                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                            <span>{formatTimeAgo(notification.createdAt)}</span>
                                                            {notification.projectName && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{notification.projectName}</span>
                                                                </>
                                                            )}
                                                            {notification.type === 'PROJECT_DELETED' && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-red-500 font-medium">Project no longer exists</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Accept/Decline buttons for PROJECT_INVITE */}
                                                        {notification.type === 'PROJECT_INVITE' && !notification.isRead && (
                                                            <div className="flex items-center gap-2 mt-3">
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-green-500 hover:bg-green-600 text-white h-7 px-3 text-xs"
                                                                    onClick={(e) => handleAcceptInvitation(notification, e)}
                                                                >
                                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                                    Accept
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-red-300 text-red-600 hover:bg-red-50 h-7 px-3 text-xs"
                                                                    onClick={(e) => handleDeclineInvitation(notification, e)}
                                                                >
                                                                    <XCircle className="h-3 w-3 mr-1" />
                                                                    Decline
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!notification.isRead && notification.type !== 'PROJECT_INVITE' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    markAsRead(notification.id)
                                                                }}
                                                                className="p-1 h-6 w-6"
                                                            >
                                                                <Check className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                deleteNotification(notification.id)
                                                            }}
                                                            className="p-1 h-6 w-6"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                {/* Read indicator */}
                                                {!notification.isRead && (
                                                    <Circle className="absolute left-2 top-4 h-2 w-2 fill-blue-500 text-blue-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">
                                    {selectedTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                                </p>
                                <p className="text-gray-400 text-sm mt-1">
                                    {selectedTab === 'unread' 
                                        ? 'You\'re all caught up!' 
                                        : 'When you get notifications, they\'ll show up here'
                                    }
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {filteredNotifications.length > 0 && (
                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            <Button
                                variant="ghost"
                                className="w-full text-sm text-blue-600 hover:text-blue-700"
                                onClick={() => {
                                    router.push('/notifications')
                                    setIsOpen(false)
                                }}
                            >
                                View all notifications
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
} 