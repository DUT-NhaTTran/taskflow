"use client"

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Clock, Users, Calendar, CheckCircle } from "lucide-react";
import GeminiService, { ProjectData, ProjectMember, AIProjectPlan } from '@/services/geminiService';
import { API_CONFIG } from '@/lib/config';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/drop-down";

interface AIProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
  availableUsers: any[];
}

interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  selectedMembers: ProjectMember[];
  type: string;
}

const AIProjectCreationModal: React.FC<AIProjectCreationModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  availableUsers
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'generating' | 'review'>('form');
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    selectedMembers: [],
    type: 'Team-managed'
  });
  const [aiPlan, setAiPlan] = useState<AIProjectPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { currentUser } = useUser();

  // Date validation helpers
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMinEndDate = () => {
    if (!formData.startDate) return getTodayString();
    const startDate = new Date(formData.startDate);
    const minEndDate = new Date(startDate);
    minEndDate.setDate(minEndDate.getDate() + 1);
    return minEndDate.toISOString().split('T')[0];
  };

  const handleStartDateChange = (date: string) => {
    setFormData(prev => {
      const newFormData = { ...prev, startDate: date };
      if (prev.endDate && new Date(prev.endDate) <= new Date(date)) {
        const minEndDate = new Date(date);
        minEndDate.setDate(minEndDate.getDate() + 1);
        newFormData.endDate = minEndDate.toISOString().split('T')[0];
      }
      return newFormData;
    });
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleUserSelect = (user: any) => {
    const isSelected = formData.selectedMembers.find(m => m.userId === user.id);
    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        selectedMembers: prev.selectedMembers.filter(m => m.userId !== user.id)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedMembers: [...prev.selectedMembers, {
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.userRole || 'DEVELOPER'
        }]
      }));
    }
  };

  const handleGenerateProject = async () => {
    if (!formData.name || !formData.description || !formData.startDate || !formData.endDate || formData.selectedMembers.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (startDate < today) {
      toast.error('Start date cannot be in the past');
      return;
    }

    if (endDate <= startDate) {
      toast.error('End date must be at least 1 day after start date');
      return;
    }

    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (durationDays < 7) {
      toast.error('Project duration must be at least 7 days');
      return;
    }

    setIsLoading(true);
    setCurrentStep('generating');

    try {
      const projectData: ProjectData = {
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        members: formData.selectedMembers
      };

      const plan = await GeminiService.generateProjectPlan(projectData, []);
      setAiPlan(plan);
      setCurrentStep('review');
      toast.success('AI project plan generated successfully!');
    } catch (error) {
      console.error('Error generating project plan:', error);
      toast.error('Failed to generate project plan. Please try again.');
      setCurrentStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!aiPlan) return;

    setIsLoading(true);
    try {
      console.log('🚀 Starting AI project creation...');
      
      if (!currentUser?.id) {
        throw new Error('Current user not found. Please log in again.');
      }
      
      const projectKey = formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10);
      
      const projectPayload = {
        name: formData.name,
        description: formData.description,
        key: projectKey,
        projectType: formData.type,
        access: 'Private',
        deadline: formData.endDate,
        status: 'ACTIVE',
        aiGenerated: true,
        ownerId: currentUser.id,
        createdAt: new Date().toISOString()
      };
      
      const projectResponse = await fetch(`${API_CONFIG.PROJECTS_SERVICE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload)
      });

      if (!projectResponse.ok) {
        const errorText = await projectResponse.text();
        throw new Error(`Failed to create project: ${projectResponse.status} - ${errorText}`);
      }
      
      const project = await projectResponse.json();
      const projectId = project.id || project.data?.id;
      
      if (!projectId) {
        throw new Error('No project ID returned from server');
      }

      // Add project owner
      const ownerResponse = await fetch(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          roleInProject: 'PRODUCT_OWNER'
        })
      });

      // Add other members
      for (const member of formData.selectedMembers) {
        await fetch(`${API_CONFIG.PROJECTS_SERVICE}/api/projects/${projectId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: member.userId,
            roleInProject: member.role
          })
        });
      }

      console.log('🎉 AI Project creation completed successfully!');
      toast.success('AI Project created successfully!');
      onProjectCreated(projectId);
      onClose();
      resetForm();

    } catch (error) {
      console.error('❌ Error creating AI project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to create project: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep('form');
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      selectedMembers: [],
      type: 'Team-managed'
    });
    setAiPlan(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'DEVELOPER': 'bg-blue-100 text-blue-800',
      'TESTER': 'bg-yellow-100 text-yellow-800',
      'DESIGNER': 'bg-pink-100 text-pink-800',
      'MANAGER': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Brain className="h-6 w-6 text-purple-600" />
            AI Project Creation
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'form' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Duration *</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      min={getTodayString()}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      min={getMinEndDate()}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full"
                      disabled={!formData.startDate}
                    />
                  </div>
                </div>
                {formData.startDate && formData.endDate && (
                  <div className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Duration: {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">
                Project Description
              </Label>
              <Textarea
                id="description"
                placeholder="Enter project description..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="type" className="text-sm font-medium">
                Project Type
              </Label>
              <Dropdown
                placeholder="Select project type"
                options={["Team-managed", "Company-managed"]}
                defaultValue={formData.type}
                onSelect={(value) => setFormData(prev => ({ ...prev, type: value }))}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Team Members *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {availableUsers.map(user => {
                  const isSelected = formData.selectedMembers.find(m => m.userId === user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      <Badge className={`text-xs mt-1 ${getRoleBadgeColor(user.userRole || 'DEVELOPER')}`}>
                        {user.userRole || 'DEVELOPER'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              
              {formData.selectedMembers.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">Selected Members ({formData.selectedMembers.length}):</div>
                  <div className="flex flex-wrap gap-2">
                    {formData.selectedMembers.map(member => (
                      <Badge key={member.userId} variant="secondary" className="text-xs">
                        {member.username} - {member.role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerateProject} disabled={isLoading}>
                <Brain className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'generating' && (
          <div className="text-center py-8">
            <div className="animate-spin h-12 w-12 border-4 border-purple-600 rounded-full border-t-transparent mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">AI is creating your project plan...</h3>
            <p className="text-gray-600">This may take a few seconds. Please wait.</p>
          </div>
        )}

        {currentStep === 'review' && aiPlan && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">AI Generated Project Plan</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>{aiPlan.sprints?.length || 0} Sprints</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{aiPlan.tasks?.length || 0} Tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span>{formData.selectedMembers.length + 1} Members</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span>Est. {aiPlan.estimatedCompletion}</span>
                </div>
              </div>
            </div>

            {/* Simplified Sprint View */}
            <div className="space-y-4">
              <h4 className="font-semibold">Sprint Overview:</h4>
              {aiPlan.sprints?.map((sprint, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{sprint.name}</CardTitle>
                    <div className="text-sm text-gray-600">
                      {sprint.startDate} to {sprint.endDate}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-3">{sprint.description}</p>
                    <div className="mb-4">
                      <div className="font-medium text-sm mb-1">Goals:</div>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {sprint.goals?.map((goal, goalIndex) => (
                          <li key={goalIndex}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )) || <p>No sprints generated</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrentStep('form')}>
                Back to Edit
              </Button>
              <Button onClick={handleCreateProject} disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AIProjectCreationModal; 