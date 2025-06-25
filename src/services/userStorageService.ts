import axios from 'axios';

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

export interface LoggedInUserData {
  account: AccountInfo;
  profile: UserProfile;
  loginTime: string;
  sessionToken?: string;
}

const USER_STORAGE_KEY = 'taskflow_logged_user';
const USER_SESSION_KEY = 'taskflow_user_session';

const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
};

export class UserStorageService {
  
  static saveLoggedInUser(accountData: AccountInfo, userProfile: UserProfile, sessionToken?: string): void {
    if (!isBrowser()) return;

    try {
      const loggedInData: LoggedInUserData = {
        account: { ...accountData, password: undefined },
        profile: userProfile,
        loginTime: new Date().toISOString(),
        sessionToken: sessionToken
      };

      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInData));
      
      if (sessionToken) {
        sessionStorage.setItem(USER_SESSION_KEY, sessionToken);
      }

      console.log('✅ User data saved');
    } catch (error) {
      console.error('❌ Error saving user data:', error);
    }
  }

  static getLoggedInUser(): LoggedInUserData | null {
    if (!isBrowser()) return null;

    try {
      const userData = sessionStorage.getItem(USER_STORAGE_KEY);
      if (!userData) return null;

      const parsedData: LoggedInUserData = JSON.parse(userData);
      
      if (!parsedData.account || !parsedData.profile) {
        this.clearLoggedInUser();
        return null;
      }

      return parsedData;
    } catch (error) {
      console.error('❌ Error reading user data:', error);
      this.clearLoggedInUser();
      return null;
    }
  }

  static getCurrentUserProfile(): UserProfile | null {
    const userData = this.getLoggedInUser();
    return userData?.profile || null;
  }

  static getCurrentAccount(): AccountInfo | null {
    const userData = this.getLoggedInUser();
    return userData?.account || null;
  }

  static getSessionToken(): string | null {
    if (!isBrowser()) return null;
    return sessionStorage.getItem(USER_SESSION_KEY);
  }

  static updateUserProfile(updatedProfile: Partial<UserProfile>): void {
    if (!isBrowser()) return;

    try {
      const currentData = this.getLoggedInUser();
      if (!currentData) return;

      const updatedData: LoggedInUserData = {
        ...currentData,
        profile: { ...currentData.profile, ...updatedProfile }
      };

      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedData));
      console.log('✅ User profile updated');
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
    }
  }

  static clearLoggedInUser(): void {
    if (!isBrowser()) return;

    try {
      const keysToRemove = [
        USER_STORAGE_KEY, USER_SESSION_KEY,
        'username', 'userId', 'userEmail', 'ownerId', 'currentUserId', 'user_id',
        'currentProjectId', 'token', 'authToken', 'sessionToken', 'accessToken'
      ];
      
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      });
      
      console.log("✅ User data cleared");
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
    }
  }

  static isUserLoggedIn(): boolean {
    const userData = this.getLoggedInUser();
    return userData !== null && userData.account.isActive;
  }

  static async syncUserFromServer(userId: string): Promise<LoggedInUserData | null> {
    try {
      const [userResponse, accountResponse] = await Promise.all([
        axios.get(`http://localhost:8086/api/users/${userId}`),
        axios.get(`http://localhost:8088/api/auth/account/${userId}`)
      ]);

      if (userResponse.data?.status === 'SUCCESS' && accountResponse.data?.status === 'SUCCESS') {
        const userProfile: UserProfile = userResponse.data.data;
        const accountInfo: AccountInfo = accountResponse.data.data;

        this.saveLoggedInUser(accountInfo, userProfile, this.getSessionToken() || undefined);
        console.log('✅ User data synced from server');
        return this.getLoggedInUser();
      }
      return null;
    } catch (error) {
      console.error('❌ Error syncing user data:', error);
      return null;
    }
  }

  static migrateOldUserData(): void {
    if (!isBrowser()) return;

    try {
      const oldUserData = localStorage.getItem(USER_STORAGE_KEY);
      const currentSessionData = sessionStorage.getItem(USER_STORAGE_KEY);
      
      if (!currentSessionData && oldUserData) {
        sessionStorage.setItem(USER_STORAGE_KEY, oldUserData);
        
        const oldSessionToken = localStorage.getItem(USER_SESSION_KEY);
        if (oldSessionToken) {
          sessionStorage.setItem(USER_SESSION_KEY, oldSessionToken);
        }
        
        ['userId', 'ownerId', 'currentUserId', 'user_id', 'currentProjectId'].forEach(key => {
          const value = localStorage.getItem(key);
          if (value) sessionStorage.setItem(key, value);
        });
        
        console.log('✅ Migration completed');
      }
    } catch (error) {
      console.error('❌ Error during migration:', error);
    }
  }

  static getUserDisplayName(): string {
    const profile = this.getCurrentUserProfile();
    if (!profile) return 'Unknown User';

    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    
    return profile.username || profile.email || 'Unknown User';
  }

  static getUserInitials(): string {
    const displayName = this.getUserDisplayName();
    if (!displayName || displayName === 'Unknown User') return '?';
    
    return displayName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }

  static debugLogUserData(): void {
    if (!isBrowser()) return;

    try {
      const userData = this.getLoggedInUser();
      const isLoggedIn = this.isUserLoggedIn();
      
      console.log('🔍 UserStorageService Debug:');
      console.log('- Is Logged In:', isLoggedIn);
      console.log('- User Data:', userData);
      console.log('- Display Name:', this.getUserDisplayName());
      
      if (userData) {
        console.log('- Profile ID:', userData.profile.id);
        console.log('- Username:', userData.profile.username);
        console.log('- Email:', userData.account.email);
      }
    } catch (error) {
      console.error('❌ Error in debugLogUserData:', error);
    }
  }
}

export default UserStorageService; 