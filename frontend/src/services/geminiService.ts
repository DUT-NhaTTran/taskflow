import { GEMINI_CONFIG, API_CONFIG } from '@/lib/config';

export interface ProjectMember {
  userId: string;
  username: string;
  email: string;
  role: string;
  actualRole?: string;
  avatar?: string;
  fullName?: string;
}

export interface ProjectData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  members: ProjectMember[];
}

export interface CompletedProjectInfo {
  name: string;
  description: string;
  duration: number;
  sprintCount: number;
  taskCount: number;
  technology: string[];
  teamSize: number;
  storyPointsPerSprint: number[];
}

export interface AIGeneratedSprint {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  goals: string[];
}

export interface AIGeneratedTask {
  title: string;
  description: string;
  label: 'STORY' | 'BUG' | 'TASK' | 'EPIC';
  priority: 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';
  estimatedHours: number;
  storyPoint?: number;
  assigneeRole: string;
  sprintIndex: number;
  sprint?: string;
  dependencies: string[];
  parentTaskTitle?: string;
  isParent: boolean;
  level: 'PARENT' | 'SUBTASK';
  assignee?: ProjectMember;
}

export interface AIProjectPlan {
  sprints: AIGeneratedSprint[];
  tasks: AIGeneratedTask[];
  recommendations: string[];
  estimatedCompletion: string;
}

class GeminiService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = GEMINI_CONFIG.API_KEY;
    this.apiUrl = GEMINI_CONFIG.API_URL;
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`${this.apiUrl}/${GEMINI_CONFIG.MODEL}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }

  private createProjectPrompt(projectData: ProjectData): string {
    const membersList = projectData.members.map(m => 
      `- ${m.username} (${m.role}): ${m.email}`
    ).join('\n');

    // Calculate project metrics based on complexity
    const projectDurationDays = Math.ceil((new Date(projectData.endDate).getTime() - new Date(projectData.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const numSprints = Math.ceil(projectDurationDays / 14); // 2-week sprints
    const teamSize = projectData.members.length;
    
    // Analyze project complexity from name and description
    const complexityKeywords = {
      high: ['enterprise', 'microservice', 'scalable', 'distributed', 'machine learning', 'ai', 'blockchain'],
      medium: ['web application', 'mobile app', 'dashboard', 'cms', 'e-commerce'],
      low: ['landing page', 'portfolio', 'blog', 'simple']
    };
    
    const projectText = `${projectData.name} ${projectData.description}`.toLowerCase();
    let complexity = 'medium';
    
    if (complexityKeywords.high.some(keyword => projectText.includes(keyword))) {
      complexity = 'high';
    } else if (complexityKeywords.low.some(keyword => projectText.includes(keyword))) {
      complexity = 'low';
    }
    
    // Dynamic task calculation based on complexity and team size
    const baseTasksPerSprint = complexity === 'high' ? 20 : complexity === 'medium' ? 17 : 15;
    const teamFactor = Math.min(teamSize / 4, 1.5); // Scale with team size but cap at 1.5x
    const tasksPerSprint = Math.floor(baseTasksPerSprint * teamFactor);
    const totalTasks = tasksPerSprint * numSprints;
    
    // Calculate task distribution: 80% tasks, 20% subtasks
    const mainTasks = Math.floor(totalTasks * 0.8);
    const subTasks = totalTasks - mainTasks;

    // Role-specific task types
    const roleTaskMapping: Record<string, string[]> = {
      'Frontend Developer': ['UI/UX implementation', 'Component development', 'Frontend testing', 'Responsive design'],
      'Backend Developer': ['API development', 'Database design', 'Backend testing', 'Server configuration'],
      'Full Stack Developer': ['Full feature implementation', 'Integration tasks', 'End-to-end testing'],
      'Tester': ['Test case creation', 'Manual testing', 'Automation testing', 'Bug validation'],
      'Designer': ['UI/UX design', 'Prototyping', 'Design system', 'User research'],
      'DevOps Engineer': ['CI/CD setup', 'Infrastructure', 'Deployment', 'Monitoring'],
      'Project Manager': ['Sprint planning', 'Stakeholder communication', 'Documentation']
    };

    const availableRoles = projectData.members.map(m => m.role);
    const roleTaskTypes = availableRoles.map(role => 
      `${role}: ${roleTaskMapping[role] || ['General development tasks']}`
    ).join('\n');

    return `Generate a complete project plan for: ${projectData.name}
Description: ${projectData.description}
Complexity Level: ${complexity.toUpperCase()}

PROJECT METRICS:
- Duration: ${projectDurationDays} days (${numSprints} sprints x 2 weeks)
- Team Size: ${teamSize} members
- Tasks Per Sprint: ${tasksPerSprint} (adaptive based on complexity)
- Total Tasks: ${totalTasks} (${mainTasks} main tasks + ${subTasks} subtasks)

TEAM MEMBERS & ROLES:
${membersList}

ROLE-SPECIFIC TASK TYPES:
${roleTaskTypes}

STRICT REQUIREMENTS:
1. Generate EXACTLY ${totalTasks} tasks across ${numSprints} sprints
2. Each sprint must have approximately ${tasksPerSprint} tasks (can vary ±2)
3. Task Distribution: 80% main tasks (STORY/EPIC), 20% subtasks (TASK)
4. CRITICAL: Assign tasks ONLY to appropriate roles:
   - Frontend tasks → Frontend Developer
   - Backend tasks → Backend Developer  
   - Testing tasks → Tester
   - Design tasks → Designer
   - Full Stack can take any development task
5. Priority distribution: 15% HIGHEST, 25% HIGH, 40% MEDIUM, 20% LOW
6. Story points: 1-2 (simple), 3-5 (medium), 8-13 (complex)

TASK CREATION RULES:
- Create main tasks first, then identify which need subtasks
- Subtasks should be specific implementation details of main tasks
- Each subtask must reference its parent task
- Dependencies should be realistic and necessary
- Sprint sequencing: Foundation → Core Features → Advanced Features → Polish

OUTPUT JSON FORMAT (clean JSON only, no markdown):
{
  "sprints": [
    {
      "name": "Sprint 1: Project Foundation",
      "description": "Setup and core infrastructure", 
      "startDate": "${projectData.startDate}",
      "endDate": "YYYY-MM-DD",
      "goals": ["Project setup", "Core architecture"]
    }
  ],
  "tasks": [
    {
      "title": "Database Schema Design",
      "description": "Design and implement database schema with entities, relationships, and constraints",
      "label": "STORY",
      "priority": "HIGHEST",
      "storyPoint": 5,
      "assigneeRole": "Backend Developer",
      "sprintIndex": 0,
      "dependencies": [],
      "parentTaskTitle": null,
      "isParent": true,
      "level": "PARENT"
    },
    {
      "title": "Create User Entity Table",
      "description": "Implement user table with proper indexes and constraints",
      "label": "TASK", 
      "priority": "HIGH",
      "storyPoint": 2,
      "assigneeRole": "Backend Developer",
      "sprintIndex": 0,
      "dependencies": [],
      "parentTaskTitle": "Database Schema Design",
      "isParent": false,
      "level": "SUBTASK"
    }
  ],
  "recommendations": [
    "Focus on MVP features first",
    "Implement testing throughout development",
    "Regular code reviews and integration"
  ],
  "estimatedCompletion": "${projectData.endDate}"
}`;
  }

  async generateProjectPlan(projectData: ProjectData): Promise<AIProjectPlan> {
    try {
      const prompt = this.createProjectPrompt(projectData);
      const response = await this.callGeminiAPI(prompt);
      
      // Clean the response by removing markdown formatting
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const plan: AIProjectPlan = JSON.parse(cleanResponse);
      
      // Basic validation
      if (!plan.sprints || !plan.tasks) {
        throw new Error('Invalid plan structure received from AI');
      }
      
      // Ensure storyPoint field exists and convert estimatedHours to storyPoint if needed
      plan.tasks = plan.tasks.map(task => ({
        ...task,
        storyPoint: task.storyPoint || Math.ceil((task.estimatedHours || 4) / 4)
      }));
      
      return this.redistributeTasksIfNeeded(plan);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI response. Please try again.');
      }
      throw error;
    }
  }

  private redistributeTasksIfNeeded(plan: AIProjectPlan): AIProjectPlan {
    const sprintTaskCounts = plan.sprints.map((_, index) => 
      plan.tasks.filter(task => task.sprintIndex === index).length
    );
    
    const targetTasksPerSprint = Math.ceil(plan.tasks.length / plan.sprints.length);
    
    for (let i = 0; i < sprintTaskCounts.length; i++) {
      if (sprintTaskCounts[i] > targetTasksPerSprint + 3 || sprintTaskCounts[i] < targetTasksPerSprint - 3) {
        const excessTasks = plan.tasks.filter(task => 
          task.sprintIndex === i && task.level === 'PARENT'
        ).slice(targetTasksPerSprint);
        
        for (const task of excessTasks) {
          const nextSprint = (i + 1) % plan.sprints.length;
          const relatedTasks = plan.tasks.filter(t => 
            t.parentTaskTitle === task.title || t.title === task.title
          );
          
          relatedTasks.forEach(t => {
            t.sprintIndex = nextSprint;
          });
        }
      }
    }
    
    return plan;
  }

  async improveTaskDescription(taskTitle: string, currentDescription: string): Promise<string> {
    const prompt = `Improve this task description to be more detailed and actionable:

Task: ${taskTitle}
Current Description: ${currentDescription}

Make it:
- More specific and detailed
- Include acceptance criteria
- Add technical requirements if applicable
- Keep it concise but comprehensive
- Focus on what needs to be delivered

Return only the improved description, no additional text or formatting.`;

    try {
      const response = await this.callGeminiAPI(prompt);
      return response.trim();
    } catch (error) {
      throw new Error('Failed to improve task description');
    }
  }
}

export default new GeminiService(); 