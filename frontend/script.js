// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : '/api';

// Global State
let currentUser = null;
let currentTasks = [];
let editingTaskId = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const loginFormEl = document.getElementById('loginForm');
const registerFormEl = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logout-btn');
const userGreeting = document.getElementById('user-greeting');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelTaskBtn = document.getElementById('cancel-task');
const taskForm = document.getElementById('task-form');
const tasksContainer = document.getElementById('tasks-container');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');
const searchInput = document.getElementById('search-input');
const tasksLoading = document.getElementById('tasks-loading');
const noTasks = document.getElementById('no-tasks');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    attachEventListeners();
});

function initializeApp() {
    const token = localStorage.getItem('token');
    if (token) {
        validateToken();
    } else {
        showAuthSection();
    }
}

function attachEventListeners() {
    // Auth form switching
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // Form submissions
    loginFormEl.addEventListener('submit', handleLogin);
    registerFormEl.addEventListener('submit', handleRegister);
    taskForm.addEventListener('submit', handleTaskSubmit);

    // App navigation
    logoutBtn.addEventListener('click', handleLogout);
    addTaskBtn.addEventListener('click', showAddTaskModal);
    closeModalBtn.addEventListener('click', hideTaskModal);
    cancelTaskBtn.addEventListener('click', hideTaskModal);

    // Filters and search
    statusFilter.addEventListener('change', filterTasks);
    priorityFilter.addEventListener('change', filterTasks);
    searchInput.addEventListener('input', debounce(filterTasks, 300));

    // Modal close on backdrop click
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            hideTaskModal();
        }
    });
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            showNotification('Login successful!', 'success');
            showAppSection();
        } else {
            showNotification(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('token', result.token);
            currentUser = result.user;
            showNotification('Account created successfully!', 'success');
            showAppSection();
        } else {
            const errorMessage = result.errors ? result.errors.join(', ') : result.error;
            showNotification(errorMessage || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function validateToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        showAuthSection();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            currentUser = result.user;
            showAppSection();
        } else {
            localStorage.removeItem('token');
            showAuthSection();
        }
    } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('token');
        showAuthSection();
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    currentTasks = [];
    showAuthSection();
    showNotification('Logged out successfully', 'success');
}

// UI State Management
function showAuthSection() {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
}

function showAppSection() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userGreeting.textContent = `Welcome back, ${currentUser.username}!`;
    loadDashboard();
}

function showLoginForm() {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
}

function showRegisterForm() {
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
}

// Task Management Functions
async function loadDashboard() {
    await Promise.all([
        loadDashboardStats(),
        loadTasks()
    ]);
}

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            updateDashboardStats(result.stats);
        }
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

function updateDashboardStats(stats) {
    document.getElementById('stat-todo').textContent = stats.tasks.todo;
    document.getElementById('stat-progress').textContent = stats.tasks.inProgress;
    document.getElementById('stat-completed').textContent = stats.tasks.completed;
    document.getElementById('stat-overdue').textContent = stats.alerts.overdue;
}

async function loadTasks() {
    showTasksLoading();
    
    try {
        const params = new URLSearchParams();
        if (statusFilter.value) params.append('status', statusFilter.value);
        if (priorityFilter.value) params.append('priority', priorityFilter.value);
        
        const response = await fetch(`${API_BASE_URL}/tasks?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            currentTasks = result.tasks;
            displayTasks(currentTasks);
        } else {
            showNotification('Failed to load tasks', 'error');
        }
    } catch (error) {
        console.error('Failed to load tasks:', error);
        showNotification('Network error while loading tasks', 'error');
    } finally {
        hideTasksLoading();
    }
}

function displayTasks(tasks) {
    if (tasks.length === 0) {
        tasksContainer.innerHTML = '';
        noTasks.classList.remove('hidden');
        return;
    }

    noTasks.classList.add('hidden');
    tasksContainer.innerHTML = tasks.map(task => createTaskHTML(task)).join('');
    
    // Attach event listeners to task buttons
    attachTaskEventListeners();
}

function createTaskHTML(task) {
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
    
    return `
        <div class="task-item ${task.priority}" data-task-id="${task._id}">
            <div class="task-header">
                <div>
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                </div>
            </div>
            
            <div class="task-meta">
                <span class="task-badge status-${task.status}">${formatStatus(task.status)}</span>
                <span class="task-badge priority-${task.priority}">${task.priority}</span>
                ${task.category ? `<span class="task-badge">${escapeHtml(task.category)}</span>` : ''}
                ${dueDate ? `<span class="task-badge ${isOverdue ? 'overdue' : ''}">${dueDate}</span>` : ''}
            </div>
            
            ${task.tags && task.tags.length > 0 ? `
                <div class="task-tags">
                    ${task.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            
            <div class="task-actions">
                <button class="btn btn-secondary edit-task" data-task-id="${task._id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${task.status !== 'completed' ? `
                    <button class="btn btn-success complete-task" data-task-id="${task._id}">
                        <i class="fas fa-check"></i> Complete
                    </button>
                ` : ''}
                <button class="btn btn-danger delete-task" data-task-id="${task._id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

function attachTaskEventListeners() {
    // Edit task buttons
    document.querySelectorAll('.edit-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.closest('.edit-task').dataset.taskId;
            editTask(taskId);
        });
    });

    // Complete task buttons
    document.querySelectorAll('.complete-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.closest('.complete-task').dataset.taskId;
            completeTask(taskId);
        });
    });

    // Delete task buttons
    document.querySelectorAll('.delete-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.closest('.delete-task').dataset.taskId;
            deleteTask(taskId);
        });
    });
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Process tags
    if (data.tags) {
        data.tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    // Handle empty due date
    if (!data.dueDate) {
        delete data.dueDate;
    }

    try {
        const url = editingTaskId 
            ? `${API_BASE_URL}/tasks/${editingTaskId}`
            : `${API_BASE_URL}/tasks`;
        
        const method = editingTaskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(
                editingTaskId ? 'Task updated successfully!' : 'Task created successfully!',
                'success'
            );
            hideTaskModal();
            await loadDashboard();
        } else {
            const errorMessage = result.errors ? result.errors.join(', ') : result.error;
            showNotification(errorMessage || 'Failed to save task', 'error');
        }
    } catch (error) {
        console.error('Task submit error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function editTask(taskId) {
    const task = currentTasks.find(t => t._id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    
    // Populate form
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-status').value = task.status;
    document.getElementById('task-category').value = task.category || '';
    
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        document.getElementById('task-due-date').value = date.toISOString().slice(0, 16);
    }
    
    if (task.tags && task.tags.length > 0) {
        document.getElementById('task-tags').value = task.tags.join(', ');
    }
    
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('save-btn-text').textContent = 'Update Task';
    
    showTaskModal();
}

async function completeTask(taskId) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ status: 'completed' }),
        });

        if (response.ok) {
            showNotification('Task completed!', 'success');
            await loadDashboard();
        } else {
            showNotification('Failed to complete task', 'error');
        }
    } catch (error) {
        console.error('Complete task error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });

        if (response.ok) {
            showNotification('Task deleted successfully!', 'success');
            await loadDashboard();
        } else {
            showNotification('Failed to delete task', 'error');
        }
    } catch (error) {
        console.error('Delete task error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Modal Functions
function showAddTaskModal() {
    editingTaskId = null;
    taskForm.reset();
    document.getElementById('modal-title').textContent = 'Add New Task';
    document.getElementById('save-btn-text').textContent = 'Save Task';
    showTaskModal();
}

function showTaskModal() {
    taskModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('task-title').focus();
}

function hideTaskModal() {
    taskModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    taskForm.reset();
    editingTaskId = null;
}

// Filter and Search Functions
function filterTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;

    let filteredTasks = currentTasks;

    // Apply search filter
    if (searchTerm) {
        filteredTasks = filteredTasks.filter(task =>
            task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm)) ||
            (task.category && task.category.toLowerCase().includes(searchTerm))
        );
    }

    // Apply status filter
    if (statusValue) {
        filteredTasks = filteredTasks.filter(task => task.status === statusValue);
    }

    // Apply priority filter
    if (priorityValue) {
        filteredTasks = filteredTasks.filter(task => task.priority === priorityValue);
    }

    displayTasks(filteredTasks);
}

// Utility Functions
function showTasksLoading() {
    tasksLoading.classList.remove('hidden');
    tasksContainer.classList.add('hidden');
    noTasks.classList.add('hidden');
}

function hideTasksLoading() {
    tasksLoading.classList.add('hidden');
    tasksContainer.classList.remove('hidden');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.getElementById('notifications').appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);

    // Remove on click
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

function formatStatus(status) {
    const statusMap = {
        'todo': 'To Do',
        'in-progress': 'In Progress',
        'completed': 'Completed'
    };
    return statusMap[status] || status;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N to add new task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !taskModal.classList.contains('hidden')) {
        e.preventDefault();
        showAddTaskModal();
    }
    
    // Escape to close modal
    if (e.key === 'Escape' && !taskModal.classList.contains('hidden')) {
        hideTaskModal();
    }
});

// Auto-refresh dashboard every 5 minutes
setInterval(() => {
    if (currentUser && !authSection.classList.contains('hidden')) {
        loadDashboardStats();
    }
}, 5 * 60 * 1000);