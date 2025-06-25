"use client"

import Link from "next/link"
import {
    Search,
    Bell,
    ChevronDown,
    LayoutGrid,
    FolderPlus,
    ListChecks,
    Users,
    AppWindow,
    ClipboardList,
    Bug,
    FolderOpen,
    Plus,
    User,
    LogOut,
    Shield
} from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"
import { NotificationDropdown } from "@/components/ui/notification-dropdown"
import { useUser } from "@/contexts/UserContext"
import { UserAvatar } from "@/components/ui/user-avatar"
import { API_CONFIG } from "@/lib/config";

// Interface for Project
interface Project {
    id: string;
    name: string;
    key: string;
    projectType?: string;
    access?: string;
    description?: string;
}

// Add interface for menu items
interface MenuItem {
    label: string;
    icon: any;
    href?: string;
    onClick?: () => void;
    projectId?: string;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

export function TopNavigation() {
    const router = useRouter();
    const searchRef = useRef<HTMLDivElement>(null);
    const { clearCurrentUserId, currentUser, isLoading: userContextLoading } = useUser();
    
    // Search states
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Project[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Add state for user projects
    const [userProjects, setUserProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    // Add mounted effect to prevent hydration mismatch
    const [isMounted, setIsMounted] = useState(false);

    // Function to fetch user projects
    const fetchUserProjects = async () => {
        if (!currentUser?.id || isLoadingProjects) return;

        try {
            setIsLoadingProjects(true);
            
            // Fetch both owned and member projects
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/user/${currentUser.id}`),
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/member/${currentUser.id}`)
            ]);

            let allProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled' && ownedResponse.value.data?.data) {
                allProjects.push(...ownedResponse.value.data.data);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled' && memberResponse.value.data?.data) {
                allProjects.push(...memberResponse.value.data.data);
            }

            // Remove duplicates by ID
            const uniqueProjects = allProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );

            setUserProjects(uniqueProjects);
            console.log(`Loaded ${uniqueProjects.length} user projects`);
            
        } catch (error) {
            console.error("❌ Error fetching user projects:", error);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    // Effect to fetch projects when user is available
    useEffect(() => {
        if (currentUser?.id) {
            fetchUserProjects();
        }
    }, [currentUser?.id]);

    // Add mounted effect to prevent hydration mismatch
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Generate dynamic menu items based on user projects
    const getMenuItems = (): MenuSection[] => {
        const projectItems: MenuItem[] = [
            { 
                label: "View all projects", 
                icon: LayoutGrid, 
                href: "/project/view_all_projects" 
            },
            { 
                label: "Create project", 
                icon: FolderPlus, 
                href: "/project/create_project" 
            },
            ...userProjects.map(project => ({
                label: project.name,
                icon: FolderOpen,
                projectId: project.id,
                onClick: () => handleProjectSelect(project)
            }))
        ];

        return [
            {
                title: "Projects",
                items: projectItems,
            },
        ];
    };

    const menuItems = getMenuItems();

    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [menuTimeoutId, setMenuTimeoutId] = useState<NodeJS.Timeout | null>(null)
    const [searchTimeoutId, setSearchTimeoutId] = useState<NodeJS.Timeout | null>(null)

    const getCurrentUserId = () => {
        return currentUser?.id || null;
    };

    // Search projects function
    const searchProjects = async (term: string) => {
        if (!term.trim()) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        try {
            setIsSearching(true);
            setShowSearchResults(true);
            
            let currentUserId = getCurrentUserId();
            
            // Search in both owned projects and member projects
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                // Get projects where user is owner
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/user/${currentUserId}`),
                // Get projects where user is member  
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=${encodeURIComponent(term)}&userId=${currentUserId}`)
            ]);

            let allProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled' && ownedResponse.value.data?.data) {
                const ownedProjects = ownedResponse.value.data.data.filter((project: Project) => 
                    project.name.toLowerCase().includes(term.toLowerCase()) ||
                    project.key.toLowerCase().includes(term.toLowerCase())
                );
                allProjects.push(...ownedProjects);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled' && memberResponse.value.data?.data) {
                const memberProjects = memberResponse.value.data.data;
                allProjects.push(...memberProjects);
            }

            // Remove duplicates by ID
            const uniqueProjects = allProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );

            setSearchResults(uniqueProjects);
            
        } catch (error) {
            console.error("❌ Error searching projects:", error);
            setSearchResults([]);
            toast.error("Failed to search projects. Please try again.");
        } finally {
            setIsSearching(false);
        }
    };

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        
        setSearchTerm(term);
        
        // Clear previous search timeout
        if (searchTimeoutId) {
            console.log("🔍 Clearing previous search timeout");
            clearTimeout(searchTimeoutId);
        }
        
        // Set new search timeout
        const newSearchTimeoutId = setTimeout(() => {
            console.log("🔍 Search timeout triggered for term:", term);
            searchProjects(term);
        }, 300);
        
        setSearchTimeoutId(newSearchTimeoutId);
        console.log("🔍 New search timeout set");
    };

    // Handle project selection
    const handleProjectSelect = (project: Project) => {
        console.log("🔍 Project selected:", project);
        setSearchTerm("");
        setSearchResults([]);
        setShowSearchResults(false);
        
        // Store selected project info for sync across pages
        sessionStorage.setItem("currentProjectId", project.id);
        sessionStorage.setItem("currentProjectName", project.name);
        sessionStorage.setItem("currentProjectKey", project.key);
        
        // Navigate to project board with selected projectId
        router.push(`/project/project_homescreen?projectId=${project.id}`);
    };

    // Handle search form submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("🔍 Form submitted, search results length:", searchResults.length);
        if (searchResults.length > 0) {
            handleProjectSelect(searchResults[0]);
        }
    };

    // Close search results when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Clear timeouts when component unmounts
    useEffect(() => {
        return () => {
            if (menuTimeoutId !== null) {
                clearTimeout(menuTimeoutId);
            }
            if (searchTimeoutId !== null) {
                clearTimeout(searchTimeoutId);
            }
        };
    }, [menuTimeoutId, searchTimeoutId]);

    const handleMenuEnter = (menuTitle: string) => {
        if (menuTimeoutId !== null) {
            clearTimeout(menuTimeoutId)
            setMenuTimeoutId(null)
        }
        setOpenDropdown(menuTitle)
    }

    const handleMenuLeave = (menuTitle: string) => {
        const id = setTimeout(() => {
            if (openDropdown === menuTitle) {
                setOpenDropdown(null)
            }
        }, 100) // Thời gian trễ 100ms

        setMenuTimeoutId(id)
    }

    const handleLogout = () => {
        console.log("🔥 Logout clicked - clearing ALL data");
        // Đóng dropdown trước
        setOpenDropdown(null);
        
        // Clear all storage data
        sessionStorage.clear();
        localStorage.clear();
        
        // Clear UserContext
        clearCurrentUserId();
        console.log("✅ All user data cleared");
        
        // Redirect về signin
        console.log("➡️ Redirecting to signin...");
        router.push("/auth/signin");
    };

    // Clear all data function for debug button
    const clearAllData = () => {
        console.log("🧹 Debug: Clearing all data");
        sessionStorage.clear();
        localStorage.clear();
        clearCurrentUserId();
        window.location.reload();
    };

    return (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
                

                {/* Navigation items */}
                <div className="flex items-center justify-between w-full">
                    {/* Left */}
                    <div className="flex items-center space-x-4">
                        <button className="p-2 hover:bg-gray-100 rounded">
                            <svg viewBox="0 0 24 24" width="24" height="24">
                                <rect width="24" height="24" fill="#DEEBFF" rx="4" />
                                <rect width="10" height="10" x="7" y="7" fill="#0052CC" rx="1" />
                            </svg>
                        </button>
                        <Link href="#" className="text-[#0052CC] font-semibold text-base">
                            TaskFlow
                        </Link>

                        {/* Menu items */}
                        <div className="flex items-center space-x-2 relative">
                            {menuItems.map((menu, index) => (
                                <div key={index} className="relative">
                                    {/* Menu button */}
                                    <button
                                        className={`flex items-center space-x-1 px-2 py-1 rounded hover:bg-gray-100 ${
                                            openDropdown === menu.title ? "text-[#0052CC] border-b-2 border-[#0052CC]" : ""
                                        }`}
                                        onMouseEnter={() => handleMenuEnter(menu.title)}
                                    >
                                        <span>{menu.title}</span>
                                        <ChevronDown className="h-3 w-3" />
                                    </button>

                                    {/* Dropdown menu */}
                                    {openDropdown === menu.title && (
                                        <div
                                            className="absolute left-0 top-full mt-1 w-60 bg-white border rounded shadow-md p-2 z-50 max-h-80 overflow-y-auto"
                                            onMouseEnter={() => handleMenuEnter(menu.title)}
                                            onMouseLeave={() => handleMenuLeave(menu.title)}
                                        >
                                            {/* Show loading state for projects */}
                                            {menu.title === "Projects" && isLoadingProjects && (
                                                <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-sm">
                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                                                    <span>Loading projects...</span>
                                                </div>
                                            )}
                                            
                                            {menu.items.map((item, idx) => {
                                                if (item.href) {
                                                    // Render as Link for items with href
                                                    return (
                                                        <Link
                                                            key={idx}
                                                            href={item.href}
                                                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-800 text-sm rounded"
                                                        >
                                                            <item.icon className="h-4 w-4 text-gray-500" />
                                                            <span>{item.label}</span>
                                                        </Link>
                                                    );
                                                } else {
                                                    // Add separator before user projects
                                                    const isFirstProject = idx > 0 && menu.items[idx - 1].href && !item.href;
                                                    
                                                    return (
                                                        <div key={idx}>
                                                            {isFirstProject && (
                                                                <hr className="my-2 border-gray-200" />
                                                            )}
                                                            <button
                                                                onClick={item.onClick}
                                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-800 text-sm rounded cursor-pointer text-left"
                                                            >
                                                                <item.icon className="h-4 w-4 text-blue-500" />
                                                                <span className="truncate">{item.label}</span>
                                                                {item.projectId && (
                                                                    <span className="ml-auto text-xs text-gray-400">Project</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                            })}
                                            
                                            {/* Show empty state if no projects */}
                                            {menu.title === "Projects" && !isLoadingProjects && userProjects.length === 0 && (
                                                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                                                    <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                                    <p>No projects found</p>
                                                    <p className="text-xs mt-1 mb-3">You're not a member of any projects yet.</p>
                                                    <Link 
                                                        href="/project/create_project"
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                                    >
                                                        <FolderPlus className="h-3 w-3" />
                                                        Create your first project
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center space-x-4">
                        {/* Notification Dropdown - only render on client-side with valid userId */}
                        {isMounted && currentUser && <NotificationDropdown userId={currentUser.id} />}

                        <div className="relative">
                            {/* Use UserAvatar component instead of static Avatar */}
                            {isMounted && currentUser ? (
                                <div
                                    className="cursor-pointer"
                                    onMouseEnter={() => handleMenuEnter("user-menu")}
                                >
                                    <UserAvatar 
                                        user={currentUser} 
                                        size="sm" 
                                        className="w-7 h-7 hover:ring-2 hover:ring-blue-300 transition-all" 
                                    />
                                </div>
                            ) : (
                                <Avatar 
                                    className="h-7 w-7 bg-gray-400 text-white cursor-pointer"
                                    onMouseEnter={() => handleMenuEnter("user-menu")}
                                >
                                    <span className="text-xs font-medium">?</span>
                                </Avatar>
                            )}

                            {/* User dropdown */}
                            {isMounted && openDropdown === "user-menu" && (
                                <div
                                    className="absolute right-0 top-full mt-1 w-48 bg-white border rounded shadow-md p-2 z-50"
                                    onMouseEnter={() => handleMenuEnter("user-menu")}
                                    onMouseLeave={() => handleMenuLeave("user-menu")}
                                >
                                    {/* User info section */}
                                    {currentUser && (
                                        <div className="px-3 py-2 border-b border-gray-100 mb-1">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={currentUser} size="sm" className="w-8 h-8" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {currentUser.username}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">
                                                        {currentUser.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-800 text-sm rounded cursor-pointer">
                                        <User className="h-4 w-4 text-gray-500" />
                                        <Link href="/profile" className="flex-1">
                                            Profile
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-800 text-sm rounded cursor-pointer">
                                        <Shield className="h-4 w-4 text-gray-500" />
                                        <Link href="/account_settings" className="flex-1">
                                            Account Settings
                                        </Link>
                                    </div>
                                    <div
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-800 text-sm rounded cursor-pointer"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-4 w-4 text-gray-500" />
                                        <span>Logout</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 