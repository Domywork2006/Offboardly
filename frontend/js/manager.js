/**
 * manager.js
 * 
 * Handles manager-specific operations.
 * Renders pending leave request queue, handles approvals and rejections,
 * and initializes Chart.js distribution graphs.
 */

// Global Chart.js instance holder
let statsChartInstance = null;

/**
 * Initializes the Manager Dashboard.
 * Retrieves numeric statistics, draws charts, and loads the queue of requests.
 */
function initManagerDashboard() {
  // 1. Fetch system statistics and draw Chart.js representation
  fetchManagerStats();

  // 2. Load pending leave requests
  fetchPendingRequests();
}

/**
 * Fetches metrics from /api/manager/stats and updates UI counts and Chart.js
 */
async function fetchManagerStats() {
  const token = localStorage.getItem('offboardly_token');
  try {
    const response = await fetch(`${API_URL}/manager/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const stats = await response.json(); // returns { Pending: X, Approved: Y, Rejected: Z }
      
      // Update Numeric Counters in UI
      document.getElementById('totalPendingLeavesCount').textContent = stats.Pending || 0;
      document.getElementById('totalApprovedLeavesCount').textContent = stats.Approved || 0;
      document.getElementById('totalRejectedLeavesCount').textContent = stats.Rejected || 0;

      // Seed mock count of total users (Managers + Employees)
      // For visual completeness, we make an arbitrary fetch or mock count
      document.getElementById('totalStaffRegistered').textContent = 2 + (stats.Pending || 0) + (stats.Approved || 0);

      // Render Chart.js Donut
      renderDistributionChart(stats.Pending || 0, stats.Approved || 0, stats.Rejected || 0);
    }
  } catch (error) {
    console.error('Failed to load manager stats:', error.message);
  }
}

/**
 * Draws or updates the Donut chart showing leaves status division.
 */
function renderDistributionChart(pending, approved, rejected) {
  const ctx = document.getElementById('statsChart');
  const noDataMsg = document.getElementById('chartNoDataMsg');
  
  if (!ctx) return; // Not in view

  const total = pending + approved + rejected;

  if (total === 0) {
    // Hide canvas and show "no data" message
    ctx.classList.add('d-none');
    noDataMsg.classList.remove('d-none');
    return;
  }

  // Show canvas
  ctx.classList.remove('d-none');
  noDataMsg.classList.add('d-none');

  // If a chart already exists, destroy it first to avoid overlay bugs
  if (statsChartInstance) {
    statsChartInstance.destroy();
  }

  // Create new chart instance
  statsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Approved', 'Rejected'],
      datasets: [{
        data: [pending, approved, rejected],
        backgroundColor: [
          '#d29922', // Amber (Pending)
          '#2ea44f', // Emerald Green (Approved)
          '#f85149'  // Crimson Red (Rejected)
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              family: 'Inter',
              size: 11,
              weight: 500
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const percentage = ((value / total) * 100).toFixed(0);
              return ` ${context.label}: ${value} requests (${percentage}%)`;
            }
          }
        }
      },
      cutout: '70%' // Thin corporate donut ring look
    }
  });
}

/**
 * Fetches all leave requests currently in "Pending" status from the API.
 */
async function fetchPendingRequests() {
  const token = localStorage.getItem('offboardly_token');
  const tableBody = document.querySelector('#managerPendingTable tbody');
  
  if (!tableBody) return;

  try {
    const response = await fetch(`${API_URL}/leave/pending`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const requests = await response.json();
      
      tableBody.innerHTML = ''; // Clear table

      if (requests.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-4">
              <i class="bi bi-calendar-check fs-2 d-block mb-2 text-muted-light"></i>
              No pending leave requests to process.
            </td>
          </tr>
        `;
        return;
      }

      requests.forEach(req => {
        const startFormatted = formatDateString(req.start_date);
        const endFormatted = formatDateString(req.end_date);
        const duration = calculateLeaveDaysForClient(req.start_date, req.end_date);

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <div class="fw-bold text-cobalt mb-0">${req.employee_name}</div>
            <div class="fs-8 text-muted">${req.employee_email}</div>
          </td>
          <td class="fw-semibold text-cobalt">${req.leave_type}</td>
          <td class="fw-medium">${startFormatted}</td>
          <td class="fw-medium">${endFormatted}</td>
          <td class="fs-8 text-muted text-wrap" style="max-width: 250px;">${req.reason}</td>
          <td class="text-center fw-bold text-cobalt">${duration}</td>
          <td class="text-end">
            <div class="d-inline-flex gap-2">
              <button class="btn btn-sm btn-success px-3 fw-semibold" onclick="processLeaveRequest(${req.id}, 'approve')">
                <i class="bi bi-check-lg me-1"></i> Approve
              </button>
              <button class="btn btn-sm btn-danger px-3 fw-semibold" onclick="processLeaveRequest(${req.id}, 'reject')">
                <i class="bi bi-x-lg me-1"></i> Reject
              </button>
            </div>
          </td>
        `;
        tableBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Error loading pending requests:', error.message);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-4">Failed to connect to API server.</td>
      </tr>
    `;
  }
}

/**
 * Sends approval/rejection API request for a leave entry.
 * 
 * @param {number} requestId - Database ID of leave request
 * @param {string} action - 'approve' or 'reject'
 */
async function processLeaveRequest(requestId, action) {
  const token = localStorage.getItem('offboardly_token');
  const endpoint = `${API_URL}/leave/${action}/${requestId}`;

  // Find the button inside UI and add a spinner/disable it
  // (We'll reload the table on finish, so simple alert or quick disable is fine)
  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      const msgType = action === 'approve' ? 'success' : 'warning';
      showAppNotification(`Leave request successfully ${action}d! Email alert sent.`, msgType);
      
      // Reload manager stats, tables, and email box
      initManagerDashboard();
      
      if (window.fetchSimulatedEmails) {
        window.fetchSimulatedEmails();
      }
    } else {
      showAppNotification(data.error || `Failed to ${action} leave request.`, 'danger');
    }
  } catch (error) {
    console.error(`Error processing request:`, error.message);
    showAppNotification('Connection error. Could not process request.', 'danger');
  }
}

// Bind processLeaveRequest globally so it can be called from inline onclick attributes in rows
window.processLeaveRequest = processLeaveRequest;
