"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_CONFIG } from '@/lib/config';

// Export types for external usage
export interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
  avatar?: string;
  fullname?: string;
  phone?: string;
  userRole?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserContextType {
  currentUser: User | null;
  isLoading: boolean;
  users: User[]; // Cache of all users
  refreshCurrentUser: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
  addUserToCache: (user: User) => void;
  getUserById: (userId: string) => User | null;
  fetchUserById: (userId: string) => Promise<User | null>;
  // Helper functions for userId management
  getCurrentUserId: () => string | null;
  setCurrentUserId: (userId: string) => void;
  clearCurrentUserId: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch current user from localStorage and API
  const refreshCurrentUser = async () => {
    try {
      setIsLoading(true);
      
      // Check sessionStorage keys in priority order - "userId" first since login saves it there
      const currentUserId = sessionStorage.getItem("userId") ||
                           sessionStorage.getItem("ownerId") || 
                           sessionStorage.getItem("currentUserId") ||
                           sessionStorage.getItem("user_id") ||
                           // Fallback to localStorage for migration
                           localStorage.getItem("userId") ||
                           localStorage.getItem("ownerId") || 
                           localStorage.getItem("currentUserId") ||
                           localStorage.getItem("user_id");
      
      console.log("🔍 UserContext: Checking sessionStorage for userId...");
      console.log("🔍 UserContext: userId:", sessionStorage.getItem("userId"));
      console.log("🔍 UserContext: ownerId:", sessionStorage.getItem("ownerId"));
      console.log("🔍 UserContext: Selected currentUserId:", currentUserId);

      if (!currentUserId) {
        console.log("❌ UserContext: No user ID found in sessionStorage");
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      // Migrate from localStorage to sessionStorage if needed
      if (!sessionStorage.getItem("userId") && localStorage.getItem("userId")) {
        console.log("🔄 UserContext: Migrating userId from localStorage to sessionStorage");
        sessionStorage.setItem("userId", currentUserId);
      }

      // Check if user already in cache
      const cachedUser = users.find(u => u.id === currentUserId);
      if (cachedUser) {
        console.log("✅ UserContext: Using cached current user:", cachedUser);
        setCurrentUser(cachedUser);
        setIsLoading(false);
        return;
      }

      // Try both API endpoints with improved error handling
      let userData = null;
      
      // First try: Auth service
      try {
        console.log("🔄 UserContext: Trying auth service...");
        const authResponse = await axios.get(
          `${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/${currentUserId}/user-id`,
          { timeout: 5000 } // 5 second timeout
        );

        if (authResponse.data && authResponse.data.userId) {
          // Then fetch full user details
          const userResponse = await axios.get(
            `${API_CONFIG.USER_SERVICE}/api/users/${authResponse.data.userId}`,
            { timeout: 5000 }
          );
          
          if (userResponse.data?.data) {
            userData = userResponse.data.data;
            console.log("✅ UserContext: Fetched current user via auth service:", userData);
          }
        }
      } catch (authError) {
        console.warn("⚠️ UserContext: Auth service unavailable:", authError instanceof Error ? authError.message : 'Unknown error');
      }

      // Second try: Direct user service if first failed
      if (!userData) {
        try {
          console.log("🔄 UserContext: Trying direct user service...");
          const directResponse = await axios.get(
            `${API_CONFIG.USER_SERVICE}/api/users/${currentUserId}`,
            { timeout: 5000 }
          );
          
          if (directResponse.data?.data) {
            userData = directResponse.data.data;
            console.log("✅ UserContext: Fetched user via direct service:", userData);
          }
        } catch (directError) {
          console.warn("⚠️ UserContext: Direct user service unavailable:", directError instanceof Error ? directError.message : 'Unknown error');
        }
      }

      // Use fetched data or create fallback
      if (userData) {
        setCurrentUser(userData);
        addUserToCache(userData);
      } else {
        // Create fallback user if all APIs failed
        console.log("⚠️ UserContext: All APIs failed, creating fallback user");
        const fallbackUser: User = {
          id: currentUserId,
          username: `User-${currentUserId.substring(0, 8)}`,
          email: "user@example.com"
        };
        
        console.log("⚠️ UserContext: Using fallback user:", fallbackUser);
        setCurrentUser(fallbackUser);
        addUserToCache(fallbackUser);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("❌ UserContext: Unexpected error in refreshCurrentUser:", error);
      
      // Create emergency fallback
      const currentUserId = localStorage.getItem("userId") ||
                           localStorage.getItem("ownerId") || 
                           localStorage.getItem("currentUserId") ||
                           localStorage.getItem("user_id");
      
      if (currentUserId) {
        const emergencyUser: User = {
          id: currentUserId,
          username: "Emergency User",
          email: "emergency@example.com"
        };
        setCurrentUser(emergencyUser);
        addUserToCache(emergencyUser);
      }
      
      setIsLoading(false);
    }
  };

  // Add user to cache
  const addUserToCache = (user: User) => {
    setUsers(prev => {
      const userExists = prev.some(u => u.id === user.id);
      if (!userExists) {
        console.log("📝 UserContext: Adding user to cache:", user.username);
        return [...prev, user];
      }
      return prev;
    });
  };

  // Get user from cache
  const getUserById = (userId: string): User | null => {
    return users.find(u => u.id === userId) || null;
  };

  // Fetch user by ID and add to cache
  const fetchUserById = async (userId: string): Promise<User | null> => {
    try {
      // Check cache first
      const cachedUser = getUserById(userId);
      if (cachedUser) {
        return cachedUser;
      }

      console.log("🔍 UserContext: Fetching user by ID:", userId);
      
      // Try user service directly first (more reliable)
      try {
        const response = await axios.get(`${API_CONFIG.USER_SERVICE}/api/users/${userId}`, {
          timeout: 5000 // 5 second timeout
        });
        if (response.data?.data) {
          const userData = response.data.data;
          console.log("✅ UserContext: Fetched user by ID:", userData);
          addUserToCache(userData);
          return userData;
        }
      } catch (directError) {
        console.warn("⚠️ UserContext: Direct user fetch failed:", directError);
        
        // Log more details about the error
        if (axios.isAxiosError(directError)) {
          console.warn("⚠️ UserContext: API Error details:", {
            status: directError.response?.status,
            statusText: directError.response?.statusText,
            message: directError.message
          });
        }
      }

      // Fallback: create minimal user object instead of failing
      const fallbackUser: User = {
        id: userId,
        username: `User-${userId.substring(0, 8)}`,
        email: "unknown@example.com"
      };
      
      console.log("⚠️ UserContext: Using fallback for user ID:", userId, fallbackUser);
      addUserToCache(fallbackUser);
      return fallbackUser;

    } catch (error) {
      console.warn("⚠️ UserContext: Error fetching user by ID, using fallback:", error);
      
      // Always return a fallback user instead of null to prevent UI crashes
      const emergencyFallbackUser: User = {
        id: userId,
        username: "Unknown User",
        email: "unknown@example.com"
      };
      
      addUserToCache(emergencyFallbackUser);
      return emergencyFallbackUser;
    }
  };

  // Initialize current user on mount
  useEffect(() => {
    refreshCurrentUser();
  }, []);

  const value: UserContextType = {
    currentUser,
    isLoading,
    users,
    refreshCurrentUser,
    updateUser: (updatedUser: User) => {
      setCurrentUser(updatedUser);
      addUserToCache(updatedUser);
    },
    addUserToCache,
    getUserById,
    fetchUserById,
    // Helper functions for userId management
    getCurrentUserId: () => {
      if (typeof window === 'undefined') return null;
      
      return sessionStorage.getItem("userId") ||
             sessionStorage.getItem("ownerId") || 
             sessionStorage.getItem("currentUserId") ||
             sessionStorage.getItem("user_id") ||
             // Fallback to localStorage for migration
             localStorage.getItem("userId") ||
             localStorage.getItem("ownerId") || 
             localStorage.getItem("currentUserId") ||
             localStorage.getItem("user_id");
    },
    setCurrentUserId: (userId: string) => {
      if (typeof window === 'undefined') return;
      
      // Clear current user and cache when switching users
      setCurrentUser(null);
      setUsers([]);
      
      sessionStorage.setItem("userId", userId);
      // Also set ownerId for backward compatibility
      sessionStorage.setItem("ownerId", userId);
      console.log("✅ UserId saved to sessionStorage and cache cleared:", userId);
      
      // Trigger refresh of current user
      setTimeout(() => {
        refreshCurrentUser();
      }, 100);
    },
    clearCurrentUserId: () => {
      if (typeof window === 'undefined') return;
      
      sessionStorage.removeItem("userId");
      sessionStorage.removeItem("ownerId");
      sessionStorage.removeItem("currentUserId");
      sessionStorage.removeItem("user_id");
      sessionStorage.removeItem("token");
      
      // Also clear from localStorage
      localStorage.removeItem("userId");
      localStorage.removeItem("ownerId");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("user_id");
      localStorage.removeItem("token");
      
      console.log("✅ UserId cleared from sessionStorage");
    }
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;

// Also export the context explicitly for direct usage if needed
export { UserContext }; 