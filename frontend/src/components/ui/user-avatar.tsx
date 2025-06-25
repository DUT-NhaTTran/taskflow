import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Cache for avatar URLs that failed to load
const failedAvatarCache = new Set<string>();

// Cache for successfully loaded avatars
const avatarCache = new Map<string, string>();

interface UserAvatarProps {
  user: {
    username: string;
    avatar?: string;
    email?: string;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ user, className = "", size = "md" }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatar);

  // Get initials from username
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  // Check if the avatar URL is in the failed cache
  useEffect(() => {
    if (user.avatar) {
      // Check if we have a cached version
      if (avatarCache.has(user.avatar)) {
        setAvatarUrl(avatarCache.get(user.avatar));
        setImageError(false);
        return;
      }
      
      // Check if this URL previously failed
      if (failedAvatarCache.has(user.avatar)) {
        setImageError(true);
        return;
      }
      
      // Otherwise use the provided URL
      setAvatarUrl(user.avatar);
      setImageError(false);
    } else {
      setImageError(true);
    }
  }, [user.avatar]);

  // Handle image load error
  const handleImageError = () => {
    if (avatarUrl) {
      // Add to failed cache to prevent future attempts
      failedAvatarCache.add(avatarUrl);
      setImageError(true);
    }
  };

  // Handle successful image load
  const handleImageLoad = () => {
    if (avatarUrl) {
      // Add to success cache
      avatarCache.set(avatarUrl, avatarUrl);
    }
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {!imageError && avatarUrl ? (
        <AvatarImage 
          src={avatarUrl} 
          alt={user.username} 
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : null}
      <AvatarFallback className="bg-blue-600 text-white">
        {getInitials(user.username)}
      </AvatarFallback>
    </Avatar>
  );
} 