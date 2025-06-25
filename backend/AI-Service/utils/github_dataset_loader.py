import requests
import json
import os
import logging
import pandas as pd
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class GitHubDatasetLoader:
    """Load training datasets from GitHub repositories"""
    
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
    
    def load_from_github(self, github_url: str, file_path: str = None) -> List[Dict[str, Any]]:
        """Load dataset from GitHub repository"""
        try:
            raw_url = self._convert_to_raw_url(github_url, file_path)
            cache_filename = self._generate_cache_filename(raw_url)
            cache_path = os.path.join(self.cache_dir, cache_filename)
            
            # Load from cache if exists
            if os.path.exists(cache_path):
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            
            # Download from GitHub
            response = requests.get(raw_url, timeout=30)
            response.raise_for_status()
            
            # Parse data
            if raw_url.endswith('.json'):
                data = response.json()
                tasks = data['tasks'] if isinstance(data, dict) and 'tasks' in data else data
            else:
                # Parse as CSV
                from io import StringIO
                df = pd.read_csv(StringIO(response.text))
                tasks = self._convert_csv_to_tasks(df)
            
            # Validate and cache
            validated_tasks = self._validate_dataset(tasks)
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(validated_tasks, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Loaded {len(validated_tasks)} tasks from GitHub")
            return validated_tasks
            
        except Exception as e:
            logger.error(f"Error loading dataset: {e}")
            raise
    
    def clear_cache(self):
        """Clear cached datasets"""
        try:
            for filename in os.listdir(self.cache_dir):
                if filename.startswith('github_dataset_'):
                    os.remove(os.path.join(self.cache_dir, filename))
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
    
    def _convert_csv_to_tasks(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convert CSV DataFrame to tasks list"""
        tasks = []
        
        # Find column mappings
        title_cols = ['title', 'Title', 'summary', 'user_story']
        desc_cols = ['description', 'Description', 'user_story', 'acceptance_criteria']
        point_cols = ['storyPoint', 'story_point', 'story_points', 'points', 'point', 'sp']
        
        title_col = next((col for col in title_cols if col in df.columns), df.columns[0])
        desc_col = next((col for col in desc_cols if col in df.columns), 
                       'user_story' if 'user_story' in df.columns else df.columns[1] if len(df.columns) > 1 else title_col)
        point_col = next((col for col in point_cols if col in df.columns), None)
        
        for _, row in df.iterrows():
            try:
                # Get story points
                if point_col:
                    story_point = row[point_col]
                else:
                    numeric_cols = df.select_dtypes(include=['number']).columns
                    if len(numeric_cols) > 0:
                        story_point = row[numeric_cols[0]]
                    else:
                        continue
                
                if pd.isna(story_point):
                    continue
                
                raw_point = float(story_point)
                standardized_point = max(1, min(100, int(round(raw_point))))
                
                task = {
                    'title': str(row[title_col]).strip(),
                    'description': str(row[desc_col]).strip(),
                    'storyPoint': standardized_point
                }
                
                # Add optional fields
                if 'project' in df.columns:
                    task['project'] = str(row['project']).strip()
                if 'concat' in df.columns:
                    task['full_text'] = str(row['concat']).strip()
                
                if task['title'] and task['description']:
                    tasks.append(task)
                    
            except Exception:
                continue
        
        return tasks
    
    def _convert_to_raw_url(self, github_url: str, file_path: str = None) -> str:
        """Convert GitHub URL to raw file URL"""
        if 'raw.githubusercontent.com' in github_url:
            return github_url
        
        if 'github.com' in github_url:
            parts = github_url.replace('https://github.com/', '').split('/')
            if len(parts) >= 2:
                owner, repo = parts[0], parts[1]
                
                if not file_path:
                    # Try common dataset files
                    common_files = [
                        'data_csv/data', 'data.csv', 'dataset.csv', 'training_data.json',
                        'enhanced_training_data.json', 'dataset.json', 'tasks.json'
                    ]
                    
                    for branch in ['main', 'master']:
                        for filename in common_files:
                            test_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{filename}"
                            try:
                                if requests.head(test_url, timeout=10).status_code == 200:
                                    return test_url
                            except:
                                continue
                    
                    raise ValueError("Could not find dataset file")
                else:
                    # Try specified file_path
                    for branch in ['main', 'master']:
                        test_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"
                        try:
                            if requests.head(test_url, timeout=10).status_code == 200:
                                return test_url
                        except:
                            continue
                    return f"https://raw.githubusercontent.com/{owner}/{repo}/main/{file_path}"
        
        raise ValueError(f"Invalid GitHub URL: {github_url}")
    
    def _generate_cache_filename(self, url: str) -> str:
        """Generate cache filename from URL"""
        import hashlib
        return f"github_dataset_{hashlib.md5(url.encode()).hexdigest()[:8]}.json"
    
    def _validate_dataset(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate and clean dataset"""
        validated_tasks = []
        
        for task in tasks:
            try:
                if not task.get('title') or not task.get('description'):
                    continue
                
                story_point = task.get('storyPoint', task.get('story_points', 0))
                
                # Accept story points 1-100
                if isinstance(story_point, (int, float)) and 1 <= story_point <= 100:
                    normalized_task = {
                        'title': str(task['title']).strip(),
                        'description': str(task['description']).strip(),
                        'storyPoint': int(round(story_point))
                    }
                    
                    # Add optional fields
                    for field in ['complexity', 'priority', 'project', 'full_text']:
                        if field in task:
                            normalized_task[field] = task[field]
                    
                    validated_tasks.append(normalized_task)
                    
            except Exception:
                continue
        
        return validated_tasks


def load_github_dataset(github_url: str, file_path: str = None) -> List[Dict[str, Any]]:
    """Quick function to load dataset from GitHub"""
    loader = GitHubDatasetLoader()
    return loader.load_from_github(github_url, file_path) 