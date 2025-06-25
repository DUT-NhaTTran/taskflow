import axios from "axios";
import { API_CONFIG } from "@/lib/config";
import { toast } from "sonner";

export interface Project {
    id: string;
    name: string;
    key: string;
    projectType: string;
    access: string;
    leadName?: string;
    ownerId?: string;
    ownerName?: string;
    ownerAvatar?: string;
    canEdit?: boolean;
    canDelete?: boolean;
    deletedAt?: string | null;
    userRole?: string;
}

// Get user ID from multiple sources
export const getUserId = () => {
    console.log('🔍 DEBUG: Getting user ID...');
    
    // Check UserStorageService (sessionStorage) - PRIMARY source after login
    try {
        const taskflowUser = sessionStorage.getItem('taskflow_logged_user');
        if (taskflowUser) {
            const userData = JSON.parse(taskflowUser);
            if (userData?.account?.id) {
                console.log('✅ Found user ID in sessionStorage.account.id:', userData.account.id);
                return userData.account.id;
            }
            if (userData?.profile?.id) {
                console.log('✅ Found user ID in sessionStorage.profile.id:', userData.profile.id);
                return userData.profile.id;
            }
        }
    } catch (error) {
        console.warn('⚠️ Error parsing sessionStorage data:', error);
    }
    
    // Fallback to localStorage (for backward compatibility)
    const possibleUserKeys = ["ownerId", "userId", "user_id", "currentUserId", "id", "accountId", "account_id"];
    
    for (const key of possibleUserKeys) {
        const value = localStorage.getItem(key);
        if (value && value.trim() && !value.includes('undefined') && !value.includes('null')) {
            console.log(`✅ Found user ID in localStorage.${key}:`, value);
            return value;
        }
    }
    
    console.error('❌ No user ID found anywhere!');
    return null;
};

// Test User Service connectivity
export const testUserService = async () => {
    try {
        console.log('🏥 Testing User Service connectivity...');
        const response = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users`, { 
            timeout: 3000,
            params: { limit: 1 }
        });
        console.log('✅ User Service is running - status:', response.status);
        return true;
    } catch (error) {
        console.error('❌ User Service connectivity test failed:', error);
        return false;
    }
};

// Fetch user details with fallback
export const fetchUserDetailsWithFallback = async (userId: string, userDetailsCache: Record<string, any>, setUserDetailsCache: Function, projectName?: string) => {
    try {
        // Check cache first
        if (userDetailsCache[userId]) {
            console.log('✅ User details found in cache for ID:', userId);
            return userDetailsCache[userId];
        }

        console.log('👤 Fetching user details for ID:', userId, projectName ? `(Project: ${projectName})` : '');
        
        // Test User Service first
        const isUserServiceUp = await testUserService();
        if (!isUserServiceUp) {
            console.warn('⚠️ User Service is down, using fallback name');
            
            if (!sessionStorage.getItem('userServiceDownNotified')) {
                toast.warning("User Service Unavailable", {
                    description: "Owner names will show as IDs. User service may be down.",
                    duration: 5000
                });
                sessionStorage.setItem('userServiceDownNotified', 'true');
            }
            
            const fallbackData = {
                id: userId,
                fullname: `Owner (${userId.substring(0, 8)}...)`,
                username: `user_${userId.substring(0, 8)}`,
                email: `${userId.substring(0, 8)}@unknown.com`,
                avatar: null
            };
            
            setUserDetailsCache((prev: any) => ({ ...prev, [userId]: fallbackData }));
            return fallbackData;
        }

        const response = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${userId}`, { timeout: 10000 });
        
        if (response.data?.status === "SUCCESS" && response.data?.data) {
            const userData = response.data.data;
            setUserDetailsCache((prev: any) => ({ ...prev, [userId]: userData }));
            return userData;
        } else {
            const fallbackData = {
                id: userId,
                fullname: `Owner (${userId.substring(0, 8)}...)`,
                username: `user_${userId.substring(0, 8)}`,
                email: `${userId.substring(0, 8)}@unknown.com`,
                avatar: null
            };
            setUserDetailsCache((prev: any) => ({ ...prev, [userId]: fallbackData }));
            return fallbackData;
        }
    } catch (error) {
        console.error('❌ Error fetching user details for ID:', userId, error);
        const fallbackData = {
            id: userId,
            fullname: `Owner (${userId.substring(0, 8)}...)`,
            username: `user_${userId.substring(0, 8)}`,
            email: `${userId.substring(0, 8)}@unknown.com`,
            avatar: null
        };
        setUserDetailsCache((prev: any) => ({ ...prev, [userId]: fallbackData }));
        return fallbackData;
    }
};

// Process avatar URL
export const processAvatarUrl = (avatar: string | null) => {
    if (!avatar) return '';
    
    if (avatar.startsWith('http') || avatar.startsWith('https')) {
        return avatar;
    } else if (avatar.startsWith('data:image') || avatar.startsWith('/9j/')) {
        return avatar.startsWith('data:image') ? avatar : `data:image/jpeg;base64,${avatar}`;
    } else {
        return `https://res.cloudinary.com/dwmospuhh/image/upload/avatars/${avatar}`;
    }
};

// Parse API response data
export const parseApiResponse = (responseData: any) => {
    if (responseData?.status === "SUCCESS" && responseData?.data) {
        return responseData.data;
    } else if (Array.isArray(responseData?.data)) {
        return responseData.data;
    } else if (Array.isArray(responseData)) {
        return responseData;
    } else {
        console.warn('⚠️ Unexpected response format:', responseData);
        return [];
    }
};

// Send project deletion notifications
export const sendProjectDeletionNotifications = async (deletedProject: Project, members: any[]) => {
    try {
        console.log('🔔 Starting project deletion notifications process...');
        
        // Check notification service health
        try {
            await axios.get(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/health`, { timeout: 5000 });
        } catch (healthError: any) {
            throw new Error('Notification service is not available');
        }
        
        const currentUserId = getUserId();
        const currentUserName = 'Project Owner'; // Could be enhanced to get actual name
        
        if (!currentUserId) {
            throw new Error('No current user ID found for notifications');
        }
        
        // Create list of users to notify (exclude current user)
        const allUsersToNotify = members.filter(member => {
            const memberId = member.id || member.userId || member.user_id;
            return memberId && memberId !== currentUserId;
        });
        
        // Add project owner if not in members list
        if (deletedProject.ownerId && deletedProject.ownerId !== currentUserId) {
            const ownerAlreadyInMembers = allUsersToNotify.some(user => {
                const userId = user.id || user.userId || user.user_id;
                return userId === deletedProject.ownerId;
            });
            
            if (!ownerAlreadyInMembers) {
                allUsersToNotify.push({
                    id: deletedProject.ownerId,
                    userId: deletedProject.ownerId,
                    role: 'OWNER',
                    name: deletedProject.ownerName || 'Project Owner'
                });
            }
        }
        
        if (allUsersToNotify.length === 0) {
            console.log('ℹ️ No users to notify');
            return;
        }
        
        // Send notifications sequentially
        const results = [];
        for (let i = 0; i < allUsersToNotify.length; i++) {
            const user = allUsersToNotify[i];
            const userId = user.id || user.userId || user.user_id;
            const userRole = user.role || 'MEMBER';
            const isOwner = userRole === 'OWNER' || userId === deletedProject.ownerId;
            
            const apiPayload = {
                type: "PROJECT_DELETED",
                title: "Project Deleted",
                message: `Project "${deletedProject.name}" has been deleted by ${currentUserName}. All project data including tasks, sprints, and settings have been permanently removed.${isOwner ? ' As the project owner, all administrative access has been revoked.' : ''}`,
                recipientUserId: userId,
                actorUserId: currentUserId,
                actorUserName: currentUserName,
                projectId: deletedProject.id,
                projectName: deletedProject.name,
                taskId: null
            };
            
            try {
                const response = await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, apiPayload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000
                });
                
                const isSuccessful = response.data?.success === true || response.data?.status === "SUCCESS";
                results.push({ success: isSuccessful, userId });
                
                if (i < allUsersToNotify.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`❌ Failed to send notification to user:`, error);
                results.push({ success: false, userId, error });
            }
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`Notification Results: ${successful} successful, ${failed} failed`);
        
        if (successful === 0 && results.length > 0) {
            throw new Error(`All notifications failed (${failed}/${results.length})`);
        }
        
    } catch (error) {
        console.error('❌ Error sending project deletion notifications:', error);
        throw error;
    }
}; 