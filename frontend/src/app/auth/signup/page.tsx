"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import axios from "axios"
import { toast } from "sonner"
import { API_CONFIG } from "@/lib/config";

export default function SignUpPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        // Validate email
        if (!formData.email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address"
        }

        // Validate password
        if (!formData.password.trim()) {
            newErrors.password = "Password is required"
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters"
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        }

        // Validate confirm password
        if (!formData.confirmPassword.trim()) {
            newErrors.confirmPassword = "Please confirm your password"
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }))
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        if (!validateForm()) {
            toast.error("Please fix the errors before submitting")
            return
        }

        setIsSubmitting(true)

        try {
            // Step 1: Register account
            console.log("📝 Creating account...")
            const registerRes = await axios.post(`${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/register`, {
                email: formData.email,
                password: formData.password
            })

            if (!registerRes.data.success) {
                throw new Error(registerRes.data.error || "Failed to create account")
            }

            console.log("✅ Account created successfully")

            // Step 2: Get account ID to create user profile
            const accountRes = await axios.get(`${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/account-id/${formData.email}`)
            const accountId = accountRes.data.accountId

            console.log("🔗 Account ID retrieved:", accountId)

            // Step 3: Create user profile
            console.log("👤 Creating user profile...")
            const createUserRes = await axios.post(`${API_CONFIG.USER_SERVICE}/api/users`, {
                username: formData.email.split('@')[0], // Use email prefix as default username
                email: formData.email,
                userRole: "USER"
            })

            if (!createUserRes.data?.data?.id) {
                throw new Error("Failed to create user profile")
            }

            const userId = createUserRes.data.data.id
            console.log("✅ User profile created with ID:", userId)

            // Step 4: Link user ID to account
            console.log("🔗 Linking user to account...")
            await axios.post(`${API_CONFIG.ACCOUNTS_SERVICE}/api/auth/link-user`, {
                accountId: accountId,
                userId: userId
            })

            console.log("✅ Account and user linked successfully")

            // Handle successful registration
            toast.success("Account created successfully! Please complete your profile.", {
                description: "You'll be redirected to your profile page to add more information."
            });
            
            // Store basic user info temporarily for profile completion
            sessionStorage.setItem('tempUserId', userId);
            sessionStorage.setItem('tempEmail', formData.email);
            
            // Redirect to profile page for completing user information
            setTimeout(() => {
                router.push('/profile?welcome=true');
            }, 1500);

        } catch (error: any) {
            console.error("❌ Registration error:", error)
            
            if (error.response?.data?.error) {
                toast.error(error.response.data.error)
            } else {
                toast.error("Failed to create account. Please try again.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 space-y-6">
                {/* Logo + Heading */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center items-center gap-2 text-[#4f46e5] text-lg font-bold">
                        <span className="rotate-45">✦</span>
                        <span>TaskFlow</span>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
                    <p className="text-sm text-gray-600">Get started with TaskFlow today</p>
                </div>

                {/* Sign Up Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address *
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                                errors.email ? 'border-red-500' : 'border-gray-300'
                            }`}
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            required
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                        )}
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password *
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                                errors.password ? 'border-red-500' : 'border-gray-300'
                            }`}
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            required
                        />
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                            Must be at least 8 characters with uppercase, lowercase, and number
                        </p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm Password *
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                            }`}
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            required
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        className="w-full py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold rounded-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                                <span>Creating account...</span>
                            </div>
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>

                {/* Terms */}
                <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                    By creating an account, you agree to our{" "}
                    <Link href="#" className="text-[#4f46e5] underline">
                        Terms of Service
                    </Link>{" "}
                    and acknowledge our{" "}
                    <Link href="#" className="text-[#4f46e5] underline">
                        Privacy Policy
                    </Link>.
                </p>

                {/* Log In */}
                <p className="text-xs text-center">
                    Already have an account?{" "}
                    <Link href="/auth/signin" className="text-[#4f46e5] underline font-medium">
                        Sign In
                    </Link>
                </p>
            </div>
        </main>
    )
}
