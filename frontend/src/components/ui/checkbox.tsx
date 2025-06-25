"use client"

import { Root, Indicator } from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function Checkbox({ className, ...props }: React.ComponentPropsWithoutRef<typeof Root>) {
    return (
        <Root
            className={cn(
                "h-5 w-5 rounded border border-gray-300 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400",
                className
            )}
            {...props}
        >
            <Indicator>
                <Check className="h-4 w-4" />
            </Indicator>
        </Root>
    )
}
