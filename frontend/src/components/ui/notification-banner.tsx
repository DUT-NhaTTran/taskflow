"use client"

import { X } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export function NotificationBanner() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <div className="bg-[#0747A6] text-white p-2 text-sm flex justify-between items-center">
            <div className="flex-1 text-center">
                The new navigation is now available and will be automatically turned on in the coming weeks. Turn it on for your
                team now or start with just yourself.{" "}
                <Link href="#" className="underline">
                    Go to settings
                </Link>
            </div>
            <button onClick={() => setIsVisible(false)} className="text-white hover:text-gray-200">
                <X className="h-5 w-5" />
            </button>
        </div>
    )
}
