"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TopNavigation } from "@/components/ui/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/drop-down";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { ArrowLeft, Save, Upload, Camera, User, Shield, Calendar, Phone, X } from "lucide-react";
import axios from "axios";
import { API_CONFIG } from "@/lib/config";

interface UserProfile {
    id: string;
    username: string;
    email: string;
    phone?: string;
    avatar?: string;
    userRole?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Helper functions moved outside component
const validateForm = (profile: UserProfile): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!profile.username.trim()) {
        errors.username = "Username is required";
    } else if (profile.username.length < 3 || profile.username.length > 50) {
        errors.username = "Username must be between 3 and 50 characters";
    } else if (!/^[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s._-]+$/.test(profile.username)) {
        errors.username = "Username can only contain letters, numbers, spaces, dots, underscores, and hyphens";
    } else if (profile.username.trim().length !== profile.username.length || profile.username.includes("  ")) {
        errors.username = "Username cannot have leading/trailing spaces or consecutive spaces";
    }

    if (!profile.email.trim()) {
        errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        errors.email = "Please enter a valid email address";
    }

    if (profile.phone && !/^[\d\s\-\+\(\)]+$/.test(profile.phone)) {
        errors.phone = "Please enter a valid phone number";
    }

    return errors;
};

const suggestValidUsername = (username: string): string => {
    return username
        .trim()
        .replace(/\s{2,}/g, ' ')
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
};

const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
        'USER': 'User', 'ADMIN': 'Admin', 'MANAGER': 'Manager',
        'DEVELOPER': 'Developer', 'TESTER': 'Tester', 'DESIGNER': 'Designer',
        'SCRUM_MASTER': 'Scrum Master', 'PRODUCT_OWNER': 'Product Owner'
    };
    return roleMap[role] || 'User';
};

const getRoleValue = (displayName: string): string => {
    const valueMap: Record<string, string> = {
        'User': 'USER', 'Admin': 'ADMIN', 'Manager': 'MANAGER',
        'Developer': 'DEVELOPER', 'Tester': 'TESTER', 'Designer': 'DESIGNER',
        'Scrum Master': 'SCRUM_MASTER', 'Product Owner': 'PRODUCT_OWNER'
    };
    return valueMap[displayName] || 'USER';
};

export default function ProfilePage() {
    const router = useRouter();
    const { currentUser, isLoading, updateUser } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Consolidated state
    const [state, setState] = useState({
        isWelcomeFlow: false,
        tempUserData: {} as {userId?: string, email?: string},
        isSaving: false,
        isUploadingAvatar: false,
        hasChanges: false,
        errors: {} as Record<string, string>
    });
    
    const [profile, setProfile] = useState<UserProfile>({
        id: '', username: '', email: '', phone: '', avatar: '', userRole: ''
    });
    const [originalProfile, setOriginalProfile] = useState<UserProfile>({
        id: '', username: '', email: '', phone: '', avatar: '', userRole: ''
    });

    // Check welcome flow
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('welcome') === 'true') {
            const tempUserId = sessionStorage.getItem('tempUserId');
            const tempEmail = sessionStorage.getItem('tempEmail');
            
            if (tempUserId && tempEmail) {
                setState(prev => ({ 
                    ...prev, 
                    isWelcomeFlow: true, 
                    tempUserData: { userId: tempUserId, email: tempEmail } 
                }));
                
                sessionStorage.removeItem('tempUserId');
                sessionStorage.removeItem('tempEmail');
                
                toast.success("Welcome! Please complete your profile", {
                    description: "Fill in your information to get started with TaskFlow"
                });
            }
        }
    }, []);

    // Initialize profile data
    useEffect(() => {
        if (state.isWelcomeFlow && state.tempUserData.userId) {
            const emptyProfile = {
                id: state.tempUserData.userId,
                username: '',
                email: state.tempUserData.email || '',
                phone: '',
                avatar: '',
                userRole: 'USER'
            };
            setProfile(emptyProfile);
            setOriginalProfile(emptyProfile);
            return;
        }
        
        if (!isLoading && currentUser) {
            const userProfile = {
                id: currentUser.id,
                username: currentUser.username || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                avatar: currentUser.avatar || '',
                userRole: currentUser.userRole || 'USER',
                createdAt: currentUser.createdAt,
                updatedAt: currentUser.updatedAt
            };
            setProfile(userProfile);
            setOriginalProfile(userProfile);
        } else if (!isLoading && !currentUser && !state.isWelcomeFlow) {
            toast.error("Please log in to access your profile");
            router.push('/auth/signin');
        }
    }, [currentUser, isLoading, router, state.isWelcomeFlow, state.tempUserData]);

    const handleInputChange = (field: keyof UserProfile, value: string) => {
        const newProfile = { ...profile, [field]: value };
        setProfile(newProfile);
        
        const hasProfileChanges = 
            newProfile.username !== originalProfile.username ||
            newProfile.email !== originalProfile.email ||
            newProfile.userRole !== originalProfile.userRole ||
            (newProfile.phone || '') !== (originalProfile.phone || '');
        
        const hasChanges = state.isWelcomeFlow 
            ? !!(newProfile.username.trim() && newProfile.email.trim())
            : hasProfileChanges;
            
        setState(prev => ({ ...prev, hasChanges }));
        
        if (state.errors[field]) {
            setState(prev => ({
                ...prev,
                errors: { ...prev.errors, [field]: '' }
            }));
        }
    };

    const handleAvatarUpload = async (file: File) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image size must be less than 5MB");
            return;
        }

        try {
            setState(prev => ({ ...prev, isUploadingAvatar: true }));
            
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await axios.patch(
                `${API_CONFIG.USER_SERVICE}/api/users/${profile.id}/avatar`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            if (response.data?.status === "SUCCESS" && response.data?.data?.url) {
                const cloudinaryUrl = response.data.data.url;
                setProfile(prev => ({ ...prev, avatar: cloudinaryUrl }));
                setState(prev => ({ ...prev, hasChanges: cloudinaryUrl !== originalProfile.avatar }));
                
                if (currentUser) {
                    updateUser({ ...currentUser, avatar: cloudinaryUrl });
                }
                
                toast.success("Avatar updated successfully");
            } else {
                throw new Error("Failed to upload avatar - no URL returned");
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error("Failed to upload avatar", {
                description: "Please try again or use a different image."
            });
        } finally {
            setState(prev => ({ ...prev, isUploadingAvatar: false }));
        }
    };

    const handleSave = async () => {
        const validationErrors = validateForm(profile);
        if (Object.keys(validationErrors).length > 0) {
            setState(prev => ({ ...prev, errors: validationErrors }));
            toast.error("Please fix the errors before saving");
            return;
        }

        try {
            setState(prev => ({ ...prev, isSaving: true }));
            
            const updateData = {
                username: profile.username.trim(),
                email: profile.email.trim(),
                phone: profile.phone?.trim() || null,
                userRole: profile.userRole,
                avatar: profile.avatar || null
            };

            const response = await axios.put(
                `${API_CONFIG.USER_SERVICE}/api/users/${profile.id}`,
                updateData,
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.data?.status === "SUCCESS") {
                // Update role if changed
                if (profile.userRole !== originalProfile.userRole) {
                    try {
                        await axios.patch(
                            `${API_CONFIG.USER_SERVICE}/api/users/${profile.id}/role?role=${profile.userRole}`,
                            {},
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    } catch (roleError) {
                        toast.warning("Profile updated but role change failed");
                    }
                }
                
                if (currentUser) {
                    updateUser({
                        ...currentUser,
                        username: updateData.username,
                        email: updateData.email,
                        phone: updateData.phone || undefined,
                        userRole: profile.userRole,
                        avatar: updateData.avatar || undefined
                    });
                }
                
                if (state.isWelcomeFlow) {
                    toast.success("Profile completed successfully! Please sign in to continue.");
                    setTimeout(() => {
                        router.push('/auth/signin?message=profile_completed');
                    }, 1500);
                } else {
                    toast.success("Profile updated successfully");
                    setState(prev => ({ ...prev, hasChanges: false }));
                    setOriginalProfile({
                        ...originalProfile,
                        username: updateData.username,
                        email: updateData.email,
                        phone: updateData.phone || '',
                        avatar: updateData.avatar || '',
                        userRole: profile.userRole
                    });
                }
            } else {
                throw new Error("Failed to update profile");
            }
        } catch (error: any) {
            console.error('Error updating profile:', error);
            
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 409) {
                    toast.error("Username or email already exists");
                } else if (error.response?.status === 400) {
                    const errorMessage = error.response?.data?.error || "Invalid data";
                    toast.error("Validation error", { description: errorMessage });
                } else {
                    toast.error("Failed to update profile");
                }
            } else {
                toast.error("Failed to update profile");
            }
        } finally {
            setState(prev => ({ ...prev, isSaving: false }));
        }
    };

    const handleReset = () => {
        setProfile({ ...originalProfile });
        setState(prev => ({ ...prev, hasChanges: false, errors: {} }));
        toast.info("Changes have been reset");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <TopNavigation />
                <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Loading profile...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentUser && !state.isWelcomeFlow) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <TopNavigation />
            
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                    if (state.isWelcomeFlow) {
                                        router.push('/auth/signin?message=profile_completed');
                                    } else {
                                        router.back();
                                    }
                                }}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {state.isWelcomeFlow ? 'Continue to Sign In' : 'Back'}
                            </Button>
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900">
                                    {state.isWelcomeFlow ? 'Complete Your Profile' : 'Profile Settings'}
                                    {state.hasChanges && (
                                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                            Unsaved changes
                                        </span>
                                    )}
                                </h1>
                                <p className="text-sm text-gray-600">
                                    {state.isWelcomeFlow 
                                        ? "Welcome! Please add your personal information to complete your registration"
                                        : state.hasChanges 
                                            ? "You have unsaved changes. Don't forget to save!" 
                                            : "Manage your account information and preferences"
                                    }
                                </p>
                            </div>
                        </div>
                        
                        {(state.hasChanges || state.isWelcomeFlow) && (
                            <div className="flex items-center gap-2">
                                {!state.isWelcomeFlow && (
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={state.isSaving}
                                        className="flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        Reset
                                    </Button>
                                )}
                                <Button
                                    onClick={handleSave}
                                    disabled={state.isSaving || (state.isWelcomeFlow && (!profile.username.trim() || !profile.email.trim()))}
                                    className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                                >
                                    {state.isSaving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {state.isWelcomeFlow ? 'Complete Registration' : 'Save Changes'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                    
                    {/* Welcome flow progress indicator */}
                    {state.isWelcomeFlow && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                    2
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-900">
                                        Step 2 of 2: Complete Your Profile
                                    </h3>
                                    <p className="text-sm text-blue-700">
                                        Add your personal information and preferences. You can always update these later.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-200">
                        <div className="relative">
                            <UserAvatar 
                                user={{ username: profile.username, email: profile.email, avatar: profile.avatar }}
                                size="lg"
                                className="w-20 h-20"
                            />
                            
                            <div 
                                className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {state.isUploadingAvatar ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                ) : (
                                    <Camera className="w-6 h-6 text-white" />
                                )}
                            </div>
                            
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleAvatarUpload(file);
                                }}
                                className="hidden"
                            />
                        </div>
                        
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold text-gray-900 mb-1">
                                {profile.username}
                            </h2>
                            <p className="text-gray-600 mb-2">{profile.email}</p>
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                    {getRoleDisplayName(profile.userRole || '')}
                                </span>
                            </div>
                        </div>
                        
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={state.isUploadingAvatar}
                            className="flex items-center gap-2"
                        >
                            {state.isUploadingAvatar ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Change Avatar
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-gray-400" />
                                Basic Information
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username *
                                    </label>
                                    <Input
                                        value={profile.username}
                                        onChange={(e) => handleInputChange('username', e.target.value)}
                                        placeholder="Enter username"
                                        className={`w-full ${state.errors.username ? 'border-red-500' : ''}`}
                                    />
                                    {state.errors.username && (
                                        <div className="mt-1">
                                            <p className="text-red-500 text-xs">{state.errors.username}</p>
                                            {!/^[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s._-]+$/.test(profile.username) && profile.username.trim() && (
                                                <p className="text-blue-600 text-xs mt-1">
                                                    💡 Suggested: <button 
                                                        type="button"
                                                        onClick={() => handleInputChange('username', suggestValidUsername(profile.username))}
                                                        className="underline hover:text-blue-800"
                                                    >
                                                        {suggestValidUsername(profile.username)}
                                                    </button>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-gray-500 text-xs mt-1">
                                        3-50 characters: letters, numbers, spaces, dots (.), underscores (_), hyphens (-) only
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address *
                                    </label>
                                    <Input
                                        type="email"
                                        value={profile.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        placeholder="Enter email address"
                                        className={`w-full ${state.errors.email ? 'border-red-500' : ''}`}
                                    />
                                    {state.errors.email && (
                                        <p className="text-red-500 text-xs mt-1">{state.errors.email}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <Phone className="w-5 h-5 text-gray-400" />
                                Contact Information
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone Number
                                    </label>
                                    <Input
                                        type="tel"
                                        value={profile.phone || ''}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        placeholder="Enter phone number"
                                        className={`w-full ${state.errors.phone ? 'border-red-500' : ''}`}
                                    />
                                    {state.errors.phone && (
                                        <p className="text-red-500 text-xs mt-1">{state.errors.phone}</p>
                                    )}
                                    <p className="text-gray-500 text-xs mt-1">
                                        Optional - for account security and notifications
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Account Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                Account Information
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Account Type
                                    </label>
                                    <Dropdown
                                        placeholder="Select account type"
                                        options={[
                                            "User", "Admin", "Manager", "Developer",
                                            "Tester", "Designer", "Scrum Master", "Product Owner"
                                        ]}
                                        defaultValue={getRoleDisplayName(profile.userRole || '')}
                                        onSelect={(value: string) => {
                                            handleInputChange('userRole', getRoleValue(value));
                                        }}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Your role determines your permissions and access level in the system
                                    </p>
                                </div>
                                
                                {profile.createdAt && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Member Since
                                        </label>
                                        <div className="p-3 bg-gray-50 rounded-md">
                                            <span className="text-sm text-gray-600">
                                                {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 