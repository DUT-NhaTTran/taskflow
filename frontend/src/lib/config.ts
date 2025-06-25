// API Configuration
export const API_CONFIG = {
  ACCOUNTS_SERVICE: process.env.NEXT_PUBLIC_ACCOUNTS_API_URL || 'http://14.225.210.28:8080',
  PROJECTS_SERVICE: process.env.NEXT_PUBLIC_PROJECTS_API_URL || 'http://14.225.210.28:8083',
  SPRINTS_SERVICE: process.env.NEXT_PUBLIC_SPRINTS_API_URL || 'http://14.225.210.28:8084',
  TASKS_SERVICE: process.env.NEXT_PUBLIC_TASKS_API_URL || 'http://14.225.210.28:8085',
  USER_SERVICE: process.env.NEXT_PUBLIC_USER_API_URL || 'http://14.225.210.28:8086',
  FILE_SERVICE: process.env.NEXT_PUBLIC_FILE_API_URL || 'http://14.225.210.28:8087',
  AI_SERVICE: process.env.NEXT_PUBLIC_AI_API_URL || 'http://14.225.210.28:8088',
  NOTIFICATION_SERVICE: process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://14.225.210.28:8089',
};

// Gemini AI Configuration
export const GEMINI_CONFIG = {
  API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  MODEL: 'gemini-1.5-flash',
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// Helper function to get full API URL
export const getApiUrl = (service: keyof typeof API_CONFIG, path: string = '') => {
  return `${API_CONFIG[service]}${path}`;
}; 