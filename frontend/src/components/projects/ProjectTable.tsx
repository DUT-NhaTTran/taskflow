import { Star, MoreHorizontal } from "lucide-react";
import { Project } from "@/utils/projectHelpers";

interface ProjectTableProps {
    projects: Project[];
    isDeleted?: boolean;
    onProjectClick: (projectId: string) => void;
    onProjectEdit?: (projectId: string) => void;
    onProjectDelete?: (projectId: string) => void;
    onProjectRestore?: (projectId: string, projectName: string) => void;
    onPermanentDelete?: (projectId: string, projectName: string) => void;
}

export function ProjectTable({
    projects,
    isDeleted = false,
    onProjectClick,
    onProjectEdit,
    onProjectDelete,
    onProjectRestore,
    onPermanentDelete
}: ProjectTableProps) {
    if (projects.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full text-gray-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {isDeleted ? "No Archived Projects" : "No Projects Found"}
                </h3>
                <p className="text-gray-500">
                    {isDeleted ? "You don't have any archived projects." : "No projects found matching your criteria."}
                </p>
            </div>
        );
    }

    const renderOwnerInfo = (project: Project) => (
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-orange-400 text-white text-xs flex items-center justify-center">
                {project.ownerAvatar ? (
                    <img 
                        src={project.ownerAvatar} 
                        alt={project.ownerName || 'Owner'} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                                parent.classList.add('bg-orange-400', 'text-white');
                                const initials = (project.ownerName || 'Owner')
                                    .split(' ')
                                    .map(word => word[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase();
                                parent.textContent = initials;
                            }
                        }}
                    />
                ) : (
                    (project.ownerName || project.leadName || '?')
                        .split(' ')
                        .map(word => word[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                )}
            </div>
            <span className="text-sm">{project.ownerName || project.leadName || "Unknown Owner"}</span>
        </div>
    );

    const renderProjectActions = (project: Project) => {
        if (isDeleted) {
            return (
                <div className="flex items-center justify-center gap-1">
                    {project.canEdit && onProjectRestore && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onProjectRestore(project.id, project.name);
                            }}
                            className="p-1 hover:bg-green-100 rounded text-green-600"
                            title="Restore Project (Owner)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 16l-5 5v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    )}
                    
                    {project.canDelete && onPermanentDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPermanentDelete(project.id, project.name);
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Permanently Delete Project (Owner)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center gap-1">
                {project.canEdit && (
                    <>
                        {onProjectEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProjectEdit(project.id);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-blue-600"
                                title="Edit Project (Owner)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        )}
                        
                        {onProjectDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onProjectDelete(project.id);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-red-600"
                                title="Delete Project (Owner)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        )}
                    </>
                )}
                
                {project.ownerId && !project.canEdit && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onProjectClick(project.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                        title="Open Project (Member)"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                )}
                
                {!project.ownerId && (
                    <MoreHorizontal size={18} className="text-gray-600 cursor-pointer" />
                )}
            </div>
        );
    };

    const tableHeaderClass = isDeleted ? "bg-orange-100" : "bg-gray-100";
    const rowHoverClass = isDeleted ? "hover:bg-orange-50" : "hover:bg-gray-50";
    const iconColor = isDeleted ? "text-orange-400" : "text-gray-400";

    return (
        <table className="w-full text-sm">
            <thead className={`${tableHeaderClass} text-left border-b`}>
                <tr>
                    <th className="px-4 py-3 w-12"></th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">
                        {isDeleted ? "Archived Date" : "Project URL"}
                    </th>
                    <th className="px-4 py-3 w-24 text-center">
                        {isDeleted ? "Actions" : "More"}
                    </th>
                </tr>
            </thead>
            <tbody>
                {projects.map((project) => (
                    <tr key={project.id} className={`border-b ${rowHoverClass}`}>
                        <td className={`px-4 py-3 ${iconColor}`}>
                            {isDeleted ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            ) : (
                                <Star size={16} />
                            )}
                        </td>
                        <td className={`px-4 py-3 font-medium ${isDeleted ? 'text-gray-600' : 'text-[#0052CC]'}`}>
                            <div className={`flex items-center gap-2 ${!isDeleted ? 'cursor-pointer hover:underline' : ''}`} 
                                 onClick={() => !isDeleted && onProjectClick(project.id)}>
                                <div className="w-6 h-6 rounded bg-orange-200 flex items-center justify-center text-white text-xs font-bold">
                                    {project.name[0].toUpperCase()}
                                </div>
                                {project.name}
                                {project.canEdit && (
                                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                        Owner
                                    </span>
                                )}
                                {project.ownerId && !project.canEdit && (
                                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                        {project.userRole || "Team Member"}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{project.key}</td>
                        <td className="px-4 py-3 text-gray-500">{project.projectType} software</td>
                        <td className="px-4 py-3">{renderOwnerInfo(project)}</td>
                        <td className="px-4 py-3">
                            {isDeleted ? (
                                <span className="text-gray-500 text-xs">
                                    {project.deletedAt ? new Date(project.deletedAt).toLocaleDateString() : 'Unknown'}
                                </span>
                            ) : (
                                <span className="text-blue-600 underline cursor-pointer" 
                                      onClick={() => onProjectClick(project.id)}>
                                    /projects/{project.id}
                                </span>
                            )}
                        </td>
                        <td className="px-4 py-3 text-center">
                            {renderProjectActions(project)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
} 