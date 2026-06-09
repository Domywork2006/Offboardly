/**
 * dashboard.js
 * 
 * Handles employee-specific dashboard logic.
 * Calculates leave balances, submits leave applications, handles validations,
 * and renders history tables.
 */

// Global employee state variables
let userTotalLeaves = 24;
let userLeavesTaken = 0;
let userRemainingLeaves = 24;

/**
 * Initializes the Employee Dashboard content.
 * Reloads user profile stats and loads the history list.
 */
function initEmployeeDashboard() {
  // 1. Fetch latest user profile metrics (total/remaining leaves)
  fetchProfileData();

  // 2. Fetch leave requests history
  loadLeaveHistory();

  // 3. Set minimum input dates in the form to today
  setupDatePickers();

  // 4. Set up live duration calculation listeners
  setupDurationCalculator();

  // 5. Add leave submission form listener
  const leaveForm = document.getElementById('leaveApplicationForm');
  if (leaveForm) {
    // Remove old listeners to avoid multiple attachments
    const newForm = leaveForm.cloneNode(true);
    leaveForm.parentNode.replaceChild(newForm, leaveForm);
    newForm.addEventListener('submit', handleLeaveSubmit);
  }
}

/**
 * Fetch latest user stats from /api/me and updates UI cards
 */
async function fetchProfileData() {
  const token = localStorage.getItem('offboardly_token');
  try {
    const response = await fetch(`${API_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      userTotalLeaves = data.user.totalLeaves;
      userLeavesTaken = data.user.leavesTaken;
      userRemainingLeaves = data.user.remainingLeaves;

      // Update Dashboard numeric metrics cards
      document.getElementById('statTotalLeaves').textContent = userTotalLeaves;
      document.getElementById('statLeavesTaken').textContent = userLeavesTaken;
      document.getElementById('statRemainingLeaves').textContent = userRemainingLeaves;
      
      // Update global user details
      currentUser.totalLeaves = userTotalLeaves;
      currentUser.leavesTaken = userLeavesTaken;
      currentUser.remainingLeaves = userRemainingLeaves;
    }
  } catch (error) {
    console.error('Failed to load profile data:', error.message);
  }
}

/**
 * Sets up start/end date input limits.
 * Employees cannot apply for leave prior to today.
 */
function setupDatePickers() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = document.getElementById('leaveStartDate');
  const endInput = document.getElementById('leaveEndDate');

  if (startInput && endInput) {
    startInput.min = today;
    endInput.min = today;
  }
}

/**
 * Configures event listeners to automatically compute and display
 * the duration in days when start or end dates are picked.
 */
function setupDurationCalculator() {
  const startInput = document.getElementById('leaveStartDate');
  const endInput = document.getElementById('leaveEndDate');
  const calcText = document.getElementById('leaveDurationCalc');

  function updateDuration() {
    const startVal = startInput.value;
    const endVal = endInput.value;

    if (startVal && endVal) {
      const start = new Date(startVal);
      const end = new Date(endVal);

      if (end < start) {
        calcText.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> End Date cannot be before Start Date</span>';
        return;
      }

      // Calculate days (inclusive)
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays > userRemainingLeaves) {
        calcText.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle-fill"></i> Duration: ${diffDays} days (Exceeds balance by ${diffDays - userRemainingLeaves} day(s))</span>`;
      } else {
        calcText.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill"></i> Duration: <strong>${diffDays}</strong> day(s)</span>`;
      }
    } else {
      calcText.textContent = 'Duration: 0 days';
    }
  }

  if (startInput && endInput) {
    startInput.addEventListener('change', updateDuration);
    endInput.addEventListener('change', updateDuration);
  }
}

/**
 * Submits the leave request form to Express API with local validation.
 */
async function handleLeaveSubmit(event) {
  event.preventDefault();

  const type = document.getElementById('leaveType').value;
  const startDate = document.getElementById('leaveStartDate').value;
  const endDate = document.getElementById('leaveEndDate').value;
  const reason = document.getElementById('leaveReason').value.trim();

  // 1. Basic check
  if (!type || !startDate || !endDate || !reason) {
    showAppNotification('All fields are required to submit leave.', 'warning');
    return;
  }

  // 2. Validation: End Date cannot be before Start Date
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    showAppNotification('Error: The end date cannot be set before the start date.', 'danger');
    return;
  }

  // Calculate duration
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // 3. Validation: Check leave balance availability
  if (diffDays > userRemainingLeaves) {
    showAppNotification(`Error: Insufficient leave balance! You requested ${diffDays} day(s), but only have ${userRemainingLeaves} day(s) remaining.`, 'danger');
    return;
  }

  // Disable submit button during request
  const submitBtn = document.getElementById('leaveSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting request...';

  const token = localStorage.getItem('offboardly_token');

  try {
    const response = await fetch(`${API_URL}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        reason: reason
      })
    });

    const data = await response.json();

    if (response.ok) {
      showAppNotification('Leave application submitted successfully! Notification sent to manager.', 'success');
      
      // Clear Form fields
      document.getElementById('leaveStartDate').value = '';
      document.getElementById('leaveEndDate').value = '';
      document.getElementById('leaveReason').value = '';
      document.getElementById('leaveDurationCalc').textContent = 'Duration: 0 days';

      // Reload dashboard metrics & logs
      initEmployeeDashboard();
      
      // Update the simulated inbox automatically
      if (window.fetchSimulatedEmails) {
        window.fetchSimulatedEmails();
      }
    } else {
      showAppNotification(data.error || 'Failed to submit leave request.', 'danger');
    }
  } catch (error) {
    console.error('Submit leave error:', error.message);
    showAppNotification('Server connection failed. Could not apply for leave.', 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Request';
  }
}

/**
 * Fetches my leave requests history and renders tables
 */
async function loadLeaveHistory() {
  const token = localStorage.getItem('offboardly_token');
  try {
    const response = await fetch(`${API_URL}/leave`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const leaves = await response.json();
      
      // Populate dashboards
      renderRecentHistory(leaves);
      renderFullHistory(leaves);
    }
  } catch (error) {
    console.error('Error fetching leave history:', error.message);
  }
}

/**
 * Renders the short dashboard recent leave queue (limited to 5 records)
 */
function renderRecentHistory(leaves) {
  const tableBody = document.querySelector('#recentHistoryTable tbody');
  tableBody.innerHTML = '';

  const recent = leaves.slice(0, 5); // Take the latest 5

  if (recent.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No recent leave requests.</td>
      </tr>
    `;
    return;
  }

  recent.forEach(leave => {
    // Format dates to look nice: e.g. "10-Jun-2026"
    const startFormatted = formatDateString(leave.start_date);
    const endFormatted = formatDateString(leave.end_date);
    const duration = calculateLeaveDaysForClient(leave.start_date, leave.end_date);

    // Build badge class based on status
    const badgeClass = getStatusBadgeClass(leave.status);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fw-semibold text-cobalt">${leave.leave_type}</td>
      <td class="fs-8 text-muted">${startFormatted} to ${endFormatted}</td>
      <td class="text-center fw-medium">${duration}</td>
      <td><span class="badge ${badgeClass} px-2.5 py-1.5 rounded-pill">${leave.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Renders the full leave history queue page
 */
function renderFullHistory(leaves) {
  const tableBody = document.querySelector('#fullHistoryTable tbody');
  if (!tableBody) return; // Might not be in context
  
  tableBody.innerHTML = '';

  if (leaves.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">You have not submitted any leave requests yet.</td>
      </tr>
    `;
    return;
  }

  leaves.forEach(leave => {
    const startFormatted = formatDateString(leave.start_date);
    const endFormatted = formatDateString(leave.end_date);
    const createdFormatted = formatDateString(leave.created_at);
    const duration = calculateLeaveDaysForClient(leave.start_date, leave.end_date);
    const badgeClass = getStatusBadgeClass(leave.status);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fs-8 text-muted">${createdFormatted}</td>
      <td class="fw-semibold text-cobalt">${leave.leave_type}</td>
      <td class="fw-medium">${startFormatted}</td>
      <td class="fw-medium">${endFormatted}</td>
      <td class="fs-8 text-muted text-wrap" style="max-width: 250px;">${leave.reason}</td>
      <td class="text-center fw-bold text-cobalt">${duration}</td>
      <td><span class="badge ${badgeClass} px-2.5 py-1.5 rounded-pill">${leave.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Helper to compute date difference for rendering
 */
function calculateLeaveDaysForClient(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Helper to map request status to CSS badges
 */
function getStatusBadgeClass(status) {
  if (status === 'Approved') return 'badge-approved';
  if (status === 'Rejected') return 'badge-rejected';
  return 'badge-pending';
}

/**
 * Helper to format date string to human-readable form (e.g. 10-Jun-2026)
 */
function formatDateString(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  
  // Format day
  const day = String(date.getDate()).padStart(2, '0');
  
  // Format month
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  
  // Format year
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}
