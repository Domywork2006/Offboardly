/**
 * calendar.js
 * 
 * Generates an interactive, responsive monthly calendar grid.
 * Fetches all approved leave requests from the API and maps them
 * onto the calendar days so managers and employees can visualize team time-off.
 */

// Keep track of the calendar's current viewing month and year
let currentCalDate = new Date(); // Defaults to today's date

/**
 * Renders the Leave Calendar UI.
 * Fetches all approved leave requests and draws the monthly grid.
 */
async function renderLeaveCalendar() {
  const token = localStorage.getItem('offboardly_token');
  const calendarGrid = document.getElementById('calendarGrid');
  const monthTitle = document.getElementById('calendarMonthTitle');
  
  if (!calendarGrid || !monthTitle) return;

  // Clear grid contents
  calendarGrid.innerHTML = '';

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth(); // 0-indexed (Jan is 0)

  // Set the header title (e.g., "June 2026")
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  monthTitle.textContent = `${monthNames[month]} ${year}`;

  // 1. Draw Weekday Headers (Sun, Mon, Tue, etc.)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const headerCell = document.createElement('div');
    headerCell.className = 'calendar-header-cell';
    headerCell.textContent = day;
    calendarGrid.appendChild(headerCell);
  });

  try {
    // 2. Fetch approved leaves from backend
    const response = await fetch(`${API_URL}/leave/all-approved`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    let approvedLeaves = [];
    if (response.ok) {
      approvedLeaves = await response.json();
    }

    // 3. Compute calendar grid offsets
    // First day of current month (e.g. Wednesday, which corresponds to weekday index 3)
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // Total days in current month (e.g. 30 days)
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Total days in previous month (for showing greyed out trailing days)
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    // Today's date to highlight
    const today = new Date();

    // Render cells from previous month (greyed out)
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.innerHTML = `<span class="calendar-day-number">${prevDay}</span>`;
      calendarGrid.appendChild(cell);
    }

    // Render cells for current month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';
      
      // Build date representation for matching with leave requests
      // Note: Parse date carefully to avoid local timezone displacement.
      const cellDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cellDateObj = new Date(year, month, day);

      // Highlight today's cell
      if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
        cell.classList.add('calendar-today');
      }

      // Day label
      let cellHTML = `
        <span class="calendar-day-number">${day}</span>
        <div class="calendar-leave-container">
      `;

      // Find approved leaves that cover this specific day
      // A leave request covers this cell if: startDate <= cellDate <= endDate
      approvedLeaves.forEach(leave => {
        // Parse database dates as local dates (split by hyphen and create Date object)
        const startParts = leave.start_date.split('-');
        const endParts = leave.end_date.split('-');
        
        const leaveStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        const leaveEnd = new Date(endParts[0], endParts[1] - 1, endParts[2]);

        // Normalize time elements for clean date comparisons
        cellDateObj.setHours(0, 0, 0, 0);
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);

        if (cellDateObj >= leaveStart && cellDateObj <= leaveEnd) {
          const leaveTypeSafe = leave.leave_type.replace(/[^a-zA-Z]/g, ''); // strip slash
          cellHTML += `
            <div class="calendar-leave-tag bg-leave-${leaveTypeSafe}" title="${leave.employee_name}: ${leave.reason}">
              ${leave.employee_name} (${leave.leave_type})
            </div>
          `;
        }
      });

      cellHTML += `</div>`;
      cell.innerHTML = cellHTML;
      calendarGrid.appendChild(cell);
    }

    // Fill remaining cells of calendar grid (max 42 cells total)
    const totalCellsUsed = firstDayOfMonth + totalDaysInMonth;
    const remainingCells = 42 - totalCellsUsed;
    for (let day = 1; day <= remainingCells; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.innerHTML = `<span class="calendar-day-number">${day}</span>`;
      calendarGrid.appendChild(cell);
    }

  } catch (error) {
    console.error('Failed to render leave calendar:', error.message);
    calendarGrid.innerHTML = '<div class="col-12 text-center text-danger py-4">Failed to load calendar events.</div>';
  }
}

/**
 * Navigates forward or backward in months.
 * 
 * @param {number} direction - -1 to go back, 1 to go forward
 */
function changeCalendarMonth(direction) {
  currentCalDate.setMonth(currentCalDate.getMonth() + direction);
  renderLeaveCalendar();
}

// Bind navigation globally
window.changeCalendarMonth = changeCalendarMonth;
