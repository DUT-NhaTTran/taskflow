import React from "react";
import { useDroppable } from '@dnd-kit/core';

interface DroppableProjectColumnProps {
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  children: React.ReactNode;
  className?: string;
}

export function DroppableProjectColumn({ 
  status, 
  children,
  className = ""
}: DroppableProjectColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    data: {
      status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-opacity-50' : ''
      } transition-colors`}
    >
      {children}
      {isOver && (
        <div className="flex items-center justify-center p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-md mt-2">
          <span className="text-blue-600 font-medium text-sm">Drop task here</span>
        </div>
      )}
    </div>
  );
} 