"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface NavigationState {
  currentProjectId: string | null;
  userId: string | null;
  isNavigating: boolean;
}

interface NavigationContextType extends NavigationState {
  setCurrentProjectId: (projectId: string) => void;
  setUserId: (userId: string) => void;
  navigateTo: (path: string, preserveState?: boolean) => void;
  getProjectPath: (page: string) => string;
  getUserPath: (page: string) => string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [state, setState] = useState<NavigationState>({
    currentProjectId: null,
    userId: null,
    isNavigating: false
  });

  // Initialize from localStorage and URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Get saved values from sessionStorage (changed from localStorage)
      const savedProjectId = sessionStorage.getItem('currentProjectId') || localStorage.getItem('currentProjectId');
      const savedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
      
      // Get from URL params
      const urlProjectId = searchParams?.get('projectId');
      const urlUserId = searchParams?.get('userId');
      
      // Determine final values (URL takes precedence)
      const finalProjectId = urlProjectId || savedProjectId;
      const finalUserId = urlUserId || savedUserId || 'd90e8bd8-72e2-47cc-b9f0-edb92fe60c5a'; // Fallback
      
      setState({
        currentProjectId: finalProjectId,
        userId: finalUserId,
        isNavigating: false
      });
      
      // Save to sessionStorage (changed from localStorage)
      if (finalProjectId) {
        sessionStorage.setItem('currentProjectId', finalProjectId);
      }
      if (finalUserId) {
        sessionStorage.setItem('userId', finalUserId);
      }
    }
  }, [searchParams]);

  const setCurrentProjectId = (projectId: string) => {
    setState(prev => ({ ...prev, currentProjectId: projectId }));
    sessionStorage.setItem('currentProjectId', projectId);
  };

  const setUserId = (userId: string) => {
    setState(prev => ({ ...prev, userId: userId }));
    sessionStorage.setItem('userId', userId);
  };

  const navigateTo = (path: string, preserveState = true) => {
    if (path === '#') return;
    
    setState(prev => ({ ...prev, isNavigating: true }));
    
    try {
      router.push(path);
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => {
        setState(prev => ({ ...prev, isNavigating: false }));
      }, 300);
    }
  };

  const getProjectPath = (page: string): string => {
    if (!state.currentProjectId) return '#';
    
    const basePaths: Record<string, string> = {
      'summary': '/project/summary',
      'board': '/project/project_homescreen',
      'backlog': '/project/backlog',
      'calendar': '/project/calendar'
    };
    
    const basePath = basePaths[page];
    return basePath ? `${basePath}?projectId=${state.currentProjectId}` : '#';
  };

  const getUserPath = (page: string): string => {
    if (!state.userId) return '#';
    
    const basePaths: Record<string, string> = {
      'work': '/work'
    };
    
    const basePath = basePaths[page];
    return basePath ? `${basePath}?userId=${state.userId}` : '#';
  };

  const contextValue: NavigationContextType = {
    ...state,
    setCurrentProjectId,
    setUserId,
    navigateTo,
    getProjectPath,
    getUserPath
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
} 