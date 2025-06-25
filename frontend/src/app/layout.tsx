// src/app/layout.tsx

import './globals.css'
import { ReactNode, Suspense } from 'react'
import { Inter } from 'next/font/google'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { Toaster } from 'sonner'
import { UserProvider } from '@/contexts/UserContext'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Task Flow',
    description: 'Project management application',
}

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className={inter.className}>
            <body>
                <UserProvider>
                    <Suspense fallback={<div>Loading...</div>}>
                        <NavigationProvider>
                            {children}
                        </NavigationProvider>
                    </Suspense>
                    <Toaster position="top-right" />
                </UserProvider>
            </body>
        </html>
    )
}
