"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Globe,
  Clock,
  LayoutGrid,
  Calendar,
  List,
  FileText,
  Target,
  Briefcase,
  Package,
  ListChecks,
  BarChart3,
  Layout,
  Archive,
  Search,
} from "lucide-react";
import { useNavigation } from "@/contexts/NavigationContext";
import { useUser } from "@/contexts/UserContext";
import { useUserStorage } from "@/hooks/useUserStorage";
import { getUserPermissions, UserPermissions } from "@/utils/permissions";

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    currentProjectId,
    userId,
    isNavigating,
    navigateTo,
    getProjectPath,
    getUserPath,
    setCurrentProjectId,
    setUserId,
  } = useNavigation();

  // Get current user from UserContext
  const { currentUser } = useUser();
  const { userData } = useUserStorage();

  // ✅ NEW: User permissions state
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  
  // Fix hydration mismatch
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-update navigation context with current data
  useEffect(() => {
    // Update projectId from URL params or prop
    const urlProjectId = searchParams?.get('projectId');
    const finalProjectId = urlProjectId || projectId;
    
    if (finalProjectId && finalProjectId !== currentProjectId) {
      console.log("🎯 Sidebar: Setting projectId from URL/prop:", finalProjectId);
      setCurrentProjectId(finalProjectId);
    }

    // Update userId from UserContext
    if (currentUser?.id && currentUser.id !== userId) {
      console.log("👤 Sidebar: Setting userId from UserContext:", currentUser.id);
      setUserId(currentUser.id);
    }
  }, [projectId, searchParams, currentUser?.id, currentProjectId, userId, setCurrentProjectId, setUserId]);

  // ✅ NEW: Fetch user permissions when projectId changes
  useEffect(() => {
    const fetchPermissions = async () => {
      const activeProjectId = currentProjectId || projectId || searchParams?.get('projectId');
      const activeUserId = userData?.account?.id || userData?.profile?.id;
      
      if (activeUserId && activeProjectId) {
        setPermissionsLoading(true);
        try {
          const permissions = await getUserPermissions(activeUserId, activeProjectId);
          setUserPermissions(permissions);
        } catch (error) {
          console.error('Error fetching user permissions:', error);
          setUserPermissions(null);
        } finally {
          setPermissionsLoading(false);
        }
      } else {
        setPermissionsLoading(false);
      }
    };

    fetchPermissions();
  }, [userData?.account?.id, userData?.profile?.id, currentProjectId, projectId, searchParams]);

  // Check if current path matches specific routes
  const isActive = (path: string) => {
    if (!pathname) return false;

    // Handle different path patterns
    if (path.includes("/work")) {
      return pathname.includes("/work");
    }
    if (path.includes("/project/summary")) {
      return pathname.includes("/project/summary");
    }
    if (path.includes("/project/project_homescreen")) {
      return pathname.includes("/project/project_homescreen");
    }
    if (path.includes("/project/backlog")) {
      return pathname.includes("/project/backlog");
    }
    if (path.includes("/project/calendar")) {
      return pathname.includes("/project/calendar");
    }
    if (path.includes("/project/search-tasks")) {
      return pathname.includes("/project/search-tasks");
    }

    return pathname.includes(path);
  };

  // Utility to build class for each nav link
  const makeLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center space-x-3 px-2 py-1 rounded transition-colors duration-200 ${
      active
        ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
        : "text-gray-700 hover:bg-gray-100"
    } ${isNavigating ? "opacity-50" : ""}`;
  };

  // Create fallback project paths if no currentProjectId
  const createProjectPath = (page: string): string => {
    const urlProjectId = searchParams?.get('projectId');
    const activeProjectId = urlProjectId || currentProjectId;
    
    const basePaths: Record<string, string> = {
      'summary': '/project/summary',
      'board': '/project/project_homescreen',
      'backlog': '/project/backlog',
      'calendar': '/project/calendar',
      'search': '/project/search-tasks',
      'audit': '/project/audit'
    };
    
    const basePath = basePaths[page];
    if (!basePath) return '#';
    
    // If we have a project ID, use it
    if (activeProjectId) {
      return `${basePath}?projectId=${activeProjectId}`;
    }
    
    // Otherwise, just go to the page (it will handle missing project)
    return basePath;
  };

  // Navigation data
  const navItems = [
    {
      name: "Summary",
      path: createProjectPath("summary"),
      icon: BarChart3,
      pathPattern: "/project/summary",
      available: true, // Always available
    },
    {
      name: "Board",
      path: createProjectPath("board"),
      icon: LayoutGrid,
      pathPattern: "/project/project_homescreen",
      available: true, // Always available
    },
    {
      name: "Backlog",
      path: createProjectPath("backlog"),
      icon: ListChecks,
      pathPattern: "/project/backlog",
      available: true, // Always available
    },
    {
      name: "Calendar",
      path: createProjectPath("calendar"),
      icon: Calendar,
      pathPattern: "/project/calendar",
      available: true, // Always available
    },
    {
      name: "All work",
      path: userId ? getUserPath("work") : "/work",
      icon: Briefcase,
      pathPattern: "/work",
      available: true, // Always available
    },
  ];

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (path !== "#" && !isNavigating) {
      console.log("🧭 Sidebar: Navigating to:", path);
      navigateTo(path);
    }
  };

  return (
    <div className="w-64 border-r border-gray-200 overflow-y-auto flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-[#0052CC] text-white p-2 rounded">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">
              {isClient ? (currentUser?.username || "User") : "User"} <br /> workspace
            </h2>
            <p className="text-xs text-gray-500">TaskFlow project</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">PLANNING</h3>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = !item.available;

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`${makeLinkClass(item.pathPattern)} ${
                  isDisabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
                onClick={(e) => handleNavClick(e, item.path)}
                title={item.name}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Placeholder items */}
          <Link
            href="#"
            className="flex items-center space-x-3 px-2 py-1 rounded hover:bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            <List className="h-4 w-4" />
            <span>List</span>
            <span className="text-xs ml-auto">Soon</span>
          </Link>

          <Link
            href="#"
            className="flex items-center space-x-3 px-2 py-1 rounded hover:bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            <FileText className="h-4 w-4" />
            <span>Forms</span>
            <span className="text-xs ml-auto">Soon</span>
          </Link>

          <Link
            href="#"
            className="flex items-center space-x-3 px-2 py-1 rounded hover:bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            <Target className="h-4 w-4" />
            <span>Goals</span>
            <span className="text-xs ml-auto">Soon</span>
          </Link>
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          You're in a team-managed project
        </p>
        {isNavigating && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600">Navigating...</span>
          </div>
        )}
      </div>
    </div>
  );
}
