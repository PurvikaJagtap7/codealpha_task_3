// State Management
const state = {
    users: [],
    currentUser: null,
    projects: [],
    currentProject: null,
    ws: null
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadFromStorage();
    setupEventListeners();
    connectWebSocket();
}

// Storage
function loadFromStorage() {
    state.users = JSON.parse(localStorage.getItem('users') || '[]');
    state.projects = JSON.parse(localStorage.getItem('projects') || '[]');
}

function saveToStorage() {
    localStorage.setItem('users', JSON.stringify(state.users));
    localStorage.setItem('projects', JSON.stringify(state.projects));
}

// Auth Functions
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = state.users.find(u => u.username === username && u.password === password);
    if (user) {
        login(user);
    } else {
        showNotification('Invalid credentials. Please check username and password.');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match!');
        return;
    }
    
    if (state.users.find(u => u.username === username)) {
        showNotification('Username already exists');
        return;
    }
    
    state.users.push({ username, email, password });
    saveToStorage();
    showNotification('Registration successful! Please login');
    document.getElementById('registerForm').reset();
    showLoginPage();
}

function showLoginPage() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('registerSection').style.display = 'none';
}

function showRegisterPage() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'flex';
}

function login(user) {
    state.currentUser = user;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('currentUser').textContent = user.username;
    document.getElementById('logoutBtn').style.display = 'block';
    renderProjects();
    showNotification('Welcome ' + user.username);
}

function logout() {
    state.currentUser = null;
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

// Event Listeners Setup
function setupEventListeners() {
    // Auth listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterPage();
    });
    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Project listeners
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        document.getElementById('projectModal').style.display = 'block';
    });
    
    document.getElementById('projectForm').addEventListener('submit', (e) => {
        e.preventDefault();
        createProject();
    });
    
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        document.getElementById('taskModal').style.display = 'block';
    });
    
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        createTask();
    });
    
    document.getElementById('backToProjects').addEventListener('click', () => {
        document.querySelector('.projects-section').style.display = 'block';
        document.getElementById('projectBoard').style.display = 'none';
    });
    
    document.getElementById('commentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addComment();
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });
}

function createProject() {
    const name = document.getElementById('projectName').value;
    const desc = document.getElementById('projectDesc').value;
    
    const project = {
        id: Date.now(),
        name,
        description: desc,
        owner: state.currentUser.username,
        tasks: []
    };
    
    state.projects.push(project);
    saveToStorage();
    renderProjects();
    document.getElementById('projectModal').style.display = 'none';
    document.getElementById('projectForm').reset();
    showNotification('Project created');
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = state.projects.map(p => `
        <div class="project-card" onclick="openProject(${p.id})">
            <h3>${p.name}</h3>
            <p>${p.description || 'No description'}</p>
            <p style="margin-top: 10px; font-size: 12px; color: #999;">Owner: ${p.owner}</p>
        </div>
    `).join('');
}

function openProject(id) {
    state.currentProject = state.projects.find(p => p.id === id);
    document.querySelector('.projects-section').style.display = 'none';
    document.getElementById('projectBoard').style.display = 'block';
    document.getElementById('projectTitle').textContent = state.currentProject.name;
    renderTasks();
}

// Tasks
function createTask() {
    const task = {
        id: Date.now(),
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDesc').value,
        status: document.getElementById('taskStatus').value,
        assignee: document.getElementById('taskAssignee').value,
        comments: []
    };
    
    state.currentProject.tasks.push(task);
    saveToStorage();
    renderTasks();
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
    showNotification('Task added');
    sendWebSocketMessage('task_created', task);
}

function renderTasks() {
    const container = document.getElementById('tasksList');
    const statuses = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
    
    container.innerHTML = Object.keys(statuses).map(status => `
        <div class="task-column">
            <h3>${statuses[status]}</h3>
            ${state.currentProject.tasks.filter(t => t.status === status).map(t => `
                <div class="task-card" onclick="openTask(${t.id})">
                    <h4>${t.title}</h4>
                    <p>${t.description || 'No description'}</p>
                    ${t.assignee ? `<div class="task-assignee">@${t.assignee}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('');
}

function openTask(taskId) {
    const task = state.currentProject.tasks.find(t => t.id === taskId);
    const content = document.getElementById('taskDetailContent');
    
    content.innerHTML = `
        <h3>${task.title}</h3>
        <p style="margin: 15px 0;">${task.description || 'No description'}</p>
        <p><strong>Status:</strong> ${task.status}</p>
        ${task.assignee ? `<p><strong>Assigned to:</strong> @${task.assignee}</p>` : ''}
    `;
    
    renderComments(task);
    document.getElementById('taskDetailModal').style.display = 'block';
    document.getElementById('taskDetailModal').dataset.taskId = taskId;
}

function renderComments(task) {
    const container = document.getElementById('commentsList');
    container.innerHTML = task.comments.map(c => `
        <div class="comment">
            <div class="comment-user">@${c.user}</div>
            <div class="comment-text">${c.text}</div>
        </div>
    `).join('');
}

function addComment() {
    const taskId = parseInt(document.getElementById('taskDetailModal').dataset.taskId);
    const task = state.currentProject.tasks.find(t => t.id === taskId);
    const text = document.getElementById('commentText').value;
    
    const comment = {
        user: state.currentUser.username,
        text,
        timestamp: Date.now()
    };
    
    task.comments.push(comment);
    saveToStorage();
    renderComments(task);
    document.getElementById('commentText').value = '';
    sendWebSocketMessage('comment_added', { taskId, comment });
}

// WebSocket for Real-time Updates
function connectWebSocket() {
    // Simulate WebSocket with polling (since we can't use actual WebSocket in this environment)
    state.ws = {
        connected: true,
        send: (msg) => console.log('WS Send:', msg)
    };
}

function sendWebSocketMessage(type, data) {
    if (state.ws && state.ws.connected) {
        state.ws.send(JSON.stringify({ type, data, user: state.currentUser.username }));
    }
}

// Notifications
function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = message;
    document.getElementById('notifications').appendChild(notif);
    
    setTimeout(() => notif.remove(), 3000);
}