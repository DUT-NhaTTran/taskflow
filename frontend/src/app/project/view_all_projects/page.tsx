"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TopNavigation } from "@/components/ui/top-navigation";
import { Dropdown } from "@/components/ui/drop-down";
import { useRouter } from "next/navigation";
import { useUserStorage } from "@/hooks/useUserStorage";
import { toast } from "sonner";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { API_CONFIG } from "@/lib/config";
import { 
    Project, 
    getUserId, 
    fetchUserDetailsWithFallback, 
    processAvatarUrl, 
    parseApiResponse,
    sendProjectDeletionNotifications 
} from "@/utils/projectHelpers";

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState<string>("All");
    const [isLoading, setIsLoading] = useState(true);
    const [loadingDeleted, setLoadingDeleted] = useState(false);
    const [enrichingProjects, setEnrichingProjects] = useState(false);
    const [showDeletedProjects, setShowDeletedProjects] = useState(false);
    const [noUserFound, setNoUserFound] = useState(false);
    
    // Modal states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
    const [projectToPermanentDelete, setProjectToPermanentDelete] = useState<Project | null>(null);
    
    // Caches
    const [projectDetailsCache, setProjectDetailsCache] = useState<Record<string, Project>>({});
    const [userDetailsCache, setUserDetailsCache] = useState<Record<string, any>>({});

    const { userData, isLoading: userLoading } = useUserStorage();
    const router = useRouter();

    // Fetch project details and enrich with permissions
    const fetchProjectDetails = async (projectId: string): Promise<Project | null> => {
        try {
            if (projectDetailsCache[projectId]) {
                return projectDetailsCache[projectId];
            }

            const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}?includeDeleted=true`);
            
            if (response.data?.status === "SUCCESS" && response.data?.data) {
                const projectData = response.data.data;
                const currentUserId = getUserId();
                const isOwner = currentUserId && projectData.ownerId && currentUserId === projectData.ownerId;
                
                let ownerName = 'Unknown Owner';
                let ownerAvatar = '';
                
                if (projectData.ownerId) {
                    const ownerData = await fetchUserDetailsWithFallback(
                        projectData.ownerId, 
                        userDetailsCache, 
                        setUserDetailsCache, 
                        projectData.name
                    );
                    
                    if (ownerData) {
                        ownerName = ownerData.fullname || ownerData.username || ownerData.email || 'Unknown Owner';
                        ownerAvatar = processAvatarUrl(ownerData.avatar);
                    } else {
                        ownerName = `Owner (${projectData.ownerId.substring(0, 8)}...)`;
                    }
                } else {
                    ownerName = 'No Owner';
                }
                
                const detailedProject: Project = {
                    id: projectData.id,
                    name: projectData.name,
                    key: projectData.key,
                    projectType: projectData.projectType || 'Software',
                    access: projectData.access || 'Private',
                    leadName: ownerName,
                    ownerId: projectData.ownerId,
                    ownerName: ownerName,
                    ownerAvatar: ownerAvatar,
                    canEdit: isOwner,
                    canDelete: isOwner,
                    deletedAt: projectData.deletedAt
                };
                
                setProjectDetailsCache(prev => ({ ...prev, [projectId]: detailedProject }));
                return detailedProject;
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching project details:', error);
            return null;
        }
    };

    // Enrich projects with permissions and owner details
    const enrichProjectsWithPermissions = async (basicProjects: Project[]): Promise<Project[]> => {
        try {
            const batchSize = 3;
            const enrichedProjects: Project[] = [];
            
            for (let i = 0; i < basicProjects.length; i += batchSize) {
                const batch = basicProjects.slice(i, i + batchSize);
                
                const enrichedBatch = await Promise.all(
                    batch.map(async (project) => {
                        const details = await fetchProjectDetails(project.id);
                        return details || project;
                    })
                );
                
                enrichedProjects.push(...enrichedBatch);
                
                if (i + batchSize < basicProjects.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            return enrichedProjects;
        } catch (error) {
            console.error('❌ Error enriching projects:', error);
            return basicProjects;
        }
    };

    // Fetch all active projects
    const fetchAllProjects = async () => {
        try {
            setIsLoading(true);
            const userId = getUserId();
            
            if (!userId) {
                setNoUserFound(true);
                setIsLoading(false);
                return;
            }

            setNoUserFound(false);

            // Fetch both owned and member projects
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/owner/${userId}`),
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/member/${userId}`)
            ]);

            let allProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled') {
                const ownedProjects = parseApiResponse(ownedResponse.value.data);
                allProjects.push(...ownedProjects);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled') {
                const memberProjects = parseApiResponse(memberResponse.value.data);
                allProjects.push(...memberProjects);
            }

            // Remove duplicates by ID (in case user is both owner and member)
            const uniqueProjects = allProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );

            // Filter only active projects (not deleted)
            const activeProjects = uniqueProjects.filter((project: any) => !project.deletedAt);

                if (activeProjects.length === 0) {
                    setProjects([]);
                    setIsLoading(false);
                    return;
                }

                setEnrichingProjects(true);
                const enrichedProjects = await enrichProjectsWithPermissions(activeProjects);
                setEnrichingProjects(false);
                setProjects(enrichedProjects);
        } catch (error) {
            setProjects([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch deleted projects
    const fetchDeletedProjects = async () => {
        try {
            setLoadingDeleted(true);
            const userId = getUserId();
            if (!userId) return;

            // Fetch both owned and member projects (including deleted)
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/owner/${userId}`),
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member?keyword=&userId=${userId}&includeDeleted=true`)
            ]);

            let allProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled') {
                const ownedProjects = parseApiResponse(ownedResponse.value.data);
                allProjects.push(...ownedProjects);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled') {
                const memberProjects = parseApiResponse(memberResponse.value.data);
                allProjects.push(...memberProjects);
            }

            // Remove duplicates by ID
            const uniqueProjects = allProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );

            // Filter only deleted projects
            const deletedProjectsData = uniqueProjects.filter((project: any) => project.deletedAt);
            
            if (deletedProjectsData.length > 0) {
                const enrichedDeletedProjects = await enrichProjectsWithPermissions(deletedProjectsData);
                setDeletedProjects(enrichedDeletedProjects);
            } else {
                setDeletedProjects([]);
            }
        } catch (error) {
            toast.error("Failed to load deleted projects");
        } finally {
            setLoadingDeleted(false);
        }
    };

    // Search projects
    const fetchSearchResults = async (term: string) => {
        try {
            const userId = getUserId();
            if (!userId) return;

            const res = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/search/member`, {
                params: { keyword: term, userId: userId },
            });
            
            const projectsData = parseApiResponse(res.data);
            setProjects(projectsData);
        } catch (err) {
            console.error("Error searching user projects:", err);
            setProjects([]);
        }
    };

    // Filter projects by type
    const fetchFilteredProjects = async (type: string) => {
            if (type === "All") {
                fetchAllProjects();
                return;
            }

        try {
            const userId = getUserId();
            if (!userId) return;

            // Fetch both owned and member projects
            const [ownedResponse, memberResponse] = await Promise.allSettled([
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/owner/${userId}`),
                axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/member/${userId}`)
            ]);

            let allUserProjects: Project[] = [];

            // Handle owned projects
            if (ownedResponse.status === 'fulfilled') {
                const ownedProjects = parseApiResponse(ownedResponse.value.data);
                allUserProjects.push(...ownedProjects);
            }

            // Handle member projects
            if (memberResponse.status === 'fulfilled') {
                const memberProjects = parseApiResponse(memberResponse.value.data);
                allUserProjects.push(...memberProjects);
            }

            // Remove duplicates by ID (in case user is both owner and member)
            const uniqueProjects = allUserProjects.filter((project, index, self) => 
                index === self.findIndex(p => p.id === project.id)
            );
            
            // Filter by project type
            const filteredProjects = uniqueProjects.filter((project: Project) => 
                project.projectType?.toLowerCase() === type.toLowerCase()
            );
            
            setProjects(filteredProjects);
        } catch (err) {
            setProjects([]);
        }
    };

    // Project action handlers
    const handleProjectClick = async (projectId: string) => {
        const projectDetails = await fetchProjectDetails(projectId);
        if (projectDetails) {
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...projectDetails } : p));
        }
        router.push(`/project/project_homescreen?projectId=${projectId}`);
    };

    const handleProjectEdit = async (projectId: string) => {
        const projectDetails = await fetchProjectDetails(projectId);
        if (projectDetails?.canEdit) {
            router.push(`/project/edit_project?projectId=${projectId}`);
        } else {
            toast.error("Permission denied", {
                description: "You don't have permission to edit this project. Only the project owner can edit projects."
            });
        }
    };

    const handleProjectDelete = async (projectId: string) => {
        const projectDetails = await fetchProjectDetails(projectId);
        if (!projectDetails?.canDelete) {
            toast.error("Permission denied", {
                description: "You don't have permission to delete this project. Only the project owner can delete projects."
            });
            return;
        }
        setProjectToDelete(projectDetails);
        setShowDeleteConfirm(true);
    };

    const handleRestoreProject = async (projectId: string, projectName: string) => {
        try {
            toast.loading("Restoring project...", { id: `restore-${projectId}` });

            const restoreResponse = await axios.put(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/restore`, {
                restoredBy: getUserId(),
                restoredAt: new Date().toISOString()
            });

            if (restoreResponse.data?.status === "SUCCESS" || restoreResponse.status === 200) {
                setDeletedProjects(prev => prev.filter(p => p.id !== projectId));
                setProjectDetailsCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[projectId];
                    return newCache;
                });
                
                toast.success("Project restored successfully", {
                    id: `restore-${projectId}`,
                    description: `"${projectName}" has been restored and is now active again.`
                });

                fetchAllProjects();
            }
        } catch (error) {
            console.error('❌ Error restoring project:', error);
            toast.error("Failed to restore project", {
                id: `restore-${projectId}`,
                description: "Please try again or contact support."
            });
        }
    };

    const handlePermanentDelete = async (projectId: string, projectName: string) => {
        const project = deletedProjects.find(p => p.id === projectId);
        if (!project) {
            toast.error("Project not found");
            return;
        }
        setProjectToPermanentDelete(project);
        setShowPermanentDeleteConfirm(true);
    };

    // Confirmation handlers
    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            toast.loading("Archiving project...", { id: `delete-${projectToDelete.id}` });

            // Get project members for notification
            let projectMembers: any[] = [];
            try {
                const membersResponse = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectToDelete.id}/users`);
                projectMembers = parseApiResponse(membersResponse.data);
            } catch (memberError) {
                console.warn('⚠️ Failed to fetch project members:', memberError);
            }

            // Send notifications first
            toast.loading("Notifying project members...", { id: `delete-${projectToDelete.id}` });
            
            let notificationSuccess = false;
            try {
                await sendProjectDeletionNotifications(projectToDelete, projectMembers);
                notificationSuccess = true;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (notifError) {
                console.warn('⚠️ Failed to send notifications:', notifError);
            }

            // Soft delete project
            toast.loading("Archiving project...", { id: `delete-${projectToDelete.id}` });
            
            const softDeleteResponse = await axios.put(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectToDelete.id}/soft-delete`, {
                deletedAt: new Date().toISOString(),
                deletedBy: getUserId()
            });

            if (softDeleteResponse.data?.status === "SUCCESS" || softDeleteResponse.status === 200) {
                setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
                setProjectDetailsCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[projectToDelete.id];
                    return newCache;
                });
                
                // Clear from storage if needed
                const deletedProjectId = projectToDelete.id;
                const currentProjectId = localStorage.getItem('currentProjectId') || sessionStorage.getItem('currentProjectId');
                if (currentProjectId === deletedProjectId) {
                    localStorage.removeItem('currentProjectId');
                    localStorage.removeItem('currentProjectName');
                    localStorage.removeItem('currentProjectKey');
                    localStorage.removeItem('currentProjectType');
                    sessionStorage.removeItem('currentProjectId');
                    sessionStorage.removeItem('currentProjectName');
                    sessionStorage.removeItem('currentProjectKey');
                }
                
                toast.success("Project archived successfully", {
                    id: `delete-${projectToDelete.id}`,
                    description: notificationSuccess 
                        ? `"${projectToDelete.name}" has been archived and members have been notified.`
                        : `"${projectToDelete.name}" has been archived. Some notifications may have failed.`
                });
                
                setTimeout(() => {
                    window.location.href = '/project/project_homescreen';
                }, 1500);
            }
        } catch (error) {
            console.error('❌ Error in project soft deletion:', error);
            toast.error("Failed to archive project", {
                id: `delete-${projectToDelete.id}`,
                description: "Please try again or contact support."
            });
        } finally {
            setShowDeleteConfirm(false);
            setProjectToDelete(null);
        }
    };

    const confirmPermanentDelete = async () => {
        if (!projectToPermanentDelete) return;

        try {
            toast.loading("Permanently deleting project...", { id: `permanent-delete-${projectToPermanentDelete.id}` });

            const deleteResponse = await axios.delete(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectToPermanentDelete.id}/permanent`);

            if (deleteResponse.data?.status === "SUCCESS" || deleteResponse.status === 200) {
                setDeletedProjects(prev => prev.filter(p => p.id !== projectToPermanentDelete.id));
                setProjectDetailsCache(prev => {
                    const newCache = { ...prev };
                    delete newCache[projectToPermanentDelete.id];
                    return newCache;
                });

                toast.success("Project permanently deleted", {
                    id: `permanent-delete-${projectToPermanentDelete.id}`,
                    description: `"${projectToPermanentDelete.name}" has been permanently deleted and cannot be recovered.`
                });
            }
        } catch (error) {
            console.error('❌ Error permanently deleting project:', error);
            toast.error("Failed to permanently delete project", {
                id: `permanent-delete-${projectToPermanentDelete.id}`,
                description: "Please try again or contact support."
            });
        } finally {
            setShowPermanentDeleteConfirm(false);
            setProjectToPermanentDelete(null);
        }
    };

    // Effects
    useEffect(() => {
        if (!userLoading) {
            const userId = getUserId();
            if (userId) {
                fetchAllProjects();
            } else {
                console.error("No user ID found");
                setIsLoading(false);
            }
        }
    }, [userData?.account?.id, userLoading]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                    setProjectToDelete(null);
                }
                if (showPermanentDeleteConfirm) {
                    setShowPermanentDeleteConfirm(false);
                    setProjectToPermanentDelete(null);
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showDeleteConfirm, showPermanentDeleteConfirm]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (!searchTerm.trim()) {
                selectedType === "All" ? fetchAllProjects() : fetchFilteredProjects(selectedType);
                return;
            }
            fetchSearchResults(searchTerm);
        }, 400);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm, selectedType]);

    // Render loading state
    if (userLoading || isLoading || (showDeletedProjects && loadingDeleted)) {
    return (
        <div className="min-h-screen bg-gray-100">
            <TopNavigation />
                <div className="max-w-7xl mx-auto p-6">
                    <div className="p-8 text-center">
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">
                                {userLoading ? "Loading user..." : 
                                 showDeletedProjects ? "Loading archived projects..." : 
                                 "Loading projects..."}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render no user found state
    if (noUserFound) {
        return (
            <div className="min-h-screen bg-gray-100">
                <TopNavigation />
                <div className="max-w-7xl mx-auto p-6">
                    <div className="p-8 text-center">
                        <div className="max-w-md mx-auto">
                            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-red-100 rounded-full text-red-500">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="currentColor"/>
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
                            <p className="text-gray-500 mb-4">No user session found. Please login to access your projects.</p>
                            <div className="space-y-2">
                                <Button 
                                    className="bg-blue-600 text-white hover:bg-blue-700 w-full"
                                    onClick={() => router.push('/auth/login')}
                                >
                                    Login
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setNoUserFound(false);
                                        fetchAllProjects();
                                    }}
                                >
                                    I'm Already Logged In - Retry
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <TopNavigation />

            <div className="max-w-7xl mx-auto p-6">
                {/* Page Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-semibold text-gray-800">
                        {showDeletedProjects ? "Archived Projects" : "My Projects"}
                    </h1>
                    <div className="flex gap-2">
                        {/* Toggle button for deleted projects */}
                        <Button
                            variant={showDeletedProjects ? "default" : "outline"}
                            className={showDeletedProjects ? "bg-orange-600 hover:bg-orange-700 text-white" : "border-orange-300 text-orange-600 hover:bg-orange-50"}
                            onClick={() => {
                                setShowDeletedProjects(!showDeletedProjects);
                                if (!showDeletedProjects && deletedProjects.length === 0) {
                                    fetchDeletedProjects();
                                }
                            }}
                        >
                            {showDeletedProjects ? (
                                <>
                                    <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Back to Active
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    View Archived ({deletedProjects.length})
                                </>
                            )}
                        </Button>
                        
                        {/* Refresh button */}
                        <Button
                            variant="outline"
                            className="border-blue-300 text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                                setUserDetailsCache({});
                                setProjectDetailsCache({});
                                sessionStorage.removeItem('userServiceDownNotified');
                                
                                if (showDeletedProjects) {
                                    fetchDeletedProjects();
                                } else {
                                    fetchAllProjects();
                                }
                                
                                toast.success("Refreshing...", {
                                    description: "Clearing cache and reloading project data."
                                });
                            }}
                        >
                            <svg width="16" height="16" className="mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Refresh
                        </Button>
                        
                        {!showDeletedProjects && (
                            <Button
                                className="bg-[#0052CC] hover:bg-[#0747A6] text-white text-sm"
                                onClick={() => router.push("/project/create_project")}
                            >
                                Create Project
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                {!showDeletedProjects && (
                    <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                            <Input
                                placeholder="Search projects..."
                                className="w-full sm:w-80 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className="w-48">
                                <Dropdown
                                    placeholder="Filter by product"
                                    options={["All", "Team-managed", "Company-managed"]}
                                    onSelect={(value) => {
                                        setSelectedType(value);
                                        if (!searchTerm.trim()) {
                                            fetchFilteredProjects(value);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Projects Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-auto">
                    {/* Show enriching progress */}
                    {enrichingProjects && !isLoading && (
                        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                            <div className="flex items-center gap-2 text-blue-700">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-sm">Loading owner details and avatars...</span>
                            </div>
                        </div>
                    )}
                    
                    <ProjectTable
                        projects={showDeletedProjects ? deletedProjects : projects}
                        isDeleted={showDeletedProjects}
                        onProjectClick={handleProjectClick}
                        onProjectEdit={handleProjectEdit}
                        onProjectDelete={handleProjectDelete}
                        onProjectRestore={handleRestoreProject}
                        onPermanentDelete={handlePermanentDelete}
                    />
                                                </div>

                {/* Pagination */}
                <div className="flex justify-center mt-6">
                    <div className="border rounded px-3 py-1 text-sm text-gray-600 bg-white shadow-sm">
                        1
                    </div>
                </div>
            </div>
            
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && projectToDelete && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDeleteConfirm(false);
                            setProjectToDelete(null);
                        }
                    }}
                >
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl"
                         onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Archive Project</h3>
                                <p className="text-sm text-gray-500">This project will be moved to archive</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                Are you sure you want to archive the project <span className="font-semibold">"{projectToDelete.name}"</span>?
                            </p>
                            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3">
                                <p className="text-orange-800 text-sm">
                                    <strong>📦 Archive Info:</strong> This will move the project to archive:
                                </p>
                                <ul className="text-orange-700 text-sm mt-2 space-y-1">
                                    <li>• Project will be hidden from active projects</li>
                                    <li>• All data will be preserved safely</li>
                                    <li>• You can restore it anytime from archived projects</li>
                                    <li>• Members will lose access until restored</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setProjectToDelete(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmDeleteProject}
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                            >
                                Archive Project
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Permanent Delete Confirmation Modal */}
            {showPermanentDeleteConfirm && projectToPermanentDelete && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowPermanentDeleteConfirm(false);
                            setProjectToPermanentDelete(null);
                        }
                    }}
                >
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl"
                         onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Permanently Delete Project</h3>
                                <p className="text-sm text-red-600 font-medium">⚠️ This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-gray-700 mb-3">
                                Are you sure you want to permanently delete <span className="font-semibold text-red-600">"{projectToPermanentDelete.name}"</span>?
                            </p>
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                <p className="text-red-800 text-sm">
                                    <strong>This will completely remove all project data and cannot be undone.</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowPermanentDeleteConfirm(false);
                                    setProjectToPermanentDelete(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmPermanentDelete}
                                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                            >
                                Permanently Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}