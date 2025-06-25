"use client";

import { useNavigation } from "@/contexts/NavigationContext";

export function LoadingScreen() {
  const { isNavigating } = useNavigation();

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-600 font-medium">Navigating...</p>
      </div>
    </div>
  );
}

export function NavigationProgress() {
  const { isNavigating } = useNavigation();

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-0.5 bg-blue-600 animate-pulse" style={{
        background: 'linear-gradient(90deg, transparent, #2563eb, transparent)',
        animation: 'slide 1.5s infinite'
      }}></div>
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
} 