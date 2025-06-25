"use client"

import { ChevronDown } from "lucide-react"
import * as React from "react"

interface DropdownProps {
    placeholder?: string
    options: string[]
    onSelect?: (value: string) => void
    defaultValue?: string
    disabled?: boolean
    className?: string
}

export function Dropdown({ 
    placeholder = "Select an option", 
    options, 
    onSelect, 
    defaultValue, 
    disabled = false,
    className = ""
}: DropdownProps) {
    const [selected, setSelected] = React.useState(defaultValue || placeholder)
    const [open, setOpen] = React.useState(false)
    const [dropUp, setDropUp] = React.useState(false)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)

    // Update selected value when defaultValue changes
    React.useEffect(() => {
        if (defaultValue) {
            setSelected(defaultValue)
        }
    }, [defaultValue])

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        if (open) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [open])

    // Auto-position dropdown to prevent clipping
    React.useEffect(() => {
        if (open && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect()
            const menuHeight = Math.min(options.length * 40 + 16, 240) // Estimate menu height (max-h-60)
            const spaceBelow = window.innerHeight - rect.bottom
            const spaceAbove = rect.top
            
            // Open upward if there's not enough space below but enough space above
            setDropUp(spaceBelow < menuHeight && spaceAbove > menuHeight)
        }
    }, [open, options.length])

    const handleSelect = (option: string) => {
        console.log('Dropdown selecting:', option) // Debug log
        setSelected(option)
        setOpen(false)
        onSelect?.(option)
    }

    const handleToggle = () => {
        if (!disabled) {
            console.log('Dropdown toggle, current open:', open) // Debug log
            setOpen(!open)
        }
    }

    console.log('Dropdown render - open:', open, 'options:', options) // Debug log

    return (
        <div ref={dropdownRef} className={`relative w-full text-sm ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                className={`w-full ${
                    className.includes('border-0') 
                        ? '' 
                        : 'border'
                } ${
                    disabled 
                        ? 'bg-gray-100 text-gray-400 border-gray-200' 
                        : className.includes('border-0')
                            ? 'bg-white hover:bg-gray-50'
                            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                } ${
                    className.includes('rounded-none') ? 'rounded-none' : 'rounded-md'
                } px-3 py-2 h-9 flex items-center justify-between text-left transition-colors ${
                    !disabled && 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
                disabled={disabled}
            >
                <span className={`truncate ${selected === placeholder ? "text-gray-400" : "text-gray-900"}`}>
                    {selected}
                </span>
                <ChevronDown className={`h-4 w-4 ml-2 flex-shrink-0 transition-transform ${
                    open ? 'rotate-180' : ''
                } ${disabled ? 'text-gray-300' : 'text-gray-500'}`} />
            </button>

            {open && !disabled && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    
                    {/* Dropdown menu */}
                    <div 
                        ref={menuRef}
                        className={`absolute z-50 w-full min-w-max border border-gray-200 rounded-md bg-white shadow-lg ${
                            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
                        }`}
                    >
                        <div className="py-1 max-h-60 overflow-auto">
                            {options.map((option) => {
                                const isSelected = option === selected
                                
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                                            isSelected 
                                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                                : 'text-gray-700'
                                        }`}
                                    >
                                        <span className="truncate">{option}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
