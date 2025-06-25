"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks, getDaysInMonth, startOfMonth, getDate, isSameMonth } from "date-fns";
import { vi } from "date-fns/locale";
import { TopNavigation } from "@/components/ui/top-navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/drop-down";
import { toast } from "sonner";
import { NavigationProgress } from "@/components/ui/LoadingScreen";
import { useNavigation } from "@/contexts/NavigationContext";
import { useUserStorage } from "@/hooks/useUserStorage";
import { ChevronLeft, ChevronRight, Search, Calendar as CalendarIcon, Filter, ChevronDown, X, RotateCcw, Edit } from "lucide-react";
import { safeValidateUUID, validateProjectId, validateSprintId, isValidUUID } from "@/utils/uuidUtils";
import { 
  getUserPermissions, 
  canManageSprints,
  canStartEndSprints,
  UserPermissions
} from "@/utils/permissions";
import { API_CONFIG } from "@/lib/config";

// Custom debounce function
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  const debouncedFunc = (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
  debouncedFunc.cancel = () => clearTimeout(timeoutId);
  return debouncedFunc;
};

// Type definitions
interface Task {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  sprintId?: string;
  dueDate?: string;
  startDate?: string;
  assigneeId?: string | null;
  assigneeName?: string;
}

interface Sprint {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  goal?: string;
  projectId?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
  avatar?: string;
}

interface CalendarWeek {
  days: Date[];
  sprints: SprintBar[];
}

interface SprintBar {
  id: string;
  name: string;
  startDay: number; 
  endDay: number;
  row: number;
  isFirst: boolean;
  isLast: boolean;
}

// Extract SprintModal component to make code clearer
const SprintDetailPopup = ({ 
  sprint, 
  position, 
  onClose,
  onEdit,
  userPermissions
}: { 
  sprint: Sprint, 
  position: { x: number, y: number }, 
  onClose: () => void,
  onEdit: (sprint: Sprint) => void,
  userPermissions: UserPermissions | null
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const startDate = sprint.startDate ? format(parseISO(sprint.startDate), 'MMM d, yyyy') : 'Not set';
  const endDate = sprint.endDate ? format(parseISO(sprint.endDate), 'MMM d, yyyy') : 'Not set';
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);
  
  // Get color scheme for the sprint - using simplified JIRA-like colors
  const getSprintColor = (name: string, id: string) => {
    // Create a deterministic color based on the sprint ID
    const hashCode = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return hash;
    };
    
    // Simple, clean color scheme with background colors
    const colorSets = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'text-blue-600', labelBg: 'bg-blue-50' },
      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'text-green-600', labelBg: 'bg-green-50' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'text-purple-600', labelBg: 'bg-purple-50' },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'text-amber-600', labelBg: 'bg-amber-50' },
      { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', accent: 'text-red-600', labelBg: 'bg-red-50' },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', accent: 'text-cyan-600', labelBg: 'bg-cyan-50' },
      { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'text-indigo-600', labelBg: 'bg-indigo-50' },
      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'text-orange-600', labelBg: 'bg-orange-50' },
    ];
    
    if (name.toLowerCase().includes('sprint 1') || name.toLowerCase().includes('scrum-1')) {
      return colorSets[0]; // Blue
    } else if (name.toLowerCase().includes('sprint 2') || name.toLowerCase().includes('scrum-2')) {
      return colorSets[1]; // Green
    } else if (name.toLowerCase().includes('sprint 3') || name.toLowerCase().includes('scrum-3')) {
      return colorSets[2]; // Purple
    } else if (name.toLowerCase().includes('sprint 4') || name.toLowerCase().includes('scrum-4')) {
      return colorSets[3]; // Amber
    } else if (name.toLowerCase().includes('new sprint')) {
      return colorSets[4]; // Red
    } else {
      const hash = Math.abs(hashCode(id));
      return colorSets[hash % colorSets.length];
    }
  };
  
  const colors = getSprintColor(sprint.name, sprint.id);
  
  // Calculate safe positioning to keep modal within viewport
  const adjustPositionForViewport = () => {
    const modalWidth = 320; // Width of modal in pixels
    const modalHeight = 200; // Approximate height of modal
    const padding = 16; // Padding from window edges
    
    // Check if modal would extend beyond right edge of viewport
    let left = position.x + 10;
    const viewportWidth = window.innerWidth;
    if (left + modalWidth > viewportWidth - padding) {
      // Position to the left of the sprint instead
      left = position.x - modalWidth - 10;
      
      // If that's still offscreen, position at right edge with padding
      if (left < padding) {
        left = viewportWidth - modalWidth - padding;
      }
    }
    
    // Check if modal would extend beyond bottom of viewport
    let top = position.y;
    const viewportHeight = window.innerHeight;
    if (top + modalHeight > viewportHeight - padding) {
      top = viewportHeight - modalHeight - padding;
    }
    
    // Ensure top is not negative
    if (top < padding) {
      top = padding;
    }
    
    return { left, top };
  };
  
  const { left, top } = adjustPositionForViewport();
  
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div 
        className={`fixed z-50 ${colors.bg} rounded-md shadow-lg w-80 border ${colors.border}`}
        style={{
          top: `${top}px`,
          left: `${left}px`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b ${colors.border} p-3`}>
          <div className="flex items-center gap-2">
            <RotateCcw className={`h-4 w-4 ${colors.accent}`} />
            <h2 className={`font-medium ${colors.text} uppercase text-sm`}>SPRINT</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              {userPermissions && canManageSprints(userPermissions) && (
                <button 
                  className={`${colors.accent} hover:opacity-80 p-1 rounded hover:bg-gray-100`}
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <span className="sr-only">Options</span>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="4" cy="10" r="2" />
                    <circle cx="10" cy="10" r="2" />
                    <circle cx="16" cy="10" r="2" />
                  </svg>
                </button>
              )}
              
              {showMenu && userPermissions && canManageSprints(userPermissions) && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => onEdit(sprint)}
                  >
                    <Edit className="h-3 w-3" />
                    Edit sprint
                  </button>
                </div>
              )}
            </div>
            <button 
              className={`${colors.accent} hover:opacity-80`}
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="p-3 pb-4">
          <div className="mb-3">
            <div className={`inline-block px-2 py-0.5 border rounded-sm bg-white border-gray-200 ${colors.text} text-xs font-medium mb-1`}>
              {sprint.status || 'ACTIVE'}
            </div>
            <h1 className={`text-xl font-bold ${colors.text}`}>{sprint.name}</h1>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className={`${colors.text} font-medium mb-1 text-sm`}>Start date</h3>
              <p className="text-base text-gray-700">{startDate}</p>
            </div>
            <div>
              <h3 className={`${colors.text} font-medium mb-1 text-sm`}>Planned end</h3>
              <p className="text-base text-gray-700">{endDate}</p>
            </div>
          </div>
          
          {sprint.goal && (
            <div className="mt-3">
              <h3 className={`${colors.text} font-medium mb-1 text-sm`}>Sprint goal</h3>
              <p className="text-sm text-gray-700">{sprint.goal}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Extract DayCell component
const DayCell = ({ day, columnIndex, currentDate }: { day: Date, columnIndex: number, currentDate: Date }) => {
  const isToday = isSameDay(day, new Date());
  const isCurrentMonth = isSameMonth(day, currentDate);
  const isWeekend = columnIndex === 5 || columnIndex === 6; // Highlight weekends
  
  // Format ngày hiển thị
  const dayNum = getDate(day);
  const formattedDay = isCurrentMonth 
    ? dayNum.toString() 
    : format(day, "MMM d").toLowerCase();
  
  return (
    <div 
      className={`h-full border-r border-b p-1 relative ${
        isToday ? "bg-blue-50" : isCurrentMonth ? (isWeekend ? "bg-gray-50" : "bg-white") : "bg-gray-100 text-gray-400"
      }`}
    >
      <div className={`text-right p-1 ${isToday ? "font-bold text-blue-600" : ""}`}>
        {formattedDay}
      </div>
      
      {/* Icon + cho ngày 29 */}
      {(dayNum === 29 && isCurrentMonth) && (
        <div className="absolute right-1 top-1 text-gray-400 cursor-pointer hover:text-gray-600">
          +
        </div>
      )}
    </div>
  );
};

// Calendar Toolbar component
const CalendarToolbar = ({
  currentDate,
  goToToday,
  previousMonth,
  nextMonth,
  searchTerm,
  onSearchChange,
  onMonthSelect,
  sprintsCount,
  totalSprintsCount
}: {
  currentDate: Date,
  goToToday: () => void,
  previousMonth: () => void,
  nextMonth: () => void,
  searchTerm: string,
  onSearchChange: (term: string) => void,
  onMonthSelect: (month: number) => void,
  sprintsCount: number,
  totalSprintsCount: number
}) => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Tạo options cho dropdown với tất cả 12 tháng
  const monthOptions = months.map((month, index) => {
    return month; // Đơn giản chỉ trả về tên tháng
  });

  const handleMonthDropdownSelect = (selectedOption: string) => {
    console.log('Month selected:', selectedOption); // Debug log
    const monthIndex = months.indexOf(selectedOption);
    console.log('Month index:', monthIndex); // Debug log
    
    if (monthIndex !== -1) {
      onMonthSelect(monthIndex);
    }
  };

  // Get current month display value for the dropdown
  const getCurrentMonthValue = () => {
    return months[currentMonth];
  };

  console.log('Current month options:', monthOptions); // Debug log
  console.log('Current month value:', getCurrentMonthValue()); // Debug log

  return (
    <div className="p-4 flex flex-wrap items-center gap-3 border-b bg-white">
      {/* Search Section */}
      <div className="flex items-center gap-3">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            className="pl-10 h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            placeholder="Search sprints..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full border-t-blue-500"></div>
            </div>
          )}
        </div>
        
        {/* Search Results Indicator */}
        {searchTerm && (
          <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md">
            <span className="font-medium text-blue-700">{sprintsCount}</span> of {totalSprintsCount} sprints found
          </div>
        )}
      </div>
      
      {/* Navigation Section */}
      <div className="ml-auto flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goToToday}
          className="h-9 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        >
          Today
        </Button>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            className="h-9 w-9 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="min-w-[140px] text-center px-3">
            <span className="font-semibold text-gray-900 text-base">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="h-9 w-9 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Month Dropdown - Standalone */}
        <div className="relative">
          <Dropdown
            options={monthOptions}
            onSelect={handleMonthDropdownSelect}
            defaultValue={getCurrentMonthValue()}
            placeholder="Select Month"
          />
        </div>
      
      </div>
    </div>
  );
};

// WeekRow component to render a week of the calendar
const WeekRow = ({ 
  week, 
  weekIndex, 
  currentDate, 
  sprints, 
  onSprintClick,
  highlightedSprintId
}: { 
  week: CalendarWeek, 
  weekIndex: number, 
  currentDate: Date, 
  sprints: Sprint[], 
  onSprintClick: (sprint: Sprint, e: React.MouseEvent) => void,
  highlightedSprintId?: string | null
}) => (
  <div key={`week-${weekIndex}`} className="relative">
    {/* Ngày trong tuần */}
    <div className="grid grid-cols-7" style={{ minHeight: '65px' }}>
      {week.days.map((day, dayIndex) => (
        <div key={`day-${weekIndex}-${dayIndex}`}>
          <DayCell day={day} columnIndex={dayIndex} currentDate={currentDate} />
        </div>
      ))}
    </div>
    
    {/* Sprint bars cho tuần này */}
    {week.sprints.map(sprint => {
      // Get color scheme for the sprint
      const getSprintColor = (name: string, id: string) => {
        const hashCode = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
          }
          return hash;
        };
        
        const colorSets = [
          { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-gray-700' },
          { bg: 'bg-green-50', border: 'border-green-300', text: 'text-gray-700' },
          { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-gray-700' },
          { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-gray-700' },
          { bg: 'bg-red-50', border: 'border-red-300', text: 'text-gray-700' },
          { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-gray-700' },
          { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-gray-700' },
          { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-gray-700' },
        ];
        
        if (name.toLowerCase().includes('sprint 1') || name.toLowerCase().includes('scrum-1')) {
          return colorSets[0];
        } else if (name.toLowerCase().includes('sprint 2') || name.toLowerCase().includes('scrum-2')) {
          return colorSets[1];
        } else if (name.toLowerCase().includes('sprint 3') || name.toLowerCase().includes('scrum-3')) {
          return colorSets[2];
        } else if (name.toLowerCase().includes('sprint 4') || name.toLowerCase().includes('scrum-4')) {
          return colorSets[3];
        } else if (name.toLowerCase().includes('new sprint')) {
          return colorSets[4];
        } else {
          const hash = Math.abs(hashCode(id));
          return colorSets[hash % colorSets.length];
        }
      };
      
      const colors = getSprintColor(sprint.name, sprint.id);
      const actualSprint = sprints.find(s => s.id === sprint.id);
      
      return (
        <div 
          key={`sprint-${sprint.id}-${weekIndex}-${sprint.row}`}
          className={`
            sprint-bar absolute h-6 z-10 cursor-pointer ${
              highlightedSprintId === sprint.id ? 'bg-blue-100' : ''
            }`}
          onClick={(e) => actualSprint && onSprintClick(actualSprint, e)}
          style={{
            gridRow: `row-sprint-${sprint.row}`,
            gridColumn: `${sprint.startDay + 1} / ${sprint.endDay + 2}`,
            top: `${24 + sprint.row * 24}px`,
            left: `${sprint.startDay * (100/7) + 1}%`,
            width: `${(sprint.endDay - sprint.startDay + 1) * (100/7) - 2}%`
          }}
        >
          <div 
            className={`
              h-full flex items-center justify-between px-1.5 ${colors.bg} border ${colors.border} text-xs
              ${sprint.isFirst ? 'rounded-l' : 'border-l-0 rounded-l-none'} 
              ${sprint.isLast ? 'rounded-r' : 'border-r-0 rounded-r-none'}
              shadow-sm hover:shadow-md transition-shadow
              ${highlightedSprintId === sprint.id ? 'ring-2 ring-blue-400 ring-offset-1 shadow-lg' : ''}
            `}
          >
            {sprint.isFirst && (
              <div className="flex items-center">
                <input type="checkbox" className="w-3 h-3 mr-1.5 rounded text-blue-500" checked disabled />
                <span className={`truncate font-medium text-xs ${colors.text}`}>{sprint.name}</span>
              </div>
            )}
          </div>
        </div>
      );
    })}
    
    {/* Khoảng trống dành cho các sprint (nếu có) */}
    <div 
      className="sprint-placeholder"
      style={{ 
        height: `${week.sprints.length > 0 ? week.sprints.reduce((max, s) => Math.max(max, s.row), 0) * 24 : 0}px`,
        marginBottom: '8px' // Thêm khoảng cách giữa các tuần
      }}
    ></div>
  </div>
);

// Loading component
const Loading = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
  </div>
);

// Main Calendar component
const CalendarView = ({ 
  calendarData, 
  currentDate, 
  sprints, 
  onSprintClick,
  highlightedSprintId
}: { 
  calendarData: CalendarWeek[], 
  currentDate: Date, 
  sprints: Sprint[], 
  onSprintClick: (sprint: Sprint, e: React.MouseEvent) => void,
  highlightedSprintId?: string | null
}) => (
  <div className="calendar-view p-4 pb-16">
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-gray-50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
          <div key={index} className="py-2 font-medium text-center border-r text-gray-600">{day}</div>
        ))}
      </div>
      
      {/* Calendar grid */}
      {calendarData.map((week, weekIndex) => (
        <WeekRow 
          key={`week-${weekIndex}`}
          week={week} 
          weekIndex={weekIndex} 
          currentDate={currentDate}
          sprints={sprints}
          onSprintClick={onSprintClick}
          highlightedSprintId={highlightedSprintId}
        />
      ))}
    </div>
  </div>
);

// EditSprintModal component
const EditSprintModal = ({
  sprint,
  isOpen,
  onClose,
  onSave,
  onStartSprint,
  onEndSprint,
  projectId,
  userPermissions
}: {
  sprint: Sprint | null,
  isOpen: boolean,
  onClose: () => void,
  onSave: (updatedSprint: Sprint) => void,
  onStartSprint?: (sprint: Sprint) => void,
  onEndSprint?: (sprint: Sprint) => void,
  projectId: string | null,
  userPermissions: UserPermissions | null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when sprint changes
  useEffect(() => {
    if (sprint) {
      setFormData({
        name: sprint.name || '',
        goal: sprint.goal || '',
        startDate: sprint.startDate ? sprint.startDate.split('T')[0] : '',
        endDate: sprint.endDate ? sprint.endDate.split('T')[0] : ''
      });
    }
  }, [sprint]);

  const handleSave = async () => {
    if (!sprint || !formData.name.trim()) {
      toast.error("Sprint name is required");
      return;
    }

    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    setIsSaving(true);
    try {
      const updatedSprint: Sprint = {
        ...sprint,
        name: formData.name.trim(),
        goal: formData.goal.trim(),
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        projectId: projectId // Đảm bảo projectId được bao gồm
      };

      await onSave(updatedSprint);
    } catch (error) {
      console.error('Error saving sprint:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !sprint) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Edit sprint: {sprint.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-6">
            Required fields are marked with an asterisk <span className="text-red-500">*</span>
          </p>
          
          {/* Sprint Name */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Sprint name <span className="text-red-500">*</span>
            </label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full"
              placeholder="Enter sprint name"
            />
          </div>
          
          {/* Start Date */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Start date <span className="text-red-500">*</span>
            </label>
            <Input 
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              className="w-full"
            />
          </div>
          
          {/* End Date */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              End date <span className="text-red-500">*</span>
            </label>
            <Input 
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              className="w-full"
            />
          </div>
          
          {/* Sprint Goal */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Sprint goal
            </label>
            <textarea 
              value={formData.goal}
              onChange={(e) => setFormData({...formData, goal: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder="Describe the sprint goal..."
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            {/* Sprint Status Actions */}
            <div className="flex gap-2">
              {canStartEndSprints(userPermissions) && sprint.status === "NOT_STARTED" && onStartSprint && (
                <Button 
                  onClick={() => onStartSprint(sprint)}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                   Start Sprint
                </Button>
              )}
              
              {canStartEndSprints(userPermissions) && sprint.status === "ACTIVE" && onEndSprint && (
                <Button 
                  onClick={() => onEndSprint(sprint)}
                  disabled={isSaving}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  🏁 Complete Sprint
                </Button>
              )}
              
              {sprint.status === "COMPLETED" && (
                <Button 
                  disabled
                  className="bg-gray-400 cursor-not-allowed"
                >
                  ✅ Completed
                </Button>
              )}
              
              {/* Permission denied message for members */}
              {!canStartEndSprints(userPermissions) && (sprint.status === "NOT_STARTED" || sprint.status === "ACTIVE") && (
                <div className="text-sm text-gray-500 italic">
                  Only project owners and scrum masters can {sprint.status === "NOT_STARTED" ? "start" : "complete"} sprints
                </div>
              )}
            </div>
            
            {/* Save/Cancel Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component
export default function CalendarPage() {
  const searchParams = useSearchParams();
  const { currentProjectId, setCurrentProjectId } = useNavigation();
  const { userData } = useUserStorage();
  
  // Ưu tiên projectId từ context (từ board), sau đó mới lấy từ URL
  const urlProjectId = searchParams?.get("projectId");
  const projectId = currentProjectId || urlProjectId;
  
  // Chỉ cập nhật context nếu có URL projectId nhưng context chưa có (backward compatibility)
  useEffect(() => {
    if (urlProjectId && !currentProjectId) {
      setCurrentProjectId(urlProjectId);
    }
  }, [urlProjectId, currentProjectId, setCurrentProjectId]);

  // Fetch user permissions
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.account?.id && projectId) {
        setPermissionsLoading(true);
        try {
          const permissions = await getUserPermissions(userData.account.id, projectId);
          console.log('🔐 CALENDAR PERMISSION DEBUG:', {
            userId: userData.account.id,
            projectId,
            permissions,
            role: permissions?.role,
            canManageSprints: permissions?.canManageSprints
          });
          setUserPermissions(permissions);
        } catch (error) {
          console.error('Error fetching permissions:', error);
          setUserPermissions(null);
        } finally {
          setPermissionsLoading(false);
        }
      } else {
        // No projectId or user data - set minimal permissions for empty calendar
        console.log('📅 CALENDAR: No project or user data, setting minimal permissions');
        setUserPermissions(null);
        setPermissionsLoading(false);
      }
    };

    fetchPermissions();
  }, [userData?.account?.id, projectId]);
  
  // State variables
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [allSprints, setAllSprints] = useState<Sprint[]>([]); // Store all sprints for local filtering
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarWeek[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedSprintId, setHighlightedSprintId] = useState<string | null>(null);
  
  // New states for sprint editing
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [showEditSprintModal, setShowEditSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  
  // Fetch project members for notifications
  const fetchProjectMembers = async (): Promise<User[]> => {
    try {
      if (!projectId) {
        console.warn("No project ID available for fetching members");
        return [];
      }

      const response = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/users`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.data && response.data.status === "SUCCESS" && Array.isArray(response.data.data)) {
        return response.data.data;
      } else {
        console.warn("Unexpected response format for project members:", response.data);
        return [];
      }
    } catch (error) {
      console.error("Error fetching project members:", error);
      return [];
    }
  };

  // Sprint notification function for calendar updates
  const sendSprintNotificationToMembers = async (
    notificationType: "SPRINT_UPDATED" | "SPRINT_GOAL_UPDATED" | "SPRINT_STARTED" | "SPRINT_ENDED" | "SPRINT_COMPLETED",
    sprint: Sprint,
    additionalInfo?: string
  ) => {
    try {
      console.log(`CALENDAR NOTIFICATION: Starting ${notificationType} notification process...`);
      
      // Validate projectId before proceeding
      if (!projectId) {
        console.error('❌ CALENDAR NOTIFICATION: No project ID available');
        return;
      }
      
      let validatedProjectId: string;
      let validatedSprintId: string | null = null;
      
      try {
        validatedProjectId = validateProjectId(projectId);
      } catch (error) {
        console.error('❌ CALENDAR NOTIFICATION: Invalid project ID format:', error);
        return;
      }
      
      try {
        validatedSprintId = validateSprintId(sprint.id);
      } catch (error) {
        console.error('❌ CALENDAR NOTIFICATION: Invalid sprint ID format:', error);
        return;
      }
      
      if (!validatedSprintId) {
        console.error('❌ CALENDAR NOTIFICATION: Sprint ID is required for notifications');
        return;
      }
      
      // Get current user data
      if (!userData?.account?.id && !userData?.profile?.id) {
        console.warn("No current user data available for notifications");
        return;
      }
      
      const currentUserId = userData.account?.id || userData.profile?.id;
      const currentUserName = userData.profile?.username || userData.profile?.firstName || userData.account?.email || 'User';


      // Fetch project members
      const projectMembers = await fetchProjectMembers();

      // Fetch project details to get product owner
      let productOwnerId: string | null = null;
      let projectName = "TaskFlow Project";
      
      try {
        const projectResponse = await axios.get(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${validatedProjectId}`);
        if (projectResponse.data?.status === "SUCCESS" && projectResponse.data?.data) {
          productOwnerId = projectResponse.data.data.ownerId; // Product Owner, not Scrum Master
          projectName = projectResponse.data.data.name || projectName;
          console.log(`📋 CALENDAR NOTIFICATION: Project details - Name: "${projectName}", Product Owner: ${productOwnerId}`);
        }
      } catch (error) {
        console.warn('⚠️ CALENDAR NOTIFICATION: Failed to fetch project details:', error);
      }

      // Create comprehensive recipient list
      const allRecipients = new Set<string>();
      
      // Add all project members
      projectMembers.forEach(member => {
        if (member.id !== currentUserId) { // Exclude current user
          allRecipients.add(member.id);
        }
      });
      
      // Add product owner if not already included and not current user
      if (productOwnerId && productOwnerId !== currentUserId && !allRecipients.has(productOwnerId)) {
        allRecipients.add(productOwnerId);
      }

      const recipientIds = Array.from(allRecipients);

      if (recipientIds.length === 0) {
        console.log("No recipients to notify (current user is the only member or no members found)");
        return;
      }

      // Determine notification title and message based on type
      let notificationTitle = "";
      let notificationMessage = "";
      
      switch (notificationType) {
        case "SPRINT_UPDATED":
          notificationTitle = "Sprint Updated";
          notificationMessage = `${currentUserName} updated sprint "${sprint.name}" in calendar${additionalInfo ? `: ${additionalInfo}` : ''}`;
          break;
        case "SPRINT_GOAL_UPDATED":
          notificationTitle = "Sprint Goal Updated";
          notificationMessage = `${currentUserName} updated the goal for sprint "${sprint.name}" in calendar`;
          break;
        case "SPRINT_STARTED":
          notificationTitle = "Sprint Started";
          notificationMessage = `${currentUserName} started sprint "${sprint.name}"`;
          break;
        case "SPRINT_ENDED":
          notificationTitle = "Sprint Ended";
          notificationMessage = `Sprint "${sprint.name}" has ended`;
          break;
        case "SPRINT_COMPLETED":
          notificationTitle = "Sprint Completed";
          notificationMessage = `${currentUserName} completed sprint "${sprint.name}"`;
          break;
        default:
          notificationTitle = "Sprint Notification";
          notificationMessage = `Sprint "${sprint.name}" was updated in calendar`;
      }

      // Create notification data with all required fields
      const baseNotificationData = {
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actorUserId: currentUserId,
        actorUserName: currentUserName,
        projectId: validatedProjectId,
        projectName: projectName,
        sprintId: validatedSprintId,
        actionUrl: `/project/calendar?projectId=${validatedProjectId}&highlightSprint=${validatedSprintId}`
      };


      // Send notifications to all recipients
      const notificationPromises = recipientIds.map(async (recipientId, index) => {
        const notificationData = {
          ...baseNotificationData,
          recipientUserId: recipientId
        };


        try {
          const response = await axios.post(`${API_CONFIG.NOTIFICATION_SERVICE}/api/notifications/create`, notificationData, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          console.log(`✅ CALENDAR NOTIFICATION: Successfully sent to ${recipientId}`);
          return response;
        } catch (error) {
          console.error(`❌ CALENDAR NOTIFICATION: Failed to send to ${recipientId}:`, error);
          if (axios.isAxiosError(error) && error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, error.response.data);
          }
          throw error; // Re-throw to be handled by Promise.allSettled
        }
      });

      const results = await Promise.allSettled(notificationPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;


    

    } catch (error) {
      console.error(`❌ CALENDAR NOTIFICATION: Failed to send ${notificationType} notifications:`, error);
      // Don't fail the main operation if notification fails
    }
  };

  // Debounced search function với cải thiện logic
  const debouncedSearch = useCallback(
    debounce(async (searchValue: string) => {
      if (!projectId) return;
      
      try {
        if (searchValue.trim() === '') {
          // If search is empty, show all sprints
          setSprints(allSprints);
          setHighlightedSprintId(null); // Clear highlight
        } else {
          // Call filter API for sprints
          const sprintsResponse = await axios.get(
            `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}/calendar/filter`,
            {
              params: { search: searchValue }
            }
          );
          const filteredSprints = sprintsResponse.data?.data || [];
          setSprints(filteredSprints);
          
          // Auto-navigate to the month of the first found sprint
          if (filteredSprints.length > 0 && filteredSprints[0].startDate) {
            const sprintDate = parseISO(filteredSprints[0].startDate);
            const sprintMonth = format(sprintDate, "MMMM yyyy");
            
            // Animate to the sprint's month
            setCurrentDate(sprintDate);
            setHighlightedSprintId(filteredSprints[0].id); // Highlight the found sprint
            
            // Show success notification with sprint info
            toast.success(
              `Found "${filteredSprints[0].name}" - Navigated to ${sprintMonth}`,
              {
                description: `${filteredSprints.length} sprint${filteredSprints.length > 1 ? 's' : ''} found`,
                duration: 3000,
              }
            );
          } else if (filteredSprints.length === 0) {
            setHighlightedSprintId(null);
            toast.info(`No sprints found matching "${searchValue}"`);
          }
        }
      } catch (error) {
        console.error("Error searching sprints:", error);
        toast.error("Error searching calendar");
      }
    }, 500),
    [projectId, allSprints]
  );

  // Handle search term changes
  useEffect(() => {
    debouncedSearch(searchTerm);
    
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [searchTerm, debouncedSearch]);
  
  // Tính toán và chuẩn bị dữ liệu cho lịch
  useEffect(() => {
    if (!sprints.length) return;
    
    // Tạo mảng các ngày trong tháng
    const monthStart = startOfMonth(currentDate);
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    // Tạo 5 tuần (thông thường đủ để hiển thị cả tháng)
    const weeks: CalendarWeek[] = [];
    
    for (let weekIndex = 0; weekIndex < 5; weekIndex++) {
      const weekDays: Date[] = [];
      
      // Tạo 7 ngày cho tuần
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = addDays(weekStart, weekIndex * 7 + dayIndex);
        weekDays.push(day);
      }
      
      // Tạo tuần mới với ngày và không có sprint
      weeks.push({
        days: weekDays,
        sprints: []
      });
    }
    
    // Duyệt qua các sprint và thêm vào tuần tương ứng
    sprints.forEach(sprint => {
      if (!sprint.startDate || !sprint.endDate) return;
      
      const startDate = parseISO(sprint.startDate);
      const endDate = parseISO(sprint.endDate);
      
      // Duyệt qua từng tuần
      weeks.forEach((week) => {
        // Kiểm tra xem sprint có giao với tuần hiện tại không
        const firstDayOfWeek = week.days[0];
        const lastDayOfWeek = week.days[6];
        
        // Sprint bắt đầu sau tuần này hoặc kết thúc trước tuần này
        if (startDate > lastDayOfWeek || endDate < firstDayOfWeek) {
          return; // Bỏ qua tuần này
        }
        
        // Tính toán vị trí bắt đầu và kết thúc trong tuần
        let startDay = 0;
        let endDay = 6;
        let isFirst = false;
        let isLast = false;
        
        // Nếu ngày bắt đầu sprint nằm trong tuần này
        if (startDate >= firstDayOfWeek && startDate <= lastDayOfWeek) {
          for (let i = 0; i < 7; i++) {
            if (isSameDay(week.days[i], startDate) || week.days[i] > startDate) {
              startDay = i;
              isFirst = true;
              break;
            }
          }
        }
        
        // Nếu ngày kết thúc sprint nằm trong tuần này
        if (endDate >= firstDayOfWeek && endDate <= lastDayOfWeek) {
          for (let i = 0; i < 7; i++) {
            if (isSameDay(week.days[i], endDate) || (i > 0 && week.days[i] > endDate && week.days[i-1] <= endDate)) {
              endDay = i;
              isLast = true;
              break;
            }
          }
        }
        
        // Thêm sprint vào tuần với hàng phù hợp
        // Tìm vị trí hàng trống
        let row = 1;
        const usedRows = new Set<number>();
        
        week.sprints.forEach(existingSprint => {
          // Kiểm tra xem có giao với sprint hiện tại không
          if (
            (startDay <= existingSprint.endDay && endDay >= existingSprint.startDay) || 
            (existingSprint.startDay <= endDay && existingSprint.endDay >= startDay)
          ) {
            usedRows.add(existingSprint.row);
          }
        });
        
        while (usedRows.has(row)) {
          row++;
        }
        
        // Thêm sprint vào tuần
        week.sprints.push({
          id: sprint.id,
          name: sprint.name,
          startDay,
          endDay,
          row,
          isFirst,
          isLast,
        });
      });
    });
    
    setCalendarData(weeks);
  }, [sprints, currentDate]);
  
  // Main data fetch effect
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // If no projectId, show empty calendar
        if (!projectId) {
          console.log('📅 CALENDAR: No project ID provided, showing empty calendar');
          setAllSprints([]);
          setSprints([]);
          setLoading(false);
          return;
        }

        // Fetch all sprints for the project
        const sprintsResponse = await axios.get(
          `${API_CONFIG.SPRINTS_SERVICE}/api/sprints/project/${projectId}`
        );
        const sprintsData = sprintsResponse.data?.data || [];
        setAllSprints(sprintsData); // Store all sprints
        setSprints(sprintsData); // Initially show all sprints
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Lỗi khi tải dữ liệu");
        // Set empty arrays on error
        setAllSprints([]);
        setSprints([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [projectId]);
  
  // Navigation functions
  const previousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    
    // Clear search when manually navigating
    if (searchTerm) {
      setSearchTerm('');
      setSprints(allSprints);
      setHighlightedSprintId(null);
    }
  };
  
  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    
    // Clear search when manually navigating
    if (searchTerm) {
      setSearchTerm('');
      setSprints(allSprints);
      setHighlightedSprintId(null);
    }
  };
  
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    
    // Clear search when going to today
    if (searchTerm) {
      setSearchTerm('');
      setSprints(allSprints);
      setHighlightedSprintId(null);
    }
    
    toast.success("Navigated to today's date");
  };
  
  // Handle clicks
  const handleSprintClick = (sprint: Sprint, e: React.MouseEvent) => {
    setSelectedSprint(sprint);
    // Calculate position for the modal
    const rect = e.currentTarget.getBoundingClientRect();
    setModalPosition({
      x: rect.right,
      y: rect.top
    });
    setShowSprintModal(true);
  };

  // Handle edit sprint
  const handleEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setShowEditSprintModal(true);
    setShowSprintModal(false);
    setShowSprintMenu(false);
  };

  // Handle update sprint
  const handleUpdateSprint = async (updatedSprint: Sprint) => {
    if (!updatedSprint.id) {
      toast.error("Sprint ID is required");
      return;
    }

    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    try {
      // Get original sprint for comparison (to detect changes)
      const originalSprint = sprints.find(s => s.id === updatedSprint.id) || allSprints.find(s => s.id === updatedSprint.id);

      const response = await axios.put(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${updatedSprint.id}`, {
        name: updatedSprint.name,
        goal: updatedSprint.goal,
        startDate: updatedSprint.startDate,
        endDate: updatedSprint.endDate,
        status: updatedSprint.status,
        projectId: projectId // Thêm projectId vào request body
      });

      if (response.data && response.data.status === "SUCCESS") {
        toast.success("Sprint updated successfully");
        
        // Update local state
        const updatedSprints = sprints.map(sprint => 
          sprint.id === updatedSprint.id ? updatedSprint : sprint
        );
        setSprints(updatedSprints);
        
        const updatedAllSprints = allSprints.map(sprint => 
          sprint.id === updatedSprint.id ? updatedSprint : sprint
        );
        setAllSprints(updatedAllSprints);
        
        // Send appropriate notification based on what was changed
        try {
          if (originalSprint) {
            // Check for status changes first (highest priority)
            if (originalSprint.status !== updatedSprint.status) {
              
              // Handle specific status change notifications
              if (originalSprint.status === "NOT_STARTED" && updatedSprint.status === "ACTIVE") {
                await sendSprintNotificationToMembers("SPRINT_STARTED", updatedSprint);
              } else if (originalSprint.status === "ACTIVE" && updatedSprint.status === "COMPLETED") {
                await sendSprintNotificationToMembers("SPRINT_COMPLETED", updatedSprint);
              } else if (updatedSprint.status === "COMPLETED") {
                // Any status to COMPLETED
                await sendSprintNotificationToMembers("SPRINT_COMPLETED", updatedSprint);
              } else {
                // Other status changes - send general update
                await sendSprintNotificationToMembers("SPRINT_UPDATED", updatedSprint, 'Status changed to ${updatedSprint.status}');
              }
            }
            // Check if goal was specifically updated (if no status change)
            else if (originalSprint.goal !== updatedSprint.goal) {
              await sendSprintNotificationToMembers(
                "SPRINT_GOAL_UPDATED", 
                updatedSprint,
                updatedSprint.goal || "No goal set"
              );
            }
            // Check for other significant changes (dates, name)
            else if (
              originalSprint.name !== updatedSprint.name ||
              originalSprint.startDate !== updatedSprint.startDate ||
              originalSprint.endDate !== updatedSprint.endDate
            ) {
              // Determine what changed
              const changes = [];
              if (originalSprint.name !== updatedSprint.name) changes.push("name");
              if (originalSprint.startDate !== updatedSprint.startDate) changes.push("start date");
              if (originalSprint.endDate !== updatedSprint.endDate) changes.push("end date");
              
              await sendSprintNotificationToMembers(
                "SPRINT_UPDATED", 
                updatedSprint, 
                `Updated ${changes.join(', ')}`
              );
            }
            // If only minor changes, might skip notification or send general update
            else {
              console.log("🔍 CALENDAR: Minor sprint changes detected, sending general update notification");
              await sendSprintNotificationToMembers("SPRINT_UPDATED", updatedSprint);
            }
          } else {
            // Fallback: send general update notification
            await sendSprintNotificationToMembers("SPRINT_UPDATED", updatedSprint);
          }
        } catch (notificationError) {
          console.error("Failed to send sprint update notifications:", notificationError);
          // Don't fail the main operation if notification fails
          toast.warning("Sprint updated successfully, but notifications may have failed");
        }
        
        setShowEditSprintModal(false);
        setEditingSprint(null);
      } else {
        toast.error("Failed to update sprint");
      }
    } catch (error) {
      console.error("Error updating sprint:", error);
      toast.error("Failed to update sprint");
    }
  };

  // Check for sprint end dates and send notifications
  const checkSprintEndDates = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      
      for (const sprint of allSprints) {
        if (sprint.endDate && sprint.status === "ACTIVE") {
          const endDate = new Date(sprint.endDate);
          endDate.setHours(0, 0, 0, 0);
          
          // Check if sprint ended today
          if (endDate.getTime() === today.getTime()) {
            console.log(`📅 CALENDAR: Sprint "${sprint.name}" ended today, sending notifications...`);
            
            // Send SPRINT_ENDED notification
            await sendSprintNotificationToMembers(
              "SPRINT_ENDED", 
              sprint, 
              "Sprint has reached its end date"
            );
          }
        }
      }
    } catch (error) {
      console.error("Error checking sprint end dates:", error);
    }
  };

  // Auto-check sprint end dates when sprints data loads
  useEffect(() => {
    if (allSprints.length > 0) {
      checkSprintEndDates();
    }
  }, [allSprints]);

  // Handle manual sprint start
  const handleStartSprint = async (sprint: Sprint) => {
    if (!sprint.id) {
      toast.error("Sprint ID is required");
      return;
    }

    try {
      const updatedSprint = { ...sprint, status: "ACTIVE" };
      
      const response = await axios.put(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprint.id}`, {
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: "ACTIVE",
        projectId: projectId
      });

      if (response.data && response.data.status === "SUCCESS") {
        toast.success("Sprint started successfully");
        
        // Update local state
        const updatedSprints = sprints.map(s => 
          s.id === sprint.id ? updatedSprint : s
        );
        setSprints(updatedSprints);
        
        const updatedAllSprints = allSprints.map(s => 
          s.id === sprint.id ? updatedSprint : s
        );
        setAllSprints(updatedAllSprints);
        
        // Send SPRINT_STARTED notification
        try {
          await sendSprintNotificationToMembers("SPRINT_STARTED", updatedSprint);
        } catch (notificationError) {
          console.error("Failed to send sprint start notifications:", notificationError);
          toast.warning("Sprint started successfully, but notifications may have failed");
        }
        
        setShowEditSprintModal(false);
        setEditingSprint(null);
      } else {
        toast.error("Failed to start sprint");
      }
    } catch (error) {
      console.error("Error starting sprint:", error);
      toast.error("Failed to start sprint");
    }
  };

  // Handle manual sprint end/completion
  const handleEndSprint = async (sprint: Sprint) => {
    if (!sprint.id) {
      toast.error("Sprint ID is required");
      return;
    }

    try {
      const updatedSprint = { ...sprint, status: "COMPLETED" };
      
      const response = await axios.put(`${API_CONFIG.SPRINTS_SERVICE}/api/sprints/${sprint.id}`, {
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: "COMPLETED",
        projectId: projectId
      });

      if (response.data && response.data.status === "SUCCESS") {
        toast.success("Sprint completed successfully");
        
        // Update local state
        const updatedSprints = sprints.map(s => 
          s.id === sprint.id ? updatedSprint : s
        );
        setSprints(updatedSprints);
        
        const updatedAllSprints = allSprints.map(s => 
          s.id === sprint.id ? updatedSprint : s
        );
        setAllSprints(updatedAllSprints);
        
        // Send SPRINT_COMPLETED notification
        try {
          await sendSprintNotificationToMembers("SPRINT_COMPLETED", updatedSprint);
        } catch (notificationError) {
          console.error("Failed to send sprint completion notifications:", notificationError);
          toast.warning("Sprint completed successfully, but notifications may have failed");
        }
        
        setShowEditSprintModal(false);
        setEditingSprint(null);
      } else {
        toast.error("Failed to complete sprint");
      }
    } catch (error) {
      console.error("Error completing sprint:", error);
      toast.error("Failed to complete sprint");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <NavigationProgress />
      <Sidebar projectId={projectId || undefined} />
      <div className="flex-1 flex flex-col">
        <TopNavigation />
        <div className="flex-1 overflow-y-auto">
          {/* Calendar toolbar */}
          <CalendarToolbar 
            currentDate={currentDate}
            goToToday={goToToday}
            previousMonth={previousMonth}
            nextMonth={nextMonth}
            searchTerm={searchTerm}
            onSearchChange={(term) => setSearchTerm(term)}
            onMonthSelect={(month) => {
              const newDate = new Date(currentDate);
              newDate.setMonth(month);
              newDate.setDate(1); // Set to first day of month to avoid date overflow issues
              setCurrentDate(newDate);
              
              // Show notification about month navigation
              const monthName = format(newDate, "MMMM yyyy");
              toast.success(`Navigated to ${monthName}`, {
                description: "Month changed via dropdown selection",
                duration: 2000,
              });
              
              // Clear search and highlighted sprint when manually navigating
              if (searchTerm) {
                setSearchTerm('');
                setSprints(allSprints);
                setHighlightedSprintId(null);
              }
            }}
            sprintsCount={sprints.length}
            totalSprintsCount={allSprints.length}
          />
          
          {loading ? (
            <Loading />
          ) : (
            <>
              {/* Show empty state message when no project or no sprints */}
              {!projectId && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 bg-white mx-4 mb-4 rounded-lg border border-gray-200">
                  <CalendarIcon className="h-8 w-8 mb-2 text-gray-300" />
                  <p className="text-lg font-medium">Calendar View</p>
                  <p className="text-sm">Select a project to view its sprints on the calendar</p>
                </div>
              )}
              
              {searchTerm && sprints.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Search className="h-12 w-12 mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No sprints found</p>
                  <p className="text-sm">Try adjusting your search terms</p>
                </div>
              )}
              
              {/* Always show calendar grid */}
              <CalendarView 
                calendarData={calendarData} 
                currentDate={currentDate} 
                sprints={sprints} 
                onSprintClick={handleSprintClick}
                highlightedSprintId={highlightedSprintId}
              />
            </>
          )}
          
          {/* Sprint detail popup */}
          {showSprintModal && selectedSprint && (
            <SprintDetailPopup 
              sprint={selectedSprint} 
              position={modalPosition} 
              onClose={() => setShowSprintModal(false)}
              onEdit={handleEditSprint}
              userPermissions={userPermissions}
            />
          )}
          
          {/* Edit Sprint Modal */}
          {showEditSprintModal && editingSprint && (
            <EditSprintModal
              sprint={editingSprint}
              isOpen={showEditSprintModal}
              onClose={() => {
                setShowEditSprintModal(false);
                setEditingSprint(null);
              }}
              onSave={handleUpdateSprint}
              onStartSprint={handleStartSprint}
              onEndSprint={handleEndSprint}
              projectId={projectId || null}
              userPermissions={userPermissions}
            />
          )}
        </div>
      </div>
    </div>
  );
} 