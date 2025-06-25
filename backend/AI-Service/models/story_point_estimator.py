import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, List, Any, Optional
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import logging

from utils.text_preprocessor import TextPreprocessor

logger = logging.getLogger(__name__)

class StoryPointEstimator:
    """Unified Story Point Estimator using comprehensive TextPreprocessor features"""
    
    def __init__(self, model_path: str = "data/models"):
        self.model_path = model_path
        self.preprocessor = TextPreprocessor()
        # Optimized Random Forest for better accuracy with more features
        self.prediction_model = RandomForestRegressor(
            n_estimators=100,       # More trees for better accuracy with 120 features
            max_depth=8,           # Deeper trees to capture complex patterns
            min_samples_split=5,   # Prevent overfitting
            min_samples_leaf=3,    # Prevent overfitting
            max_features='sqrt',   # Use sqrt(features) for each tree
            random_state=42
        )
        self.is_fitted = False
        self.training_stats = {}
        os.makedirs(model_path, exist_ok=True)
        self._load_model()

    def _prepare_features(self, title: str, description: str = "", 
                         priority: Optional[str] = None,
                         attachments_count: Optional[int] = None,
                         task_type: Optional[str] = None) -> np.ndarray:
        """Extract comprehensive features using TextPreprocessor"""
        
        return self.preprocessor.calculate_comprehensive_features(
            title, description, priority, attachments_count, task_type
        )

    def _map_to_fibonacci(self, prediction: float) -> int:
        """Map continuous prediction to Fibonacci story points"""
        fibonacci_points = [1, 2, 3, 5, 8, 13, 21]
        
        # Find closest Fibonacci number
        distances = [abs(prediction - point) for point in fibonacci_points]
        return fibonacci_points[distances.index(min(distances))]

    def _handle_overfitting(self, X_train, y_train, X_val, y_val, X_test, y_test, overfitting_gap):
        """Automatically retrain with reduced complexity when overfitting is detected"""
        if overfitting_gap <= 0.5:
            return False  # No overfitting, no need to adjust
            
        logger.info(f"🔧 Attempting to reduce overfitting (gap: {overfitting_gap:.3f})...")
        
        # Create a simpler model
        simple_model = RandomForestRegressor(
            n_estimators=50,        # Reduced from 100
            max_depth=5,           # Reduced from 8  
            min_samples_split=10,  # Increased from 5
            min_samples_leaf=5,    # Increased from 3
            max_features='sqrt',
            random_state=42
        )
        
        # Retrain with simpler model
        simple_model.fit(X_train, y_train)
        
        # Evaluate simple model
        y_train_pred_simple = simple_model.predict(X_train)
        y_val_pred_simple = simple_model.predict(X_val)
        y_test_pred_simple = simple_model.predict(X_test)
        
        # Map to Fibonacci
        y_train_fib_simple = [self._map_to_fibonacci(p) for p in y_train_pred_simple]
        y_val_fib_simple = [self._map_to_fibonacci(p) for p in y_val_pred_simple]
        y_test_fib_simple = [self._map_to_fibonacci(p) for p in y_test_pred_simple]
        
        train_mae_simple = mean_absolute_error(y_train, y_train_fib_simple)
        val_mae_simple = mean_absolute_error(y_val, y_val_fib_simple)
        test_mae_simple = mean_absolute_error(y_test, y_test_fib_simple)
        
        new_gap = val_mae_simple - train_mae_simple
        
        # Use simpler model if it reduces overfitting significantly
        if new_gap < overfitting_gap - 0.1:  # At least 0.1 improvement
            logger.info(f"✅ Overfitting reduced! New gap: {new_gap:.3f}")
            logger.info(f"   Switching to simpler model (50 trees, max_depth=5)")
            
            self.prediction_model = simple_model
            return {
                'train_mae': train_mae_simple,
                'val_mae': val_mae_simple, 
                'test_mae': test_mae_simple,
                'overfitting_gap': new_gap,
                'model_adjusted': True
            }
        else:
            logger.warning(f"⚠️ Simpler model didn't help (gap: {new_gap:.3f})")
            return False

    def _get_enhanced_training_data(self) -> List[Dict[str, Any]]:
        """Enhanced training samples with metadata"""
        return [
            # Simple tasks (1 point)
            {"title": "Fix typo in button text", "description": "Update spelling error on submit button", 
             "storyPoint": 1, "priority": "low", "task_type": "bug", "attachments_count": 0},
            {"title": "Change button color", "description": "Update primary button color to blue", 
             "storyPoint": 1, "priority": "low", "task_type": "fix", "attachments_count": 0},
            
            # Small tasks (2 points)
            {"title": "Add email validation", "description": "Add client-side email format validation", 
             "storyPoint": 2, "priority": "medium", "task_type": "feature", "attachments_count": 0},
            {"title": "Show error message", "description": "Display error alert when login fails", 
             "storyPoint": 2, "priority": "medium", "task_type": "feature", "attachments_count": 1},
            
            # Medium tasks (3 points)
            {"title": "Build modal component", "description": "Create reusable modal dialog component with animations", 
             "storyPoint": 3, "priority": "medium", "task_type": "feature", "attachments_count": 2},
            {"title": "Implement pagination", "description": "Add pagination controls for data tables", 
             "storyPoint": 3, "priority": "medium", "task_type": "feature", "attachments_count": 1},
            
            # Standard tasks (5 points)
            {"title": "File upload system", "description": "Build file upload with progress bar and validation", 
             "storyPoint": 5, "priority": "high", "task_type": "feature", "attachments_count": 3},
            {"title": "User authentication", "description": "Implement login system with session management", 
             "storyPoint": 5, "priority": "high", "task_type": "feature", "attachments_count": 2},
            
            # Complex tasks (8 points)
            {"title": "OAuth2 integration", "description": "Add Google OAuth2 authentication with refresh tokens", 
             "storyPoint": 8, "priority": "high", "task_type": "integration", "attachments_count": 4},
            {"title": "Analytics dashboard", "description": "Create real-time analytics dashboard with charts", 
             "storyPoint": 8, "priority": "medium", "task_type": "feature", "attachments_count": 5},
            
            # Large tasks (13 points)
            {"title": "Payment gateway integration", "description": "Integrate Stripe payment system with webhook handling", 
             "storyPoint": 13, "priority": "high", "task_type": "integration", "attachments_count": 6},
            {"title": "Microservices architecture", "description": "Refactor monolith to microservices with API gateway", 
             "storyPoint": 13, "priority": "high", "task_type": "epic", "attachments_count": 8},
            
            # Epic tasks (21 points)
            {"title": "Database migration", "description": "Migrate from MySQL to PostgreSQL with zero downtime", 
             "storyPoint": 21, "priority": "high", "task_type": "migration", "attachments_count": 10},
            {"title": "Machine learning pipeline", "description": "Build ML pipeline for recommendation system", 
             "storyPoint": 21, "priority": "medium", "task_type": "epic", "attachments_count": 12}
        ]

    def train(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train the model with comprehensive features"""
        try:
            # Combine with enhanced default data
            default_data = self._get_enhanced_training_data()
            combined_data = (training_data if training_data else []) + default_data
            
            # Prepare comprehensive training data
            df = self.preprocessor.prepare_training_data(combined_data)
            
            # Fit TF-IDF on all texts first
            all_texts = [f"{row['title']} {row['description']}" for _, row in df.iterrows()]
            self.preprocessor.fit_tfidf(all_texts)
            
            # Extract features and targets
            features = []
            targets = []
            
            for _, row in df.iterrows():
                feature_vec = self._prepare_features(
                    row['title'], 
                    row['description'], 
                    row.get('priority'), 
                    row.get('attachments_count', 0), 
                    row.get('task_type')
                )
                features.append(feature_vec[0])
                targets.append(row['story_points'])
            #Convert to numpy array
            X, y = np.array(features), np.array(targets)
            
            # Enhanced training with proper validation
            if len(X) >= 100:
                # 3-way split for large datasets
                #X_temp=X_valid + X_test
                X_train, X_temp, y_train, y_temp = train_test_split(
                    X, y, test_size=0.3, random_state=42
                )
                X_val, X_test, y_val, y_test = train_test_split(
                    X_temp, y_temp, test_size=0.5, random_state=42
                )
                
                # Train model
                self.prediction_model.fit(X_train, y_train)
                
                # Comprehensive evaluation
                y_train_pred = self.prediction_model.predict(X_train)
                y_val_pred = self.prediction_model.predict(X_val)
                y_test_pred = self.prediction_model.predict(X_test)
                
                # Map về Fibonacci scale để tính MAE chính xác
                y_train_fib = [self._map_to_fibonacci(p) for p in y_train_pred]
                y_val_fib = [self._map_to_fibonacci(p) for p in y_val_pred]
                y_test_fib = [self._map_to_fibonacci(p) for p in y_test_pred]
                # Tính metrics

                train_mae = mean_absolute_error(y_train, y_train_fib)
                val_mae = mean_absolute_error(y_val, y_val_fib)
                test_mae = mean_absolute_error(y_test, y_test_fib)
                
                train_r2 = r2_score(y_train, y_train_pred) if len(set(y_train)) > 1 else 0
                val_r2 = r2_score(y_val, y_val_pred) if len(set(y_val)) > 1 else 0
                test_r2 = r2_score(y_test, y_test_pred) if len(set(y_test)) > 1 else 0
                
                self.training_stats = {
                    'total_samples': len(X),
                    'train_samples': len(X_train),
                    'val_samples': len(X_val),
                    'test_samples': len(X_test),
                    'train_mae': float(train_mae),
                    'val_mae': float(val_mae),
                    'test_mae': float(test_mae),
                    'train_r2': float(train_r2),
                    'val_r2': float(val_r2),
                    'test_r2': float(test_r2),
                    'mae': float(test_mae),
                    'r2': float(test_r2),
                    'overfitting_check': float(val_mae - train_mae),
                    'split_type': '3-way (70/15/15)',
                    'feature_count': X.shape[1],
                    'model_type': 'RandomForest with comprehensive features'
                }
                
                #OVERFITTING DETECTION & WARNING
                overfitting_gap = val_mae - train_mae
                if overfitting_gap > 0.5:
                    logger.warning(f"⚠️ OVERFITTING DETECTED!")
                    logger.warning(f"   Validation MAE ({val_mae:.3f}) - Train MAE ({train_mae:.3f}) = {overfitting_gap:.3f}")
                    logger.warning(f"   Gap > 0.5 threshold suggests model is memorizing training data")
                    
                    # Add overfitting status to training stats
                    self.training_stats['overfitting_detected'] = True
                    self.training_stats['overfitting_severity'] = 'High' if overfitting_gap > 1.0 else 'Medium'
                    self.training_stats['recommendations'] = [
                        'Increase training data size',
                        'Reduce model complexity (max_depth, n_estimators)',
                        'Add more regularization',
                        'Use feature selection to reduce dimensionality'
                    ]
                elif overfitting_gap > 0.2:
                    logger.info(f"⚠️ Mild overfitting detected (gap: {overfitting_gap:.3f})")
                    self.training_stats['overfitting_detected'] = True
                    self.training_stats['overfitting_severity'] = 'Low'
                else:
                    logger.info(f"✅ Good generalization (gap: {overfitting_gap:.3f})")
                    self.training_stats['overfitting_detected'] = False
                
                logger.info(f"✅ Enhanced model trained with {X.shape[1]} features:")
                logger.info(f"   Train: {len(X_train)} samples, MAE={train_mae:.3f}")
                logger.info(f"   Val:   {len(X_val)} samples, MAE={val_mae:.3f}")
                logger.info(f"   Test:  {len(X_test)} samples, MAE={test_mae:.3f}")
                
                # Handle overfitting if detected
                if overfitting_gap > 0.5:
                    overfitting_result = self._handle_overfitting(X_train, y_train, X_val, y_val, X_test, y_test, overfitting_gap)
                    if overfitting_result and isinstance(overfitting_result, dict) and overfitting_result.get('model_adjusted'):
                        # Update stats with adjusted model results
                        self.training_stats.update({
                            'train_mae': overfitting_result['train_mae'],
                            'val_mae': overfitting_result['val_mae'],
                            'test_mae': overfitting_result['test_mae'],
                            'mae': overfitting_result['test_mae'],
                            'overfitting_check': overfitting_result['overfitting_gap'],
                            'model_adjusted': True,
                            'adjustment_method': 'Reduced complexity (50 trees, max_depth=5)'
                        })
                        logger.info(f"📊 Final stats after adjustment:")
                        logger.info(f"   Train MAE: {overfitting_result['train_mae']:.3f}")
                        logger.info(f"   Val MAE: {overfitting_result['val_mae']:.3f}")
                        logger.info(f"   Test MAE: {overfitting_result['test_mae']:.3f}")
                
            else:
                # Simple training for small datasets
                if len(X) >= 10:
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                else:
                    X_train, X_test, y_train, y_test = X, X, y, y
                
                self.prediction_model.fit(X_train, y_train)
                
                y_pred = self.prediction_model.predict(X_test)
                y_pred_fib = [self._map_to_fibonacci(p) for p in y_pred]
                
                self.training_stats = {
                    'total_samples': len(X),
                    'mae': float(mean_absolute_error(y_test, y_pred_fib)),
                    'r2': float(r2_score(y_test, y_pred)) if len(set(y_test)) > 1 else 0,
                    'feature_count': X.shape[1],
                    'split_type': '2-way (80/20)'
                }
            
            self.is_fitted = True
            self._save_model()
            
            return self.training_stats
            
        except Exception as e:
            logger.error(f"Training error: {e}")
            raise

    def estimate(self, title: str, description: str = "", priority: Optional[str] = None,
                attachments_count: Optional[int] = None, task_type: Optional[str] = None) -> Dict[str, Any]:
        """Estimate story points using comprehensive features"""
        if not self.is_fitted:
            raise ValueError("Model not trained. Please train the model first.")
            
        try:
            features = self._prepare_features(title, description, priority, attachments_count, task_type)
            raw_prediction = self.prediction_model.predict(features)[0]
            story_points = self._map_to_fibonacci(raw_prediction)
            
            # Enhanced confidence calculation
            confidence = 0.7  # Base confidence
            if description and len(description) > 30:
                confidence += 0.1  # More description = higher confidence
            if attachments_count and attachments_count > 0:
                confidence += 0.05  # Attachments provide context
            if priority:
                confidence += 0.05  # Priority provides context
                
            confidence = min(confidence, 0.95)
            
            # Get detailed text analysis
            text_analysis = self.preprocessor.calculate_text_features(title, description)
            
            # Get TF-IDF features
            tfidf_features = self.preprocessor.get_tfidf_features(f"{title} {description}")
            
            # Feature importance for reasoning
            feature_names = self.preprocessor.get_feature_names()
            
            reasoning = f"Estimated {story_points} points based on comprehensive text analysis"
            top_features_info = []
            
            if hasattr(self.prediction_model, 'feature_importances_'):
                top_features = sorted(
                    zip(feature_names[:len(features[0])], self.prediction_model.feature_importances_),
                    key=lambda x: x[1], reverse=True
                )[:5]
                top_features_info = [{"name": f[0], "importance": float(f[1])} for f in top_features]
                reasoning += f". Key factors: {', '.join([f[0] for f in top_features[:3]])}"
            
            # Calculate complexity score
            complexity_score = (
                text_analysis.get('complexity_high', 0) * 3 +
                text_analysis.get('complexity_medium', 0) * 2 +
                text_analysis.get('complexity_low', 0) * 1
            ) / max(1, text_analysis.get('word_count', 1))
            
            # Top TF-IDF terms for this specific task (rare/important words)
            top_tfidf_terms = self._get_top_tfidf_terms(title, description, top_n=5)
            
            return {
                "story_points": story_points,
                "confidence": round(confidence, 2),
                "reasoning": reasoning,
                "features": {
                    "raw_prediction": float(raw_prediction),
                    "feature_count": len(features[0]),
                    "has_description": bool(description),
                    "has_attachments": bool(attachments_count),
                    "has_priority": bool(priority),
                    "has_task_type": bool(task_type),
                    
                    # Detailed text analysis
                    "title_length": text_analysis.get('title_length', 0),
                    "description_length": text_analysis.get('description_length', 0),
                    "word_count": text_analysis.get('word_count', 0),
                    "complexity_score": round(complexity_score, 3),
                    
                    # Complexity keywords
                    "complexity_high": text_analysis.get('complexity_high', 0),
                    "complexity_medium": text_analysis.get('complexity_medium', 0),
                    "complexity_low": text_analysis.get('complexity_low', 0),
                    
                    # Effort keywords
                    "effort_high": text_analysis.get('effort_high_effort', 0),
                    "effort_medium": text_analysis.get('effort_medium_effort', 0),
                    "effort_low": text_analysis.get('effort_low_effort', 0),
                    
                    # Technical indicators
                    "has_ui_words": text_analysis.get('has_ui_words', 0),
                    "has_backend_words": text_analysis.get('has_backend_words', 0),
                    "has_integration_words": text_analysis.get('has_integration_words', 0),
                    "has_testing_words": text_analysis.get('has_testing_words', 0),
                    
                    # Readability metrics
                    "flesch_reading_ease": round(text_analysis.get('flesch_reading_ease', 0), 2),
                    "flesch_kincaid_grade": round(text_analysis.get('flesch_kincaid_grade', 0), 2),
                    
                    # TF-IDF info
                    "tfidf_feature_count": len(tfidf_features) if len(tfidf_features) > 0 else 0,
                    "tfidf_max_score": float(np.max(tfidf_features)) if len(tfidf_features) > 0 else 0,
                    "tfidf_mean_score": float(np.mean(tfidf_features)) if len(tfidf_features) > 0 else 0,
                    
                    # Top features
                    "top_features": top_features_info,
                    
                    # Top TF-IDF terms for this specific task (rare/important words)
                    "top_tfidf_terms": top_tfidf_terms,
                    
                    # Metadata
                    "priority_encoded": self.preprocessor._encode_priority(priority) if priority else 2,
                    "attachments_count": attachments_count or 0
                }
            }
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            raise

    def is_trained(self) -> bool:
        """Check if model is trained"""
        return self.is_fitted

    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "is_trained": self.is_fitted, 
            "training_stats": self.training_stats,
            "model_type": "RandomForest with comprehensive TextPreprocessor features"
        }

    def _save_model(self):
        """Save trained model and preprocessor"""
        try:
            model_data = {
                'prediction_model': self.prediction_model,
                'preprocessor': self.preprocessor,
                'training_stats': self.training_stats,
                'is_fitted': self.is_fitted,
                'version': '2.0'  # Updated version
            }
            joblib.dump(model_data, os.path.join(self.model_path, 'story_point_model.pkl'))
            logger.info("✅ Model saved successfully")
        except Exception as e:
            logger.error(f"Save error: {e}")

    def _load_model(self):
        """Load trained model and preprocessor"""
        try:
            model_file = os.path.join(self.model_path, 'story_point_model.pkl')
            if os.path.exists(model_file):
                model_data = joblib.load(model_file)
                self.prediction_model = model_data['prediction_model']
                self.preprocessor = model_data['preprocessor']
                self.training_stats = model_data['training_stats']
                self.is_fitted = model_data['is_fitted']
                logger.info("✅ Model loaded successfully")
            else:
                logger.info("⚠️ No pre-trained model found")
        except Exception as e:
            logger.error(f"Load error: {e}")
            self.is_fitted = False 

    def _get_top_tfidf_terms(self, title: str, description: str, top_n: int = 5):
        """Return top n terms with highest TF-IDF scores for the given text"""
        try:
            if self.preprocessor.tfidf_vectorizer is None:
                return []
            vector = self.preprocessor.tfidf_vectorizer.transform([f"{title} {description}"])
            scores = vector.toarray()[0]
            if scores.sum() == 0:
                return []
            feature_names = self.preprocessor.tfidf_vectorizer.get_feature_names_out()
            top_indices = scores.argsort()[::-1][:top_n]
            top_terms = [
                {"term": feature_names[i], "score": float(scores[i])}
                for i in top_indices if scores[i] > 0
            ]
            return top_terms
        except Exception:
            return []
            
