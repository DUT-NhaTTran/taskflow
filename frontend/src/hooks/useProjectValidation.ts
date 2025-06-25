import { useEffect } from 'react';
import { API_CONFIG } from "@/lib/config";
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import axios from 'axios';

interface UseProjectValidationOptions {
  projectId: string | null;
  onProjectNotFound?: () => void;
  redirectPath?: string;
}

export const useProjectValidation = ({ 
  projectId, 
  onProjectNotFound,
  redirectPath = '/project/view_all_projects' 
}: UseProjectValidationOptions) => {
  const router = useRouter();

  useEffect(() => {
    const validateProject = async () => {
      if (!projectId) {
        console.warn('No project ID provided');
        return;
      }

      try {
        console.log('🔍 Validating project:', projectId);
        const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}`);
        
        if (response.data?.status !== "SUCCESS" || !response.data?.data) {
          console.error('❌ Project validation failed:', response.data);
          handleProjectNotFound();
        } else {
          console.log('✅ Project validation successful');
        }
      } catch (error: any) {
        console.error('❌ Error validating project:', error);
        
        if (error?.response?.status === 404) {
          handleProjectNotFound();
        }
        // For other errors, don't redirect automatically
      }
    };

    const handleProjectNotFound = () => {
      toast.error("Project no longer exists", {
        description: "This project may have been deleted. Redirecting to projects page..."
      });

      // Clear project from storage
      const currentProjectId = localStorage.getItem('currentProjectId') || sessionStorage.getItem('currentProjectId');
      if (currentProjectId === projectId) {
        localStorage.removeItem('currentProjectId');
        localStorage.removeItem('currentProjectName');
        localStorage.removeItem('currentProjectKey');
        localStorage.removeItem('currentProjectType');
        sessionStorage.removeItem('currentProjectId');
        sessionStorage.removeItem('currentProjectName');
        sessionStorage.removeItem('currentProjectKey');
        console.log('🧹 Cleared non-existent project from storage');
      }

      // Call custom handler if provided
      if (onProjectNotFound) {
        onProjectNotFound();
      }

      // Auto-redirect after delay
      setTimeout(() => {
        console.log('🚀 Auto-redirecting due to project validation failure');
        router.push(redirectPath);
      }, 2000);
    };

    // Only validate if we have a project ID
    if (projectId) {
      validateProject();
    }
  }, [projectId, router, redirectPath, onProjectNotFound]);

  return {
    // Could return validation status if needed in the future
  };
}; 