import axios from 'axios';
import { API_CONFIG } from "@/lib/config";

// Interface cho User từ Users table
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
}

// Interface cho Account từ Accounts table  
export interface AccountInfo {
  id: string;
  email: string;
  password?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

// Interface cho thông tin đầy đủ khi login
export interface LoggedInUserData {
  account: AccountInfo;
  profile: UserProfile;
  loginTime: string;
  sessionToken?: string;
}

// Storage keys
const USER_STORAGE_KEY = 'taskflow_logged_user';
const USER_SESSION_KEY = 'taskflow_user_session';

// Helper function to check if we're in browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
};

// Helper function for safe storage operations
const safeStorageOperation = <T>(operation: () => T, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    return operation();
  } catch (error) {
    console.error('❌ Storage operation failed:', error);
    return fallback;
  }
};

export class UserStorageService {
  
  /**
   * Lưu thông tin user vào sessionStorage khi login thành công
   */
  static saveLoggedInUser(accountData: AccountInfo, userProfile: UserProfile, sessionToken?: string): void {
    safeStorageOperation(() => {
      const loggedInData: LoggedInUserData = {
        account: { ...accountData, password: undefined },
        profile: userProfile,
        loginTime: new Date().toISOString(),
        sessionToken
      };

      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInData));
      if (sessionToken) {
        sessionStorage.setItem(USER_SESSION_KEY, sessionToken);
      }

      console.log('✅ User data saved:', userProfile.username);
    }, undefined);
  }

  /**
   * Lấy thông tin user đã login từ sessionStorage
   */
  static getLoggedInUser(): LoggedInUserData | null {
    return safeStorageOperation(() => {
      const userData = sessionStorage.getItem(USER_STORAGE_KEY);
      if (!userData) return null;

      const parsedData: LoggedInUserData = JSON.parse(userData);
      
      if (!parsedData.account || !parsedData.profile) {
        console.warn('⚠️ Invalid user data in sessionStorage');
        this.clearLoggedInUser();
        return null;
      }

      return parsedData;
    }, null);
  }

  /**
   * Lấy profile user hiện tại
   */
  static getCurrentUserProfile(): UserProfile | null {
    return this.getLoggedInUser()?.profile || null;
  }

  /**
   * Lấy account info hiện tại
   */
  static getCurrentAccount(): AccountInfo | null {
    return this.getLoggedInUser()?.account || null;
  }

  /**
   * Lấy session token
   */
  static getSessionToken(): string | null {
    return safeStorageOperation(() => sessionStorage.getItem(USER_SESSION_KEY), null);
  }

  /**
   * Update thông tin profile user
   */
  static updateUserProfile(updatedProfile: Partial<UserProfile>): void {
    safeStorageOperation(() => {
      const currentData = this.getLoggedInUser();
      if (!currentData) {
        console.warn('⚠️ No user data to update');
        return;
      }

      const updatedData: LoggedInUserData = {
        ...currentData,
        profile: { ...currentData.profile, ...updatedProfile }
      };

      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedData));
      console.log('✅ User profile updated');
    }, undefined);
  }

  /**
   * Xóa thông tin user khi logout
   */
  static clearLoggedInUser(): void {
    safeStorageOperation(() => {
      // Clear sessionStorage
      const sessionKeys = [
        USER_STORAGE_KEY, USER_SESSION_KEY, 'username', 'userId', 'userEmail', 
        'user_name', 'userName', 'ownerId', 'currentUserId', 'user_id', 
        'currentProjectId', 'token', 'authToken', 'sessionToken', 'accessToken',
        'currentProjectName', 'currentProjectKey', 'projectId'
      ];
      
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Clear localStorage for migration/cleanup
      if (typeof localStorage !== 'undefined') {
        sessionKeys.forEach(key => localStorage.removeItem(key));
      }
      
      console.log("✅ User data cleared");
    }, undefined);
  }

  /**
   * Kiểm tra user có đang login không
   */
  static isUserLoggedIn(): boolean {
    const userData = this.getLoggedInUser();
    return userData !== null && userData.account.isActive;
  }

  /**
   * Fetch và sync thông tin user mới nhất từ server
   */
  static async syncUserFromServer(userId: string): Promise<LoggedInUserData | null> {
    try {
      console.log('🔄 Syncing user data from server:', userId);

      const [userResponse, accountResponse] = await Promise.all([
        axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${userId}`),
        axios.get(`${API_CONFIG.AI_SERVICE}/api/auth/account/${userId}`)
      ]);

      if (userResponse.data?.status === 'SUCCESS' && accountResponse.data?.status === 'SUCCESS') {
        const userProfile: UserProfile = userResponse.data.data;
        const accountInfo: AccountInfo = accountResponse.data.data;

        this.saveLoggedInUser(accountInfo, userProfile, this.getSessionToken() || undefined);
        console.log('✅ User data synced successfully');
        return this.getLoggedInUser();
      }
      
      console.error('❌ Failed to sync user data from server');
      return null;
    } catch (error) {
      console.error('❌ Error syncing user data:', error);
      return null;
    }
  }

  /**
   * Migration từ localStorage sang sessionStorage
   */
  static migrateOldUserData(): void {
    safeStorageOperation(() => {
      const oldUserData = localStorage.getItem(USER_STORAGE_KEY);
      const currentSessionData = sessionStorage.getItem(USER_STORAGE_KEY);
      
      if (!currentSessionData && oldUserData) {
        console.log('🔄 Migrating user data to sessionStorage...');
        
        sessionStorage.setItem(USER_STORAGE_KEY, oldUserData);
        
        const oldSessionToken = localStorage.getItem(USER_SESSION_KEY);
        if (oldSessionToken) {
          sessionStorage.setItem(USER_SESSION_KEY, oldSessionToken);
        }
        
        // Migrate other keys
        ['userId', 'ownerId', 'currentUserId', 'user_id', 'currentProjectId'].forEach(key => {
          const value = localStorage.getItem(key);
          if (value) sessionStorage.setItem(key, value);
        });
        
        console.log('✅ Migration completed');
      }
    }, undefined);
  }

  /**
   * Lấy display name cho user
   */
  static getUserDisplayName(): string {
    const profile = this.getCurrentUserProfile();
    if (!profile) return 'Unknown User';

    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    
    return profile.username || profile.email || 'Unknown User';
  }

  /**
   * Lấy user initials cho avatar
   */
  static getUserInitials(): string {
    const displayName = this.getUserDisplayName();
    if (!displayName || displayName === 'Unknown User') return '?';
    
    return displayName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }

  /**
   * Debug method to log current user data
   */
  static debugLogUserData(): void {
    if (!isBrowser()) {
      console.log('🔍 Debug: SSR environment - no user data available');
      return;
    }

    try {
      const userData = this.getLoggedInUser();
      const sessionToken = this.getSessionToken();
      
      console.log('🔍 UserStorageService Debug:', {
        isLoggedIn: this.isUserLoggedIn(),
        hasToken: !!sessionToken,
        displayName: this.getUserDisplayName(),
        userInitials: this.getUserInitials(),
        userData: userData ? {
          profileId: userData.profile.id,
          username: userData.profile.username,
          email: userData.account.email,
          loginTime: userData.loginTime,
          accountActive: userData.account.isActive
        } : null
      });
    } catch (error) {
      console.error('❌ Error in debugLogUserData:', error);
    }
  }
}

// Export default instance
export default UserStorageService; 