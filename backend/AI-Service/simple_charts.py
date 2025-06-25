#!/usr/bin/env python3
"""
Simple Model Performance Charts
Quick visualization of AI model performance
"""

import matplotlib.pyplot as plt
import numpy as np
from models.story_point_estimator import StoryPointEstimator

def create_performance_charts():
    """Create simple performance charts"""
    
    print("📊 Creating AI Model Performance Charts...")
    
    # Train model and get results
    estimator = StoryPointEstimator()
    result = estimator.train([])
    training_data = estimator._get_enhanced_training_data()
    
    # Create figure with 2x2 subplots
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('AI Story Point Estimation Model - Performance Report', 
                 fontsize=16, fontweight='bold')
    
    # Add some space between title and plots
    plt.subplots_adjust(top=0.92)
    
    # 1. Performance Metrics Bar Chart
    metrics = ['MAE', 'R² Score', 'Accuracy']
    mae = result.get('mae', 0)
    r2 = result.get('r2', 0)
    accuracy = max(0, 1 - mae/2)  # Derived accuracy score
    values = [mae, r2, accuracy]
    colors = ['#ff6b6b', '#4ecdc4', '#45b7d1']
    
    bars1 = ax1.bar(metrics, values, color=colors, alpha=0.8, edgecolor='black', linewidth=1)
    ax1.set_title('📈 Model Performance Metrics', fontweight='bold', fontsize=12)
    ax1.set_ylabel('Score', fontweight='bold')
    ax1.set_ylim(0, 1)
    ax1.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bar, value in zip(bars1, values):
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height + 0.02,
                f'{value:.3f}', ha='center', va='bottom', fontweight='bold', fontsize=10)
    
    # Add target line for MAE
    ax1.axhline(y=1.0, color='red', linestyle='--', alpha=0.7, label='Target MAE ≤ 1.0')
    ax1.legend()
    
    # 2. Training Data Distribution
    story_points = [task['storyPoint'] for task in training_data]
    unique_points = sorted(set(story_points))
    counts = [story_points.count(p) for p in unique_points]
    
    bars2 = ax2.bar(unique_points, counts, color='#96ceb4', alpha=0.8, 
                    edgecolor='#5a9b7a', linewidth=1)
    ax2.set_title('📊 Training Data Distribution', fontweight='bold', fontsize=12)
    ax2.set_xlabel('Story Points (Fibonacci Scale)', fontweight='bold')
    ax2.set_ylabel('Number of Tasks', fontweight='bold')
    ax2.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bar, count in zip(bars2, counts):
        height = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., height + 0.05,
                str(count), ha='center', va='bottom', fontweight='bold')
    
    # Add total samples annotation
    total_samples = len(training_data)
    ax2.text(0.02, 0.98, f'Total: {total_samples} samples', transform=ax2.transAxes,
             fontsize=10, fontweight='bold', va='top',
             bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow"))
    
    # 3. Model vs Target Performance
    categories = ['Our Model', 'Target Goal', 'Baseline']
    mae_values = [mae, 1.0, 1.5]
    colors3 = ['#4ecdc4', '#feca57', '#ff6b6b']
    
    bars3 = ax3.bar(categories, mae_values, color=colors3, alpha=0.8, 
                    edgecolor='black', linewidth=1)
    ax3.set_title('🎯 Performance Comparison', fontweight='bold', fontsize=12)
    ax3.set_ylabel('Mean Absolute Error (MAE)', fontweight='bold')
    ax3.grid(True, alpha=0.3, axis='y')
    
    # Add value labels
    for bar, value in zip(bars3, mae_values):
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width()/2., height + 0.02,
                f'{value:.2f}', ha='center', va='bottom', fontweight='bold')
    
    # Add achievement status
    if mae <= 1.0:
        status_text = "🎉 TARGET ACHIEVED!"
        status_color = "lightgreen"
    else:
        status_text = "📈 Good Progress"
        status_color = "lightyellow"
    
    ax3.text(0.5, 0.85, status_text, transform=ax3.transAxes, ha='center',
             fontsize=12, fontweight='bold',
             bbox=dict(boxstyle="round,pad=0.5", facecolor=status_color))
    
    # 4. Model Summary & Status
    ax4.axis('off')
    
    # Calculate performance rating
    if mae <= 1.0:
        rating = "EXCELLENT ⭐⭐⭐"
        rating_color = "#2ecc71"
    elif mae <= 1.5:
        rating = "GOOD ⭐⭐"
        rating_color = "#f39c12"
    else:
        rating = "FAIR ⭐"
        rating_color = "#e74c3c"
    
    # Create summary text
    summary_text = f"""
🤖 AI MODEL SUMMARY
══════════════════════

📋 Algorithm: Random Forest Regressor
🔧 Features: 120 (Text + TF-IDF + Metadata)
📊 Training Samples: {len(training_data)}

📈 PERFORMANCE METRICS:
━━━━━━━━━━━━━━━━━━━━━━━━━
• MAE: {mae:.3f} story points
• R² Score: {r2:.3f} ({r2*100:.1f}% variance explained)
• Overfitting Gap: {result.get('overfitting_check', 0):.3f}

🎯 RATING: {rating}

✅ Production Ready: {'YES' if mae <= 1.5 else 'NEEDS IMPROVEMENT'}
✅ Academic Standard: {'EXCELLENT' if mae <= 1.0 else 'GOOD'}

🔍 MODEL HEALTH:
{'🟢 Healthy (No Overfitting)' if result.get('overfitting_check', 0) <= 0.5 else '🟡 Mild Overfitting'}
    """
    
    ax4.text(0.05, 0.95, summary_text, transform=ax4.transAxes, fontsize=11,
             verticalalignment='top', fontfamily='monospace',
             bbox=dict(boxstyle="round,pad=0.8", facecolor="lightblue", alpha=0.8))
    
    # Add rating color indicator
    ax4.add_patch(plt.Rectangle((0.7, 0.4), 0.25, 0.15, transform=ax4.transAxes,
                               facecolor=rating_color, alpha=0.3, 
                               edgecolor=rating_color, linewidth=3))
    
    plt.tight_layout()
    
    # Save the chart
    chart_path = 'ai_model_performance.png'
    plt.savefig(chart_path, dpi=300, bbox_inches='tight', facecolor='white', 
                edgecolor='none', transparent=False)
    
    print(f"✅ Performance chart saved to: {chart_path}")
    print(f"📊 Model Performance Summary:")
    print(f"   • MAE: {mae:.3f} (Target: ≤1.0)")
    print(f"   • R²: {r2:.3f}")
    print(f"   • Rating: {rating}")
    print(f"   • Status: {'✅ Production Ready' if mae <= 1.5 else '⚠️ Needs Improvement'}")
    
    # Try to show the plot (may not work in all environments)
    try:
        plt.show()
    except:
        print("ℹ️  Chart saved but cannot display (no GUI available)")
    
    return chart_path

if __name__ == "__main__":
    create_performance_charts() 