/**
 * auth.js
 * 
 * Manages user authentication (Register, Login, Logout) and page navigation.
 * Saves/reads JWT session tokens in localStorage.
 * Automatically validates active tokens on page load to keep users logged in.
 */

// Central base URL for the backend API
const API_URL = 'http://localhost:5000/api';

// Current session state
let currentUser = null;
let currentAuthRole = 'employee'; // Role selected on the login page ('employee' or 'manager')
let currentAuthMode = 'login';     // Form mode ('login' or 'register')

// Wait for the DOM to load before initializing
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

/**
 * Initializes authentication and checks if a session is already active.
 */
async function initAuth() {
  const token = localStorage.getItem('offboardly_token');
  
  // Set up auth form submission event listener
  const form = document.getElementById('authForm');
  if (form) {
    form.addEventListener('submit', handleAuthSubmit);
  }

  // Set up logout button event listener
  const logoutBtn = document.getElementById('btnLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  if (token) {
    // A token exists! Let's verify it with the server profile endpoint
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        console.log('Session restored for:', currentUser.name);
        
        // Hide login and show dashboard matching the user's role
        setupAppUI();
      } else {
        // Token was invalid or expired
        console.warn('Session expired or invalid.');
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to connect to backend server:', error.message);
      showAuthAlert('Unable to connect to server. Please ensure the backend is running.', 'danger');
    }
  } else {
    // No token found. Display login page.
    showAuthSection();
  }
}

/**
 * Toggles the selected role (Employee/Manager) in the login panel.
 * 
 * @param {string} role - 'employee' or 'manager'
 */
function setAuthRole(role) {
  currentAuthRole = role;
  
  const empBtn = document.getElementById('roleBtnEmployee');
  const mgrBtn = document.getElementById('roleBtnManager');
  const regNameGroup = document.getElementById('registerNameGroup');
  const authSwitchContainer = document.getElementById('authSwitchContainer');

  if (role === 'manager') {
    // Managers can only log in (not register from this screen)
    empBtn.classList.remove('active');
    mgrBtn.classList.add('active');
    
    // Switch form to login mode if it was in register mode
    if (currentAuthMode === 'register') {
      setAuthMode('login');
    }
    
    // Hide registration options for managers
    authSwitchContainer.classList.add('d-none');
  } else {
    // Employees can log in or register
    mgrBtn.classList.remove('active');
    empBtn.classList.add('active');
    authSwitchContainer.classList.remove('d-none');
  }
}

/**
 * Toggles form fields between "Login" and "Register" modes.
 */
function toggleAuthMode(event) {
  if (event) event.preventDefault();
  
  if (currentAuthMode === 'login') {
    setAuthMode('register');
  } else {
    setAuthMode('login');
  }
}

/**
 * Sets the form representation mode.
 * 
 * @param {string} mode - 'login' or 'register'
 */
function setAuthMode(mode) {
  currentAuthMode = mode;
  
  const nameGroup = document.getElementById('registerNameGroup');
  const cardTitle = document.getElementById('authCardTitle');
  const cardSub = document.getElementById('authCardSub');
  const btnText = document.getElementById('authBtnText');
  const switchText = document.getElementById('authSwitchText');
  const switchBtn = document.getElementById('authSwitchBtn');
  
  // Clear any existing alerts
  hideAuthAlert();

  if (mode === 'register') {
    nameGroup.classList.remove('d-none');
    document.getElementById('authName').setAttribute('required', 'true');
    cardTitle.textContent = 'Create Account';
    cardSub.textContent = 'Register as an employee to track leaves';
    btnText.textContent = 'Register';
    switchText.textContent = 'Already have an account?';
    switchBtn.textContent = 'Sign In';
  } else {
    nameGroup.classList.add('d-none');
    document.getElementById('authName').removeAttribute('required');
    cardTitle.textContent = 'Welcome Back';
    cardSub.textContent = 'Sign in to request and manage leaves';
    btnText.textContent = 'Sign In';
    switchText.textContent = "Don't have an account?";
    switchBtn.textContent = 'Sign Up';
  }
}

/**
 * Handles the registration/login form submission via AJAX fetch.
 */
async function handleAuthSubmit(event) {
  event.preventDefault();
  hideAuthAlert();

  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const nameInput = document.getElementById('authName');

  // Basic HTML validation checks
  if (!emailInput.value || !passwordInput.value || (currentAuthMode === 'register' && !nameInput.value)) {
    showAuthAlert('Please fill in all required fields.', 'danger');
    return;
  }

  // Show Loading Spinner on Button
  const submitBtn = document.getElementById('authSubmitBtn');
  const spinner = document.getElementById('authSpinner');
  submitBtn.disabled = true;
  spinner.classList.remove('d-none');

  // Build request payload
  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value,
    role: currentAuthRole
  };

  if (currentAuthMode === 'register') {
    payload.name = nameInput.value.trim();
  }

  const endpoint = currentAuthMode === 'register' ? 'register' : 'login';

  try {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      // Success! Save JWT token to local storage
      localStorage.setItem('offboardly_token', data.token);
      currentUser = data.user;
      
      // Clear forms
      emailInput.value = '';
      passwordInput.value = '';
      nameInput.value = '';

      console.log('Login success. User payload:', currentUser);
      
      // Launch dashboard screen
      setupAppUI();
    } else {
      // Server returned validation error
      showAuthAlert(data.error || 'Authentication failed. Please try again.', 'danger');
    }
  } catch (error) {
    console.error('Auth request error:', error.message);
    showAuthAlert('Unable to reach server. Please check that your API backend is running.', 'danger');
  } finally {
    // Hide Loading Spinner
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
}

/**
 * Handles logging out. Clears session storage and returns to login card.
 */
function handleLogout() {
  localStorage.removeItem('offboardly_token');
  currentUser = null;
  
  // Hide main navbar and dashboards, show login panel
  document.getElementById('mainNavbar').classList.add('d-none');
  document.getElementById('appLayout').classList.add('d-none');
  document.getElementById('authSection').classList.remove('d-none');
  
  setAuthMode('login');
  setAuthRole('employee');
  
  console.log('Logged out successfully.');
}

/**
 * Hides login elements and shows the core dashboard grids.
 */
function setupAppUI() {
  document.getElementById('authSection').classList.add('d-none');
  document.getElementById('mainNavbar').classList.remove('d-none');
  document.getElementById('appLayout').classList.remove('d-none');

  // Populate user profile info in navbar
  document.getElementById('navUserName').textContent = currentUser.name;
  document.getElementById('navUserRole').textContent = currentUser.role;

  // Render navigation links based on user's access role
  renderSidebarLinks();
}

/**
 * Builds the sidebar links menu matching user role.
 */
function renderSidebarLinks() {
  const sidebarMenu = document.getElementById('sidebarMenu');
  sidebarMenu.innerHTML = ''; // Clear prior entries

  if (currentUser.role === 'manager') {
    // Manager Sidebar Items
    sidebarMenu.innerHTML = `
      <a href="#" class="list-group-item list-group-item-action active" id="link-manager-dashboard" onclick="navigateToView('view-manager-dashboard', event)">
        <i class="bi bi-speedometer2 me-2 text-cobalt"></i> Review Requests
      </a>
      <a href="#" class="list-group-item list-group-item-action" id="link-shared-calendar" onclick="navigateToView('view-shared-calendar', event)">
        <i class="bi bi-calendar3 me-2 text-cobalt"></i> Leave Calendar
      </a>
    `;
    
    // Route to manager default view and fetch manager data
    showView('view-manager-dashboard');
    initManagerDashboard();
  } else {
    // Employee Sidebar Items
    sidebarMenu.innerHTML = `
      <a href="#" class="list-group-item list-group-item-action active" id="link-employee-dashboard" onclick="navigateToView('view-employee-dashboard', event)">
        <i class="bi bi-speedometer2 me-2 text-cobalt"></i> Dashboard
      </a>
      <a href="#" class="list-group-item list-group-item-action" id="link-employee-history" onclick="navigateToView('view-employee-history', event)">
        <i class="bi bi-clock-history me-2 text-cobalt"></i> Leave History
      </a>
      <a href="#" class="list-group-item list-group-item-action" id="link-shared-calendar" onclick="navigateToView('view-shared-calendar', event)">
        <i class="bi bi-calendar3 me-2 text-cobalt"></i> Leave Calendar
      </a>
    `;
    
    // Route to employee default view and load employee data
    showView('view-employee-dashboard');
    initEmployeeDashboard();
  }
}

/**
 * Routes between different view sections.
 * 
 * @param {string} viewId - HTML section ID to display
 * @param {Event} [event] - Anchor click event
 */
function navigateToView(viewId, event) {
  if (event) event.preventDefault();
  
  // Highlight active link in sidebar
  const links = document.querySelectorAll('#sidebarMenu .list-group-item');
  links.forEach(link => {
    link.classList.remove('active');
  });

  // Find the clicked link's ID
  const activeLink = document.getElementById(`link-${viewId.replace('view-', '')}`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  showView(viewId);

  // Trigger content loading hooks depending on view
  if (viewId === 'view-employee-dashboard') {
    initEmployeeDashboard();
  } else if (viewId === 'view-employee-history') {
    loadLeaveHistory();
  } else if (viewId === 'view-manager-dashboard') {
    initManagerDashboard();
  } else if (viewId === 'view-shared-calendar') {
    renderLeaveCalendar();
  }
}

// Global helper to trigger page navigations from outside buttons
window.navigateTo = (viewId) => {
  navigateToView(viewId);
};

/**
 * Toggles display states on sub-sections of the SPA.
 */
function showView(viewId) {
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => {
    v.classList.add('d-none');
  });
  
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove('d-none');
  }
  
  // Scroll to top of page
  window.scrollTo(0, 0);
}

/**
 * Toggles display on the initial auth page wrapper.
 */
function showAuthSection() {
  document.getElementById('mainNavbar').classList.add('d-none');
  document.getElementById('appLayout').classList.add('d-none');
  document.getElementById('authSection').classList.remove('d-none');
  setAuthMode('login');
}

// Helpers for displaying errors or notifications in auth panel
function showAuthAlert(message, type = 'danger') {
  const alert = document.getElementById('authAlert');
  const msg = document.getElementById('authAlertMsg');
  
  alert.className = `alert alert-${type} shadow-sm alert-dismissible fade show`;
  msg.textContent = message;
  alert.classList.remove('d-none');
}

function hideAuthAlert() {
  const alert = document.getElementById('authAlert');
  if (alert) alert.classList.add('d-none');
}

// Helpers for displaying notifications globally in the application
window.showAppNotification = (message, type = 'danger') => {
  const alert = document.getElementById('appAlert');
  const msg = document.getElementById('appAlertMsg');
  
  if (alert && msg) {
    alert.className = `alert alert-${type} shadow-sm alert-dismissible fade show`;
    msg.textContent = message;
    alert.classList.remove('d-none');
    
    // Auto scroll to alert
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      alert.classList.add('d-none');
    }, 5000);
  }
};
