import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface AIEstimationData {
  estimated_story_points: number;
  confidence: number;
  reasoning: string;
  features_used?: {
    title_length?: number;
    description_length?: number;
    word_count?: number;
    predicted_raw?: number;
    complexity_score?: number;
    
    // Complexity keywords
    complexity_high?: number;
    complexity_medium?: number;
    complexity_low?: number;
    

    // Technical indicators
    has_ui_words?: number;
    has_backend_words?: number;
    has_integration_words?: number;
    has_testing_words?: number;
    
    // Readability metrics
    flesch_reading_ease?: number;
    flesch_kincaid_grade?: number;
    
    // TF-IDF features
    tfidf_feature_count?: number;
    tfidf_max_score?: number;
    tfidf_mean_score?: number;
    
    // Top features
    top_features?: Array<{name: string; importance: number}>;
    
    // Metadata
    priority_encoded?: number;
    attachments_count?: number;
    
    // Top TF-IDF terms
    top_tfidf_terms?: Array<{term: string; score: number}>;
    
    // New fields from backend v3
    raw_prediction?: number;            // alias of predicted_raw (keep for compatibility)
    feature_count?: number;
    has_description?: boolean;
    has_attachments?: boolean;
    has_priority?: boolean;
    has_task_type?: boolean;
  };
}

interface AIEstimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (storyPoints: number) => void;
  onReject: () => void;
  estimationData: AIEstimationData;
  taskTitle: string;
  currentEstimate?: number;
}

export default function AIEstimationModal({
  isOpen,
  onClose,
  onAccept,
  onReject,
  estimationData,
  taskTitle,
  currentEstimate,
}: AIEstimationModalProps) {
  if (!isOpen) return null;

  const { estimated_story_points, confidence, reasoning, features_used } = estimationData;
  
  // Calculate confidence level and color
  const getConfidenceInfo = (conf: number) => {
    if (conf >= 0.8) return { level: 'High', color: 'text-green-600', bgColor: 'bg-green-100', progressColor: 'bg-green-500' };
    if (conf >= 0.6) return { level: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100', progressColor: 'bg-yellow-500' };
    return { level: 'Low', color: 'text-red-600', bgColor: 'bg-red-100', progressColor: 'bg-red-500' };
  };

  const confInfo = getConfidenceInfo(confidence);
  const confidencePercent = Math.round(confidence * 100);

  // Get recommendation badge color
  const getRecommendationColor = () => {
    if (estimated_story_points <= 3) return 'bg-green-100 text-green-800';
    if (estimated_story_points <= 8) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const handleAccept = () => {
    onAccept(estimated_story_points);
    onClose();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                🤖 AI Story Point Estimation
              </h2>
              <p className="text-sm text-gray-600 line-clamp-2">
                <span className="font-medium">Task:</span> {taskTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* AI Recommendation */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-purple-900">AI Recommendation</h3>
              <Badge className={getRecommendationColor()}>
                {estimated_story_points} Story Points
              </Badge>
            </div>
            
            {/* Current vs Recommended */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-gray-900">{currentEstimate || 'None'}</div>
                <div className="text-sm text-gray-600">Current Estimate</div>
              </div>
              <div className="text-center p-3 bg-purple-100 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-900">{estimated_story_points}</div>
                <div className="text-sm text-purple-700">AI Recommendation</div>
              </div>
            </div>

            {/* Confidence Level */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Confidence Level</span>
                <span className={`text-sm font-medium ${confInfo.color}`}>
                  {confInfo.level} ({confidencePercent}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${confInfo.progressColor}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="bg-white rounded-lg p-3 border">
              <h4 className="text-sm font-medium text-gray-900 mb-2">💡 AI Analysis</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{reasoning}</p>
            </div>
          </div>

          {/* Technical Details */}
          {features_used && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4">📊 Detailed AI Analysis</h4>
              
              {/* Basic Text Analysis */}
              {((features_used.title_length && features_used.title_length > 0) ||
                (features_used.description_length && features_used.description_length > 0) ||
                (features_used.word_count && features_used.word_count > 0)) && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">📝 Text Analysis</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-lg font-bold text-blue-600">{features_used.title_length || 0}</div>
                      <div className="text-xs text-gray-600">Title Length</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-lg font-bold text-blue-600">{features_used.description_length || 0}</div>
                      <div className="text-xs text-gray-600">Description Length</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-lg font-bold text-blue-600">{features_used.word_count || 0}</div>
                      <div className="text-xs text-gray-600">Total Words</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Complexity Analysis */}
              {((features_used.complexity_high && features_used.complexity_high > 0) ||
                (features_used.complexity_medium && features_used.complexity_medium > 0) ||
                (features_used.complexity_low && features_used.complexity_low > 0)) && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">🧠 Complexity Keywords</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                      <div className="text-lg font-bold text-red-600">{features_used.complexity_high || 0}</div>
                      <div className="text-xs text-red-700">High Complex</div>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-lg font-bold text-yellow-600">{features_used.complexity_medium || 0}</div>
                      <div className="text-xs text-yellow-700">Medium Complex</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                      <div className="text-lg font-bold text-green-600">{features_used.complexity_low || 0}</div>
                      <div className="text-xs text-green-700">Low Complex</div>
                    </div>
                  </div>
                  {features_used.complexity_score && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-gray-600">Overall Complexity Score: </span>
                      <Badge variant="outline" className="ml-1">{features_used.complexity_score.toFixed(3)}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Technical Indicators */}
              {(features_used.has_ui_words === 1 || features_used.has_backend_words === 1 || features_used.has_integration_words === 1 || features_used.has_testing_words === 1) && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">⚙️ Technical Areas</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {features_used.has_ui_words === 1 && (
                      <div className="flex items-center gap-1 p-2 bg-blue-50 rounded border border-blue-200">
                        <span className="text-blue-600">🎨</span>
                        <span className="text-xs text-blue-700">UI/Frontend</span>
                      </div>
                    )}
                    {features_used.has_backend_words === 1 && (
                      <div className="flex items-center gap-1 p-2 bg-purple-50 rounded border border-purple-200">
                        <span className="text-purple-600">⚙️</span>
                        <span className="text-xs text-purple-700">Backend/API</span>
                      </div>
                    )}
                    {features_used.has_integration_words === 1 && (
                      <div className="flex items-center gap-1 p-2 bg-orange-50 rounded border border-orange-200">
                        <span className="text-orange-600">🔗</span>
                        <span className="text-xs text-orange-700">Integration</span>
                      </div>
                    )}
                    {features_used.has_testing_words === 1 && (
                      <div className="flex items-center gap-1 p-2 bg-green-50 rounded border border-green-200">
                        <span className="text-green-600">🧪</span>
                        <span className="text-xs text-green-700">Testing</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TF-IDF Analysis */}
              {((features_used.tfidf_feature_count && features_used.tfidf_feature_count > 0) ||
                (features_used.feature_count && features_used.feature_count > 0)) && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">🔍 TF-IDF Analysis</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-sm font-bold text-indigo-600">{features_used.tfidf_feature_count || features_used.feature_count}</div>
                      <div className="text-xs text-gray-600">Features</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-sm font-bold text-indigo-600">{features_used.tfidf_max_score?.toFixed(3) || 0}</div>
                      <div className="text-xs text-gray-600">Max Score</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded border">
                      <div className="text-sm font-bold text-indigo-600">{features_used.tfidf_mean_score?.toFixed(3) || 0}</div>
                      <div className="text-xs text-gray-600">Avg Score</div>
                    </div>
                  </div>
                </div>
              )}


              {/* Readability & Other Metrics */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-3">
                  {features_used.flesch_reading_ease !== undefined && (
                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-xs text-gray-600">Reading Ease</span>
                      <Badge variant="outline">{features_used.flesch_reading_ease}</Badge>
                    </div>
                  )}
                  {features_used.flesch_kincaid_grade !== undefined && (
                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-xs text-gray-600">Grade Level</span>
                      <Badge variant="outline">{features_used.flesch_kincaid_grade}</Badge>
                    </div>
                  )}
                  {features_used.priority_encoded !== undefined && (
                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-xs text-gray-600">Priority Level</span>
                      <Badge variant="outline">{features_used.priority_encoded}</Badge>
                    </div>
                  )}
                  {features_used.attachments_count !== undefined && (
                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-xs text-gray-600">Attachments</span>
                      <Badge variant="outline">{features_used.attachments_count}</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw AI Prediction */}
              {(features_used.predicted_raw || features_used.raw_prediction) && (
                <div className="text-center p-3 bg-purple-50 rounded border border-purple-200">
                  <div className="text-xs text-purple-700 mb-1">Raw AI Prediction</div>
                  <div className="text-lg font-bold text-purple-800">{(features_used.predicted_raw ?? features_used.raw_prediction)?.toFixed(3)}</div>
                  <div className="text-xs text-purple-600">Before Fibonacci mapping</div>
                </div>
              )}

              {/* Catch-all for any extra features we have not explicitly shown */}
              {(() => {
                const handledKeys = [
                  'title_length',
                  'description_length',
                  'word_count',
                  'complexity_high',
                  'complexity_medium',
                  'complexity_low',
                  'complexity_score',
                  'effort_high',
                  'effort_medium',
                  'effort_low',
                  'has_ui_words',
                  'has_backend_words',
                  'has_integration_words',
                  'has_testing_words',
                  'tfidf_feature_count',
                  'tfidf_max_score',
                  'tfidf_mean_score',
                  'top_features',
                  'flesch_reading_ease',
                  'flesch_kincaid_grade',
                  'priority_encoded',
                  'attachments_count',
                  'raw_prediction',
                  'feature_count',
                  'has_description',
                  'has_attachments',
                  'has_priority',
                  'has_task_type',
                  'top_tfidf_terms'
                ];
                const others = Object.entries(features_used || {}).filter(
                  ([key]) => !handledKeys.includes(key)
                );
                if (others.length === 0) return null;
                return (
                  <div className="mt-6">
                    <div className="grid grid-cols-2 gap-2">
                      {others.map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-white rounded border">
                          <span className="text-xs text-gray-600 break-all">{
                            key
                              .split('_')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(' ')
                          }</span>
                          <Badge variant="outline">
                            {typeof value === 'boolean'
                              ? value
                                ? 'Yes'
                                : 'No'
                              : String(value)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Presence Flags */}
              {((features_used.has_description !== undefined) || (features_used.has_attachments !== undefined) || (features_used.has_priority !== undefined) || (features_used.has_task_type !== undefined)) && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">🗂 Metadata Presence</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {features_used.has_description !== undefined && (
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-xs text-gray-600">Description</span>
                        <Badge variant="outline">{features_used.has_description ? 'Yes' : 'No'}</Badge>
                      </div>
                    )}
                    {features_used.has_attachments !== undefined && (
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-xs text-gray-600">Attachments</span>
                        <Badge variant="outline">{features_used.has_attachments ? 'Yes' : 'No'}</Badge>
                      </div>
                    )}
                    {features_used.has_priority !== undefined && (
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-xs text-gray-600">Priority Set</span>
                        <Badge variant="outline">{features_used.has_priority ? 'Yes' : 'No'}</Badge>
                      </div>
                    )}
                    {features_used.has_task_type !== undefined && (
                      <div className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-xs text-gray-600">Task Type</span>
                        <Badge variant="outline">{features_used.has_task_type ? 'Yes' : 'No'}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}


            </div>
          )}

          {/* Comparison Alert */}
          {currentEstimate && currentEstimate !== estimated_story_points && (
            <div className={`rounded-lg p-4 mb-6 ${
              estimated_story_points > currentEstimate 
                ? 'bg-orange-50 border border-orange-200' 
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {estimated_story_points > currentEstimate ? (
                    <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h5 className={`text-sm font-medium ${
                    estimated_story_points > currentEstimate ? 'text-orange-800' : 'text-green-800'
                  }`}>
                    {estimated_story_points > currentEstimate 
                      ? '⚠️ AI suggests higher complexity' 
                      : '✅ AI suggests lower complexity'
                    }
                  </h5>
                  <p className={`text-sm ${
                    estimated_story_points > currentEstimate ? 'text-orange-700' : 'text-green-700'
                  }`}>
                    {estimated_story_points > currentEstimate
                      ? `The task may be more complex than initially estimated (+${estimated_story_points - currentEstimate} points)`
                      : `The task may be simpler than initially estimated (-${currentEstimate - estimated_story_points} points)`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t bg-gray-50 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleReject}
              className="px-6"
            >
              ✗ Reject AI Suggestion
            </Button>
            <Button
              onClick={handleAccept}
              className="px-6 bg-purple-600 hover:bg-purple-700 text-white"
            >
              ✓ Accept {estimated_story_points} Points
            </Button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            You can always manually adjust the estimate after accepting the AI suggestion
          </p>
        </div>
      </div>
    </div>
  );
} 