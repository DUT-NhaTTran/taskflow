"use client"

import { useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import UserStorageService from "@/services/userStorageService"

// Disable static optimization for this page
export const dynamic = 'force-dynamic'

function HomePageContent() {
  const router = useRouter()
  const { currentUser, clearCurrentUserId } = useUser()

  useEffect(() => {
    console.log("🏠 HomePage: Checking user authentication status...")
    
    // Clear all data if no user is logged in
    const userData = UserStorageService.getLoggedInUser()
    
    if (!userData || !currentUser) {
      console.log("🧹 HomePage: No valid user found, clearing all data...")
      
      // Clear all storage
      sessionStorage.clear()
      localStorage.clear()
      
      // Clear UserContext
      clearCurrentUserId()
      
      console.log("✅ All data cleared, redirecting to signin...")
      router.push("/auth/signin")
    } else {
      console.log("✅ HomePage: Valid user found:", currentUser.username)
      // Redirect to main project dashboard if user is logged in
      router.push("/project/project_homescreen")
    }
  }, [currentUser, clearCurrentUserId, router])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 rounded-full border-t-transparent mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-gray-700">Checking authentication...</h2>
        <p className="text-sm text-gray-500 mt-2">Please wait while we verify your session.</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 rounded-full border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-700">Loading...</h2>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}
