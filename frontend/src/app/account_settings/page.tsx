"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNavigation } from "@/components/ui/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { ArrowLeft, Save, Key, Shield, Eye, EyeOff, Lock } from "lucide-react";
import axios from "axios";
import { API_CONFIG } from "@/lib/config";

interface PasswordChangeForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export default function AccountSettingsPage() {
    const router = useRouter();
    const { currentUser, isLoading } = useUser();

    // Form state
    const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // UI state
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const validatePasswordForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Validate current password
        if (!passwordForm.currentPassword.trim()) {
            newErrors.currentPassword = "Current password is required";
        }

        // Validate new password
        if (!passwordForm.newPassword.trim()) {
            newErrors.newPassword = "New password is required";
        } else if (passwordForm.newPassword.length < 8) {
            newErrors.newPassword = "New password must be at least 8 characters";
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
            newErrors.newPassword = "Password must contain at least one uppercase letter, one lowercase letter, and one number";
        }

        // Validate confirm password
        if (!passwordForm.confirmPassword.trim()) {
            newErrors.confirmPassword = "Please confirm your new password";
        } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        // Check if new password is different from current
        if (passwordForm.currentPassword === passwordForm.newPassword) {
            newErrors.newPassword = "New password must be different from current password";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePasswordChange = (field: keyof PasswordChangeForm, value: string) => {
        setPasswordForm(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handleChangePassword = async () => {
        if (!validatePasswordForm()) {
            toast.error("Please fix the errors before submitting");
            return;
        }

        if (!currentUser?.id) {
            toast.error("User not found");
            return;
        }

        try {
            setIsChangingPassword(true);
            console.log('🔐 Changing password for user:', currentUser.id);

            const response = await axios.put(
                `${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/change-password/${currentUser.id}`,
                {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data?.status === "SUCCESS") {
                toast.success("Password changed successfully");
                
                // Reset form
                setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                setErrors({});
                
                // Optionally redirect to profile or login
                setTimeout(() => {
                    toast.info("Please log in again with your new password");
                    router.push('/auth/signin');
                }, 2000);
            } else {
                // Handle unsuccessful response but not HTTP error
                const errorMessage = response.data?.message || response.data?.error || "Failed to change password";
                toast.error("Password change failed", {
                    description: errorMessage
                });
            }
        } catch (error: any) {
            // Don't log the full error to console to avoid showing technical details
            console.log('Password change failed - handling gracefully');
            
            if (axios.isAxiosError(error) && error.response) {
                const status = error.response.status;
                const errorMessage = error.response?.data?.error || error.response?.data?.message || "";
                
                if (status === 400) {
                    // Handle bad request - usually wrong current password
                    // Don't show the technical error, just handle it gracefully
                    setErrors(prev => ({
                        ...prev,
                        currentPassword: "Current password is incorrect"
                    }));
                    toast.error("Current password is incorrect");
                } else if (status === 401) {
                    // Handle unauthorized
                    setErrors(prev => ({
                        ...prev,
                        currentPassword: "Current password is incorrect"
                    }));
                    toast.error("Current password is incorrect");
                } else if (status === 403) {
                    // Handle forbidden
                    toast.error("Access denied - insufficient permissions");
                } else if (status === 404) {
                    // Handle user not found
                    toast.error("User account not found");
                } else if (status >= 500) {
                    // Handle server errors
                    toast.error("Server temporarily unavailable, please try again later");
                } else {
                    // Handle other HTTP errors
                    toast.error("Unable to change password, please try again");
                }
            } else {
                // Handle network errors or other non-HTTP errors
                toast.error("Network error - please check your connection");
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleCancel = () => {
        setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        setErrors({});
        router.back();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <TopNavigation />
                <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Loading account settings...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        router.push('/auth/signin');
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <TopNavigation />
            
            <div className="max-w-2xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.back()}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                                <Shield className="w-6 h-6 text-blue-600" />
                                Account Settings
                            </h1>
                            <p className="text-sm text-gray-600">
                                Manage your account security and preferences
                            </p>
                        </div>
                    </div>
                </div>

                {/* Account Info */}
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-gray-400" />
                        Account Information
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <div className="p-3 bg-gray-50 rounded-md">
                                <span className="text-sm text-gray-900">{currentUser.username}</span>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <div className="p-3 bg-gray-50 rounded-md">
                                <span className="text-sm text-gray-900">{currentUser.email}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Change Section */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-gray-400" />
                        Change Password
                    </h2>
                    
                    <div className="space-y-6">
                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Current Password *
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.current ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                    placeholder="Enter your current password"
                                    className={`w-full pr-10 ${errors.currentPassword ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('current')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPasswords.current ? (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                            {errors.currentPassword && (
                                <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
                            )}
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                New Password *
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.new ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                    placeholder="Enter your new password"
                                    className={`w-full pr-10 ${errors.newPassword ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('new')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPasswords.new ? (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                            {errors.newPassword && (
                                <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
                            )}
                            <p className="text-gray-500 text-xs mt-1">
                                Must be at least 8 characters with uppercase, lowercase, and number
                            </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm New Password *
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.confirm ? "text" : "password"}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                    placeholder="Confirm your new password"
                                    className={`w-full pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('confirm')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPasswords.confirm ? (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                            <Button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword}
                                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                            >
                                {isChangingPassword ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Changing Password...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Change Password
                                    </>
                                )}
                            </Button>
                            
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isChangingPassword}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-medium text-blue-900 mb-1">
                                Security Notice
                            </h3>
                            <p className="text-sm text-blue-700">
                                After changing your password, you will be logged out and need to sign in again with your new password.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 