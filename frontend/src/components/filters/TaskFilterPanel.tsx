import React from "react";
import { Input } from "@/components/ui/input";
import { FaTimes } from "react-icons/fa";
import { Filter } from "lucide-react";

// Shared interfaces
export interface FilterState {
  searchText: string;
  status: string[];
  assignee: string[];
  priority: string[];
  labels: string[];
  createdDateFrom: string;
  createdDateTo: string;
  updatedDateFrom: string;
  updatedDateTo: string;
}

export interface ProjectUser {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  userRole?: string;
  avatar?: string;
  avatarUrl?: string;
}

interface TaskFilterPanelProps {
  // Filter state and handlers
  filters: FilterState;
  onFilterChange: (filterType: keyof FilterState, value: any) => void;
  onToggleArrayFilter: (filterType: keyof FilterState, value: string) => void;
  onClearAllFilters: () => void;
  
  // Display options
  showFilters: boolean;
  onToggleFilters: () => void;
  
  // Data for filter options
  projectUsers: ProjectUser[];
  availableLabels: string[];
  
  // Results info
  totalTasks: number;
  filteredTasks: number;
  
  // Avatar component
  AvatarComponent: React.ComponentType<{
    avatarUrl?: string;
    displayName: string;
    size?: "small" | "normal";
  }>;
  
  // Additional header content (optional)
  headerContent?: React.ReactNode;
}

// Available filter options (constants)
const statusOptions = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const priorityOptions = ["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST", "BLOCKER", "BLOCK"];

export const TaskFilterPanel: React.FC<TaskFilterPanelProps> = ({
  filters,
  onFilterChange,
  onToggleArrayFilter,
  onClearAllFilters,
  showFilters,
  onToggleFilters,
  projectUsers,
  availableLabels,
  totalTasks,
  filteredTasks,
  AvatarComponent,
  headerContent
}) => {
  const hasActiveFilters = (
    filters.status.length > 0 || 
    filters.assignee.length > 0 || 
    filters.priority.length > 0 || 
    filters.labels.length > 0 || 
    filters.createdDateFrom || 
    filters.createdDateTo || 
    filters.updatedDateFrom || 
    filters.updatedDateTo
  );

  return (
    <>
      {/* Header with Search and Filter Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            {headerContent}
            <div className="mt-2 text-sm text-gray-500">
              Showing {filteredTasks} of {totalTasks} tasks
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks..."
                value={filters.searchText}
                onChange={(e) => onFilterChange("searchText", e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            {/* Filter Toggle */}
            <div
              onClick={onToggleFilters}
              className={`p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 ${
                showFilters ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Toggle Filters"
            >
              <Filter className="w-5 h-5" />
            </div>
            
            {/* Clear Filters */}
            {hasActiveFilters && (
              <div
                onClick={onClearAllFilters}
                className="p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-red-50 text-red-500 hover:text-red-700"
                title="Clear All Filters"
              >
                <FaTimes className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Status Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Status</label>
                </div>
                <div className="space-y-2">
                  {statusOptions.map((status) => (
                    <label key={status} className="flex items-center group cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => onToggleArrayFilter("status", status)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className={`ml-3 text-sm px-2 py-1 rounded-md font-medium transition-all ${
                        status === "TODO" ? "bg-gray-200 text-gray-800" :
                        status === "IN_PROGRESS" ? "bg-blue-200 text-blue-800" :
                        status === "REVIEW" ? "bg-purple-200 text-purple-800" :
                        status === "DONE" ? "bg-green-200 text-green-800" :
                        "bg-gray-200 text-gray-800"
                      } ${
                        filters.status.includes(status) ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                      }`}>
                        {status.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Assignee Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Assignee</label>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {projectUsers.map((user) => (
                    <label key={user.id} className="flex items-center group cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.assignee.includes(user.id)}
                        onChange={() => onToggleArrayFilter("assignee", user.id)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <AvatarComponent 
                          avatarUrl={user.avatarUrl || user.avatar}
                          displayName={user.name || user.username || user.email || "User"}
                          size="small"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                          {user.name || user.username || user.email || "User"}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Priority</label>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {priorityOptions.map((priority) => (
                    <label key={priority} className="flex items-center group cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.priority.includes(priority)}
                        onChange={() => onToggleArrayFilter("priority", priority)}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                      />
                      <span className={`ml-3 text-sm px-3 py-1 rounded-full font-medium transition-all ${
                        priority === 'BLOCKER' ? 'bg-red-200 text-red-900 border-red-400' :
                        priority === 'HIGHEST' ? 'bg-red-100 text-red-800 border-red-300' :
                        priority === 'HIGH' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                        priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        priority === 'LOW' ? 'bg-green-100 text-green-800 border-green-300' :
                        priority === 'LOWEST' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        priority === 'BLOCK' ? 'bg-gray-200 text-gray-700 border-gray-400' :
                        'bg-gray-100 text-gray-800 border-gray-300'
                      } ${
                        filters.priority.includes(priority) ? 'ring-2 ring-orange-500 ring-opacity-50 transform scale-105' : 'group-hover:scale-105'
                      }`}>
                        {priority}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Labels Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Labels</label>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {availableLabels.length > 0 ? (
                    availableLabels.map((label) => (
                      <label key={label} className="flex items-center group cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.labels.includes(label)}
                          onChange={() => onToggleArrayFilter("labels", label)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <span className="ml-3 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 rounded-full text-sm font-medium group-hover:from-purple-200 group-hover:to-blue-200 transition-all">
                          {label}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No labels available</div>
                  )}
                </div>
              </div>
            </div>

            {/* Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Created Date From */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Created From</label>
                </div>
                <Input
                  type="date"
                  value={filters.createdDateFrom}
                  onChange={(e) => onFilterChange("createdDateFrom", e.target.value)}
                  className="w-full h-10 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Created Date To */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-gray-800">Created To</label>
                </div>
                <Input
                  type="date"
                  value={filters.createdDateTo}
                  onChange={(e) => onFilterChange("createdDateTo", e.target.value)}
                  className="w-full h-10 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Filter Summary */}
            {hasActiveFilters && (
              <div className="mt-6 pt-4 border-t border-gray-300">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex flex-wrap gap-2">
                    {filters.status.length > 0 && (
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-blue-200">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className="text-sm text-blue-700 font-semibold">{filters.status.join(", ")}</span>
                      </div>
                    )}
                    {filters.assignee.length > 0 && (
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-green-200">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Assignee:</span>
                        <span className="text-sm text-green-700 font-semibold">{filters.assignee.length} selected</span>
                      </div>
                    )}
                    {filters.priority.length > 0 && (
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-orange-200">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Priority:</span>
                        <span className="text-sm text-orange-700 font-semibold">{filters.priority.join(", ")}</span>
                      </div>
                    )}
                    {filters.labels.length > 0 && (
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-purple-200">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Labels:</span>
                        <span className="text-sm text-purple-700 font-semibold">{filters.labels.length} selected</span>
                      </div>
                    )}
                    {(filters.createdDateFrom || filters.createdDateTo) && (
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-indigo-200">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Date Range:</span>
                        <span className="text-sm text-indigo-700 font-semibold">
                          {filters.createdDateFrom || '...'} - {filters.createdDateTo || '...'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                      <span className="text-sm text-gray-600">Results: </span>
                      <span className="text-sm font-bold text-gray-900">
                        {filteredTasks} tasks
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}; 