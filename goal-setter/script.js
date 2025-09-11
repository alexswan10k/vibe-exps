// Goal Setter Application with React
const { useState, useEffect } = React;

function GoalSetter() {
    // Initialize goals with corrected parent progress
    const initializeGoals = () => {
        const storedGoals = JSON.parse(localStorage.getItem('goals')) || [];

        // Build temporary hierarchy to calculate parent progress
        const tempHierarchy = {};
        storedGoals.forEach(goal => {
            if (!goal.parentId) {
                if (!tempHierarchy['root']) {
                    tempHierarchy['root'] = [];
                }
                tempHierarchy['root'].push(goal.id);
            } else {
                if (!tempHierarchy[goal.parentId]) {
                    tempHierarchy[goal.parentId] = [];
                }
                tempHierarchy[goal.parentId].push(goal.id);
            }
        });

        // Calculate correct progress for all parent goals
        const correctedGoals = storedGoals.map(goal => {
            // Only recalculate progress for goals that have children
            if (tempHierarchy[goal.id] && tempHierarchy[goal.id].length > 0) {
                const childIds = tempHierarchy[goal.id];
                let totalProgress = 0;
                childIds.forEach(childId => {
                    const child = storedGoals.find(g => g.id === childId);
                    if (child) {
                        totalProgress += child.progress;
                    }
                });
                const averageProgress = totalProgress / childIds.length;
                return {
                    ...goal,
                    progress: averageProgress,
                    completed: averageProgress === 100,
                    isAutoCalculated: true
                };
            }
            return goal;
        });

        return correctedGoals;
    };

    const [goals, setGoals] = useState(initializeGoals);
    const [goalHierarchy, setGoalHierarchy] = useState({});
    const [showEditModal, setShowEditModal] = useState(false);
    const [showInlineAddModal, setShowInlineAddModal] = useState(false);
    const [currentEditGoal, setCurrentEditGoal] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editProgress, setEditProgress] = useState(0);
    const [inlineSubgoalTitle, setInlineSubgoalTitle] = useState('');
    const [currentParentId, setCurrentParentId] = useState(null);
    const [editingGoalId, setEditingGoalId] = useState(null);
    const [showAddTopLevelModal, setShowAddTopLevelModal] = useState(false);
    const [topLevelGoalTitle, setTopLevelGoalTitle] = useState('');
    const [showCompletedGoals, setShowCompletedGoals] = useState(true);
    const topLevelInputRef = React.useRef(null);
    const subGoalInputRef = React.useRef(null);

    // Build hierarchy whenever goals change
    useEffect(() => {
        const hierarchy = {};
        goals.forEach(goal => {
            if (!goal.parentId) {
                if (!hierarchy['root']) {
                    hierarchy['root'] = [];
                }
                hierarchy['root'].push(goal.id);
            } else {
                if (!hierarchy[goal.parentId]) {
                    hierarchy[goal.parentId] = [];
                }
                hierarchy[goal.parentId].push(goal.id);
            }
        });
        setGoalHierarchy(hierarchy);
    }, [goals]);

    // Save goals to localStorage whenever goals change
    useEffect(() => {
        localStorage.setItem('goals', JSON.stringify(goals));
    }, [goals]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showEditModal) {
                    setShowEditModal(false);
                } else if (showInlineAddModal) {
                    setShowInlineAddModal(false);
                } else if (showAddTopLevelModal) {
                    setShowAddTopLevelModal(false);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showEditModal, showInlineAddModal, showAddTopLevelModal]);

    // Focus management for modals
    useEffect(() => {
        if (showInlineAddModal && subGoalInputRef.current) {
            setTimeout(() => subGoalInputRef.current.focus(), 100);
        }
    }, [showInlineAddModal]);

    useEffect(() => {
        if (showAddTopLevelModal && topLevelInputRef.current) {
            setTimeout(() => topLevelInputRef.current.focus(), 100);
        }
    }, [showAddTopLevelModal]);

    // Helper functions
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const showNotification = (message, type = 'info') => {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '10000',
            animation: 'slideInRight 0.3s ease-out',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'info':
                notification.style.backgroundColor = '#2196F3';
                break;
            default:
                notification.style.backgroundColor = '#333';
        }

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    };

    // Event handlers
    const handleAddTopLevelGoal = () => {
        if (!topLevelGoalTitle.trim()) return;

        const newGoal = {
            id: Date.now(),
            title: topLevelGoalTitle.trim(),
            parentId: null,
            progress: 0,
            completed: false,
            isAutoCalculated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setGoals(prevGoals => [...prevGoals, newGoal]);
        setTopLevelGoalTitle('');
        setShowAddTopLevelModal(false);
        showNotification('Goal added successfully!', 'success');
    };

    const handleGoalAction = (action, goalId) => {
        switch (action) {
            case 'complete':
                handleCompleteGoal(goalId);
                break;
            case 'edit':
                handleOpenEditModal(goalId);
                break;
            case 'delete':
                handleDeleteGoal(goalId);
                break;
            case 'add-subgoal':
                handleOpenInlineAddModal(goalId);
                break;
        }
    };

    const handleCompleteGoal = (goalId) => {
        setGoals(prevGoals => {
            const updatedGoals = prevGoals.map(goal =>
                goal.id === goalId
                    ? { ...goal, completed: true, progress: 100, updatedAt: new Date().toISOString() }
                    : goal
            );

            // Find the updated goal to get its parentId
            const updatedGoal = updatedGoals.find(g => g.id === goalId);
            if (updatedGoal && updatedGoal.parentId) {
                return updateParentProgress(updatedGoal.parentId, updatedGoals);
            }

            return updatedGoals;
        });
        showNotification('Goal completed! 🎉', 'success');
    };

    const handleOpenEditModal = (goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        setCurrentEditGoal(goal);
        setEditTitle(goal.title);
        setEditProgress(Math.round(goal.progress));
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (!currentEditGoal || !editTitle.trim()) {
            showNotification('Goal title cannot be empty', 'error');
            return;
        }

        setGoals(prevGoals => {
            const updatedGoals = prevGoals.map(goal =>
                goal.id === currentEditGoal.id
                    ? {
                        ...goal,
                        title: editTitle.trim(),
                        progress: Math.max(0, Math.min(100, editProgress)),
                        completed: Math.max(0, Math.min(100, editProgress)) === 100,
                        updatedAt: new Date().toISOString()
                    }
                    : goal
            );

            // Find the updated goal to get its parentId
            const updatedGoal = updatedGoals.find(g => g.id === currentEditGoal.id);
            if (updatedGoal && updatedGoal.parentId) {
                return updateParentProgress(updatedGoal.parentId, updatedGoals);
            }

            return updatedGoals;
        });

        setShowEditModal(false);
        setCurrentEditGoal(null);
        showNotification('Goal updated successfully!', 'success');
    };

    const handleDeleteGoal = (goalId) => {
        if (!confirm('Are you sure you want to delete this goal and all its sub-goals?')) return;

        const deleteGoalTree = (id) => {
            const children = goalHierarchy[id] || [];
            children.forEach(childId => deleteGoalTree(childId));
            return [id, ...children.flatMap(childId => deleteGoalTree(childId))];
        };

        const goalsToDelete = deleteGoalTree(goalId);
        setGoals(prevGoals => prevGoals.filter(goal => !goalsToDelete.includes(goal.id)));
        showNotification('Goal deleted', 'info');
    };

    const handleOpenInlineAddModal = (parentId) => {
        setCurrentParentId(parentId);
        setInlineSubgoalTitle('');
        setShowInlineAddModal(true);
    };

    const handleAddInlineSubgoal = () => {
        if (!inlineSubgoalTitle.trim() || !currentParentId) return;

        const newGoal = {
            id: Date.now(),
            title: inlineSubgoalTitle.trim(),
            parentId: currentParentId,
            progress: 0,
            completed: false,
            isAutoCalculated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setGoals(prevGoals => [...prevGoals, newGoal]);
        setShowInlineAddModal(false);
        setCurrentParentId(null);
        setInlineSubgoalTitle('');
        showNotification('Sub-goal added successfully!', 'success');
    };

    const handleStartInlineEdit = (goalId) => {
        setEditingGoalId(goalId);
    };

    const handleSaveInlineEdit = (goalId, newTitle) => {
        if (!newTitle.trim()) {
            setEditingGoalId(null);
            return;
        }

        setGoals(prevGoals =>
            prevGoals.map(goal =>
                goal.id === goalId
                    ? { ...goal, title: newTitle.trim(), updatedAt: new Date().toISOString() }
                    : goal
            )
        );

        setEditingGoalId(null);
        showNotification('Goal title updated!', 'success');
    };

    const updateParentProgress = (parentId, currentGoals) => {
        if (!parentId) return currentGoals;

        const parentIndex = currentGoals.findIndex(g => g.id === parentId);
        if (parentIndex === -1) return currentGoals;

        const childIds = goalHierarchy[parentId] || [];
        if (childIds.length === 0) return currentGoals;

        // Calculate average progress of all children
        let totalProgress = 0;
        childIds.forEach(childId => {
            const child = currentGoals.find(g => g.id === childId);
            if (child) {
                totalProgress += child.progress;
            }
        });

        const averageProgress = totalProgress / childIds.length;
        const updatedGoals = currentGoals.map(goal =>
            goal.id === parentId
                ? {
                    ...goal,
                    progress: averageProgress,
                    completed: averageProgress === 100,
                    isAutoCalculated: true,
                    updatedAt: new Date().toISOString()
                }
                : goal
        );

        // Recursively update grandparent
        const updatedParent = updatedGoals.find(g => g.id === parentId);
        if (updatedParent && updatedParent.parentId) {
            return updateParentProgress(updatedParent.parentId, updatedGoals);
        }

        return updatedGoals;
    };

    const handleUpdateProgress = (goalId, progress) => {
        setGoals(prevGoals => {
            const updatedGoals = prevGoals.map(goal =>
                goal.id === goalId
                    ? {
                        ...goal,
                        progress: progress,
                        completed: progress === 100,
                        updatedAt: new Date().toISOString()
                    }
                    : goal
            );

            // Find the updated goal to get its parentId
            const updatedGoal = updatedGoals.find(g => g.id === goalId);
            if (updatedGoal && updatedGoal.parentId) {
                return updateParentProgress(updatedGoal.parentId, updatedGoals);
            }

            return updatedGoals;
        });
    };

    const handleToggleCompletedGoals = () => {
        setShowCompletedGoals(prev => !prev);
    };

    const handleDeleteAllCompleted = () => {
        const completedGoals = goals.filter(goal => goal.completed);
        if (completedGoals.length === 0) {
            showNotification('No completed goals to delete', 'info');
            return;
        }

        if (!confirm(`Are you sure you want to delete all ${completedGoals.length} completed goals?`)) return;

        const completedIds = completedGoals.map(goal => goal.id);
        setGoals(prevGoals => prevGoals.filter(goal => !completedIds.includes(goal.id)));
        showNotification(`Deleted ${completedGoals.length} completed goals`, 'info');
    };

    // Calculate stats
    const totalGoals = goals.length;
    const completedGoals = goals.filter(goal => goal.completed).length;

    // Render functions using React.createElement
    const renderGoalTree = (parentId, level) => {
        const childIds = goalHierarchy[parentId] || [];

        return childIds.map(childId => {
            const goal = goals.find(g => g.id === childId);
            if (!goal) return null;

            // Filter out completed goals if showCompletedGoals is false
            if (!showCompletedGoals && goal.completed) return null;

            return renderGoalElement(goal, level);
        });
    };

    const renderGoalElement = (goal, level) => {
        const createdDate = new Date(goal.createdAt).toLocaleDateString();
        const updatedDate = new Date(goal.updatedAt).toLocaleDateString();
        const hasChildren = goalHierarchy[goal.id] && goalHierarchy[goal.id].length > 0;

        return React.createElement('div', {
            className: `goal-item ${goal.completed ? 'completed' : ''}`,
            key: goal.id,
            style: { marginLeft: `${level * 30}px` }
        },
            // Goal header
            React.createElement('div', { className: 'goal-header' },
                // Goal title (clickable for inline edit)
                editingGoalId === goal.id
                    ? React.createElement('input', {
                        type: 'text',
                        defaultValue: goal.title,
                        className: 'inline-edit-input',
                        style: {
                            width: '100%',
                            padding: '4px 8px',
                            border: '2px solid #4facfe',
                            borderRadius: '4px',
                            fontSize: '1.1em',
                            fontWeight: '600'
                        },
                        autoFocus: true,
                        onBlur: (e) => handleSaveInlineEdit(goal.id, e.target.value),
                        onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                handleSaveInlineEdit(goal.id, e.target.value);
                            } else if (e.key === 'Escape') {
                                setEditingGoalId(null);
                            }
                        }
                    })
                    : React.createElement('div', {
                        className: `goal-title ${goal.completed ? 'completed' : ''}`,
                        style: {
                            paddingLeft: level > 0 ? '20px' : '0',
                            cursor: 'pointer'
                        },
                        onClick: () => handleStartInlineEdit(goal.id)
                    },
                        level > 0 ? '↳ ' : '',
                        escapeHtml(goal.title),
                        hasChildren ? ' 📁' : ' 📄'
                    ),

                // Goal actions
                React.createElement('div', { className: 'goal-actions' },
                    React.createElement('button', {
                        className: 'goal-btn add-subgoal',
                        title: 'Add Sub-goal',
                        onClick: (e) => {
                            e.stopPropagation();
                            handleGoalAction('add-subgoal', goal.id);
                        }
                    }, '➕'),

                    !goal.completed && !hasChildren && React.createElement('button', {
                        className: 'goal-btn complete',
                        onClick: (e) => {
                            e.stopPropagation();
                            handleGoalAction('complete', goal.id);
                        }
                    }, 'Complete'),

                    React.createElement('button', {
                        className: 'goal-btn edit',
                        onClick: (e) => {
                            e.stopPropagation();
                            handleGoalAction('edit', goal.id);
                        }
                    }, 'Edit'),

                    React.createElement('button', {
                        className: 'goal-btn delete',
                        onClick: (e) => {
                            e.stopPropagation();
                            handleGoalAction('delete', goal.id);
                        }
                    }, 'Delete')
                )
            ),

            // Progress container
            React.createElement('div', { className: 'progress-container' },
                React.createElement('div', { className: 'progress-label' },
                    React.createElement('span', null, `Progress ${goal.isAutoCalculated ? '(Auto)' : '(Manual)'}`),
                    React.createElement('span', { className: 'progress-text' }, `${Math.round(goal.progress)}%`)
                ),
                React.createElement('div', { className: 'progress-bar' },
                    React.createElement('div', {
                        className: 'progress-fill',
                        style: { width: `${goal.progress}%` }
                    })
                ),
                !hasChildren && !goal.isAutoCalculated && React.createElement('div', { className: 'progress-controls-row' },
                    React.createElement('input', {
                        type: 'range',
                        className: 'progress-slider',
                        min: '0',
                        max: '100',
                        value: Math.round(goal.progress),
                        onInput: (e) => handleUpdateProgress(goal.id, parseInt(e.target.value))
                    }),
                    React.createElement('button', {
                        className: 'complete-btn-small',
                        onClick: () => handleUpdateProgress(goal.id, 100),
                        title: 'Mark as Complete'
                    }, '✓')
                )
            ),

            // Goal metadata
            React.createElement('div', { className: 'goal-meta' },
                React.createElement('span', { className: 'goal-date' }, `Created: ${createdDate}`),
                updatedDate !== createdDate && React.createElement('span', { className: 'goal-date' }, `Updated: ${updatedDate}`)
            ),

            // Render children recursively
            renderGoalTree(goal.id, level + 1)
        );
    };

    return React.createElement('div', { className: 'container' },
        // Header
        React.createElement('header', null,
            React.createElement('h1', null, '🎯 Goal Setter'),
            React.createElement('p', null, 'Track your personal goals and celebrate your progress!')
        ),

        // Goals section
        React.createElement('div', { className: 'goals-section' },
            React.createElement('div', { className: 'section-header' },
                React.createElement('h2', null, 'Your Goals'),
                React.createElement('div', { className: 'section-controls' },
                    React.createElement('div', { className: 'stats' },
                        React.createElement('span', { id: 'total-goals' }, totalGoals), ' goals • ',
                        React.createElement('span', { id: 'completed-goals' }, completedGoals), ' completed'
                    ),
                    React.createElement('div', { className: 'goal-controls' },
                        React.createElement('button', {
                            className: 'control-btn toggle-completed',
                            onClick: handleToggleCompletedGoals,
                            title: showCompletedGoals ? 'Hide completed goals' : 'Show completed goals'
                        }, showCompletedGoals ? '👁️ Hide Completed' : '👁️ Show Completed'),
                        completedGoals > 0 && React.createElement('button', {
                            className: 'control-btn delete-completed',
                            onClick: handleDeleteAllCompleted,
                            title: 'Delete all completed goals'
                        }, '🗑️ Delete All Completed')
                    )
                )
            ),

            React.createElement('div', { id: 'goals-list', className: 'goals-list' },
                goals.length === 0
                    ? React.createElement('div', { className: 'empty-state' },
                        React.createElement('h3', null, 'No goals yet'),
                        React.createElement('p', null, 'Click the + button below to add your first goal!'),
                        React.createElement('button', {
                            className: 'add-top-level-btn',
                            onClick: () => setShowAddTopLevelModal(true)
                        }, '➕ Add Your First Goal')
                    )
                    : React.createElement(React.Fragment, null,
                        renderGoalTree('root', 0),
                        // Add goal button at bottom
                        React.createElement('div', { className: 'add-goal-footer' },
                            React.createElement('button', {
                                className: 'add-top-level-btn',
                                onClick: () => setShowAddTopLevelModal(true)
                            }, '➕ Add New Goal')
                        )
                    )
            )
        ),

        // Motivation section
        React.createElement('div', { className: 'motivation-section' },
            React.createElement('h3', null, '💪 Keep Going!'),
            React.createElement('p', null, '"The journey of a thousand miles begins with a single step." - Lao Tzu')
        ),

        // Edit Modal
        React.createElement('div', {
            id: 'edit-modal',
            className: `modal ${showEditModal ? 'show' : ''}`,
            onClick: (e) => {
                if (e.target.id === 'edit-modal') setShowEditModal(false);
            }
        },
            React.createElement('div', { className: 'modal-content' },
                React.createElement('div', { className: 'modal-header' },
                    React.createElement('h3', null, 'Edit Goal'),
                    React.createElement('span', {
                        className: 'close-modal',
                        onClick: () => setShowEditModal(false)
                    }, '×')
                ),
                React.createElement('div', { className: 'modal-body' },
                    React.createElement('input', {
                        type: 'text',
                        id: 'edit-goal-title',
                        placeholder: 'Goal title',
                        value: editTitle,
                        onChange: (e) => setEditTitle(e.target.value)
                    }),
                    React.createElement('div', { className: 'progress-controls' },
                        React.createElement('label', { htmlFor: 'edit-progress' }, 'Progress:'),
                        React.createElement('input', {
                            type: 'number',
                            id: 'edit-progress',
                            min: '0',
                            max: '100',
                            value: editProgress,
                            onChange: (e) => setEditProgress(parseInt(e.target.value) || 0)
                        }),
                        React.createElement('span', null, '%')
                    ),
                    React.createElement('div', { className: 'modal-actions' },
                        React.createElement('button', { id: 'save-edit-btn', onClick: handleSaveEdit }, 'Save Changes'),
                        React.createElement('button', { id: 'cancel-edit-btn', onClick: () => setShowEditModal(false) }, 'Cancel')
                    )
                )
            )
        ),

        // Inline Add Sub-goal Modal
        React.createElement('div', {
            id: 'inline-add-modal',
            className: `modal ${showInlineAddModal ? 'show' : ''}`,
            onClick: (e) => {
                if (e.target.id === 'inline-add-modal') setShowInlineAddModal(false);
            }
        },
            React.createElement('div', { className: 'modal-content small-modal' },
                React.createElement('div', { className: 'modal-header' },
                    React.createElement('h3', null, 'Add Sub-goal'),
                    React.createElement('span', {
                        className: 'close-modal',
                        id: 'close-inline-add',
                        onClick: () => setShowInlineAddModal(false)
                    }, '×')
                ),
                React.createElement('div', { className: 'modal-body' },
                    React.createElement('input', {
                        type: 'text',
                        id: 'inline-subgoal-title',
                        placeholder: 'Enter sub-goal title...',
                        value: inlineSubgoalTitle,
                        onChange: (e) => setInlineSubgoalTitle(e.target.value),
                        onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                handleAddInlineSubgoal();
                            }
                        },
                        required: true,
                        ref: subGoalInputRef
                    }),
                    React.createElement('div', { className: 'modal-actions' },
                        React.createElement('button', { id: 'add-inline-subgoal-btn', onClick: handleAddInlineSubgoal }, 'Add Sub-goal'),
                        React.createElement('button', { id: 'cancel-inline-add-btn', onClick: () => setShowInlineAddModal(false) }, 'Cancel')
                    )
                )
            )
        ),

        // Add Top-Level Goal Modal
        React.createElement('div', {
            id: 'add-top-level-modal',
            className: `modal ${showAddTopLevelModal ? 'show' : ''}`,
            onClick: (e) => {
                if (e.target.id === 'add-top-level-modal') setShowAddTopLevelModal(false);
            }
        },
            React.createElement('div', { className: 'modal-content small-modal' },
                React.createElement('div', { className: 'modal-header' },
                    React.createElement('h3', null, 'Add New Goal'),
                    React.createElement('span', {
                        className: 'close-modal',
                        onClick: () => setShowAddTopLevelModal(false)
                    }, '×')
                ),
                React.createElement('div', { className: 'modal-body' },
                    React.createElement('input', {
                        type: 'text',
                        id: 'top-level-goal-title',
                        placeholder: 'Enter goal title...',
                        value: topLevelGoalTitle,
                        onChange: (e) => setTopLevelGoalTitle(e.target.value),
                        onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                handleAddTopLevelGoal();
                            }
                        },
                        required: true,
                        ref: topLevelInputRef
                    }),
                    React.createElement('div', { className: 'modal-actions' },
                        React.createElement('button', { id: 'add-top-level-goal-btn', onClick: handleAddTopLevelGoal }, 'Add Goal'),
                        React.createElement('button', { onClick: () => setShowAddTopLevelModal(false) }, 'Cancel')
                    )
                )
            )
        )
    );
}

// Add notification animations to CSS
const notificationStyles = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.progress-slider {
    width: 100%;
    margin-top: 8px;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: #ddd;
    outline: none;
}

.progress-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #4CAF50;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.progress-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #4CAF50;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialize the React application
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.querySelector('.container'));
    root.render(React.createElement(GoalSetter));
});
