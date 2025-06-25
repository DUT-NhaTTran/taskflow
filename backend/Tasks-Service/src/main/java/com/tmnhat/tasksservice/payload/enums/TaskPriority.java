package com.tmnhat.tasksservice.payload.enums;

public enum TaskPriority {
    LOWEST(1, "Lowest", "#0891b2", "🔵"),
    LOW(2, "Low", "#059669", "🟢"), 
    MEDIUM(3, "Medium", "#d97706", "🟡"),
    HIGH(4, "High", "#ea580c", "🟠"),
    HIGHEST(5, "Highest", "#dc2626", "🔴"),
    BLOCKER(6, "Blocker", "#7c2d12", "🚨"),
    BLOCK(7, "Block", "#6b7280", "🚫"),
    REJECT(8, "Reject", "#4b5563", "❌");

    private final int level;
    private final String displayName;
    private final String colorCode;
    private final String icon;

    TaskPriority(int level, String displayName, String colorCode, String icon) {
        this.level = level;
        this.displayName = displayName;
        this.colorCode = colorCode;
        this.icon = icon;
    }

    public int getLevel() {
        return level;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getColorCode() {
        return colorCode;
    }

    public String getIcon() {
        return icon;
    }

    /**
     * Get priority by level (1-5)
     */
    public static TaskPriority fromLevel(int level) {
        for (TaskPriority priority : values()) {
            if (priority.level == level) {
                return priority;
            }
        }
        return MEDIUM; // Default fallback
    }

    /**
     * Get priority by display name
     */
    public static TaskPriority fromDisplayName(String displayName) {
        for (TaskPriority priority : values()) {
            if (priority.displayName.equalsIgnoreCase(displayName)) {
                return priority;
            }
        }
        return MEDIUM; // Default fallback
    }

    /**
     * Check if this priority is higher than another
     */
    public boolean isHigherThan(TaskPriority other) {
        return this.level > other.level;
    }

    /**
     * Check if this priority is lower than another
     */
    public boolean isLowerThan(TaskPriority other) {
        return this.level < other.level;
    }

    /**
     * Get CSS class for styling
     */
    public String getCssClass() {
        switch (this) {
            case BLOCKER: return "priority-blocker";
            case HIGHEST: return "priority-highest";
            case HIGH: return "priority-high";
            case MEDIUM: return "priority-medium";
            case LOW: return "priority-low";
            case LOWEST: return "priority-lowest";
            default: return "priority-medium";
        }
    }

    /**
     * Get background color class for UI
     */
    public String getBackgroundClass() {
        switch (this) {
            case BLOCKER: return "bg-red-200 text-red-900 border-red-400";
            case HIGHEST: return "bg-red-100 text-red-800";
            case HIGH: return "bg-orange-100 text-orange-800";
            case MEDIUM: return "bg-yellow-100 text-yellow-800";
            case LOW: return "bg-green-100 text-green-800";
            case LOWEST: return "bg-blue-100 text-blue-800";
            default: return "bg-gray-100 text-gray-800";
        }
    }

    @Override
    public String toString() {
        return displayName;
    }
} 