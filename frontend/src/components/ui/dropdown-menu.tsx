"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  options: DropdownOption[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DropdownMenu({ 
  trigger, 
  options, 
  value, 
  onSelect, 
  placeholder = "Select option",
  className = ""
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <div className="flex items-center space-x-2">
                {option.icon && <span className="text-gray-400">{option.icon}</span>}
                <span className="text-gray-900">{option.label}</span>
              </div>
              {value === option.value && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SortDropdownProps {
  value: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function SortDropdown({ value, onSelect, className = "" }: SortDropdownProps) {
  const sortOptions: DropdownOption[] = [
    { value: "updated", label: "Last updated" },
    { value: "created", label: "Created" },
    { value: "due-date", label: "Due date" },
    { value: "status", label: "Status" },
    { value: "title", label: "Title" },
  ];

  const selectedOption = sortOptions.find(option => option.value === value);

  return (
    <DropdownMenu
      trigger={
        <div className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 cursor-pointer text-sm ${className}`}>
          <span className="text-gray-600 mr-2">Sort by:</span>
          <span className="text-gray-900 font-medium">
            {selectedOption?.label || "Select"}
          </span>
          <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
        </div>
      }
      options={sortOptions}
      value={value}
      onSelect={onSelect}
    />
  );
} 