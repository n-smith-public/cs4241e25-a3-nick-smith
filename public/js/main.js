// FRONT-END (CLIENT) JAVASCRIPT HERE

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

let selectedTasks = new Set();
let loadedTasks = [];

const submit = async function( event ) {
  // stop form submission from trying to load
  // a new .html page for displaying results...
  // this was the original browser behavior and still
  // remains to this day
  event.preventDefault()
  
  const data = {
    taskName: document.querySelector("#taskName").value,
    taskDescription: document.querySelector("#taskDescription").value,
    taskDueDate: document.querySelector("#taskDueDate").value,
    taskPriority: document.querySelector("#taskPriority").value,
    taskDeadline: null,
  };

  const body = JSON.stringify(data);
  console.log("Task submission collected");

  const response = await fetch( "/submit", {
    method:"POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  })

  const result = await response.json();
  console.log(result);
  // I used this library on a previous project for multiple notifications. I prefer it to using standard web alerts.
  swal("Task Submitted", "Your task has been successfully submitted!", "success")
  .then(() => {
    // Sends the user to the task list page
    toTasks();
  });
  // Reset the form after each submission
  document.getElementById("taskForm").reset();
  console.log("Form reset");
}

// As said above, sends the user to the task list page
function toTasks() {
  window.location.href = "/tasks";
}

// This is used to calculate the deadline of each task in a map. Needs to be global.
const deadlineMap = {};

// Loads in tasks for the task list page
const loadTasks = async function() {
  // Call the entries endpoint, and store them in the tasks constant.
  const response = await fetch("/entries");
  const tasks = await response.json();

  // The valid priority levels. Used to sort tasks by priority.
  const priorityValue = { High: 3, Medium: 2, Low: 1, past: 0 };
  // Sorts the task by priority, then by due date.
  tasks.sort((a, b) => {
    const prioA = priorityValue[(a.taskPriority || '').toLowerCase()] || 0;
    const prioB = priorityValue[(b.taskPriority || '').toLowerCase()] || 0;
    const prioDiff = prioA - prioB;
    // If there is a priority difference, return that.
    if (prioDiff !== 0) return prioDiff;
    // Otherwise, sort by due date difference.
    const aDue = new Date(a.taskDueDate).getTime();
    const bDue = new Date(b.taskDueDate).getTime();
    return aDue - bDue;
  })

  // Clear the task list on loading the page
  const taskList = document.querySelector("#taskTableBody");
  taskList.innerHTML = "";

  // For each task, add a new row to the table with the appropriate data.
  tasks.forEach(entry => {
    const row = document.createElement("tr");

    // If the task is due within one day (and is not marked as completed), add the "urgent" class which highlights it in the accent colour.
    if (entry.taskDeadline && (entry.taskDeadline.days < 1) && !entry.completed) {
      row.classList.add("urgent");
    }

    let priorityText = entry.taskPriority;
    // If the task is completed, change the "past" level to say "Completed".
    if (entry.completed || entry.taskPriority === "past") priorityText = "Completed";

    // Set the HTML for the row. Deadlines are in British format (DD/MM/YYYY). The deadline is passed as an attribute as it is updated dynamically. The checkbox is created here for completion.
    row.innerHTML = `
      <td><input type="checkbox" class="select-task" data-id="${entry.id}"></td>
      <td>${entry.taskName}</td>
      <td>${entry.taskDescription}</td>
      <td>${entry.taskDueDate ? new Date(entry.taskDueDate).toLocaleString("en-GB") : ""}</td>
      <td>${priorityText}</td>
      <td class="deadline" data-id="${entry.id}"></td>
    `;

    // Add the row to the task list table.
    taskList.appendChild(row);
  });

  loadedTasks = tasks;
  
  document.querySelectorAll(".select-task").forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const id = this.getAttribute("data-id");
      if (this.checked) { selectedTasks.add(id); }
      else { selectedTasks.delete(id); }
      updateActionMenu();
    });
  });

  // Checks if a task has been checked off as completed/incomplete, and updates the data appropriately.
  completionStatus();

  // Updates the deadline map setup earlier with the due date of each task by its ID.
  tasks.forEach(entry => {
    deadlineMap[entry.id] = entry.taskDueDate;
  })

  // Create an interval of 1 second to update the deadlines dynamically.
  updateDeadlines();
  if (window.countdownInterval) clearInterval(window.countdownInterval);
  window.countdownInterval = setInterval(updateDeadlines, 1000);
}

function updateActionMenu() {
  const menu = document.getElementById("actionMenu");
  const editBtn = document.getElementById("editBtn");
  if (selectedTasks.size > 0) {
    menu.style.display = "flex";
    editBtn.style.display = selectedTasks.size === 1 ? "inline-block" : "none";
  } else {
    menu.style.display = "none";
  }
};

function completionStatus() {
  document.querySelectorAll(".complete-task").forEach(checkbox => {
    checkbox.addEventListener("change", async function () {
      // Get the ID of the task
      const id = this.getAttribute("data-id");
      // Gets whether the task is now completed or incomplete
      const completed = this.checked;
      // Send a POST request to the /complete endpoint
      await fetch("/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, completed })
      });
      // Reload the task list.
      loadTasks().then(() => {
        // If the task is now completed, show a success alert. Otherwise, no alert.
        if (completed) swal("Task Updated", "The task has been marked as completed!", "success");
      });
    });
  });
}

// Calculates and updates the deadlines for each task in the task list.
function updateDeadlines() {
  // Get the deadline column, and iterate through each cell
  document.querySelectorAll(".deadline").forEach(cell => {
    // Get the ID of the task
    const id = cell.getAttribute("data-id");
    // Get the due date from the deadline map using the ID above
    const dueDate = deadlineMap[id];
    // If there is no due date (impossible), return early.
    if (!dueDate) return;

    // Calculate the difference between the current time and the due date
    const now = new Date();
    const deadline = new Date(dueDate);
    let diff = deadline - now;
    if (diff < 0) diff = 0;

    // Calculate the number of days, hours, minutes, and seconds left
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Create the text to display in the cell based on the time left
    let text = "";
    if (days > 0) text = `${days} day${days !== 1 ? "s" : ""} left`;
    else if (hours > 0) text = `${hours} hour${hours !== 1 ? "s" : ""} and ${minutes} minute${minutes !== 1 ? "s" : ""} left`;
    else if (minutes > 0) text = `${minutes} minute${minutes !== 1 ? "s" : ""} left`;
    else text = `${seconds} second${seconds !== 1 ? "s" : ""} left`;

    // Sets the content of the deadline cell based on the above calculations
    cell.textContent = text;
  });
}

// On loading a page, run the following code
window.onload = function() {
  // The following is used to prevent tasks from being created with a due date in the past.
  const today = new Date();
  // This ensures that the date input is always the correct number of zeros (aka adds leading zeros as needed).
  const pad = n => n.toString().padStart(2, '0');
  // Parse the date object into a string in the YYYY-MM-DDTHH:MM format
  const localNow = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${pad(today.getHours())}:${pad(today.getMinutes())}`;
  const dueDateInput = document.querySelector("#taskDueDate");
  // If there is a due date option in the task form.
  if (dueDateInput) {
    // Set the minimum attribute to the localNow time setup above
    dueDateInput.setAttribute("min", localNow);

    // This adds a custom validity which localises the error message. Otherwise, it would say the localNow string which is not user-friendly.
    // I did have to look up how to do this, as it was not in any of our readings.
    dueDateInput.addEventListener("invalid", function(event) {
      // If it's an underflow (aka in the past)
      if (dueDateInput.validity.rangeUnderflow) {
        dueDateInput.setCustomValidity("Please select a date in the future.");
      } else {
        // Otherwise, it should be valid, thus blank.
        dueDateInput.setCustomValidity("");
      }
    });

    // Resets the validity message on a valid input
    dueDateInput.addEventListener("input", function(event) {
      dueDateInput.setCustomValidity("");
    });
  }

  // This enables the user to submit tasks via the "Add Task" button
  const form = document.querySelector("#taskForm");
  if (form) {
    form.addEventListener("submit", submit);
  }

  // This enables the user to look at tasks in the task list page
  const taskPage = document.getElementById("taskList");
  if (taskPage) {
    loadTasks().then();
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const editBtn = document.getElementById("editBtn");
  if (editBtn) {
    editBtn.addEventListener("click", function() {
      if (selectedTasks.size !== 1) return;
      const id = Array.from(selectedTasks)[0];
      const task = loadedTasks.find(t => t.id === id);
      if (!task) return;

      // Populate the modal
      document.getElementById('editTaskName').value = task.taskName;
      document.getElementById('editTaskDescription').value = task.taskDescription;
      document.getElementById('editTaskDueDate').value = task.taskDueDate ? new Date(task.taskDueDate).toISOString().slice(0,16) : '';
      document.getElementById('editTaskPriority').value = task.taskPriority.toLowerCase();

      document.getElementById('editModal').style.display = 'flex';

      document.getElementById('editTaskForm').setAttribute("data-id", id);

      document.getElementById('cancelEditBtn').onclick = function() {
        document.getElementById('editModal').style.display = 'none';
      }
    });
  };

  const editTaskForm = document.getElementById('editTaskForm');
  if (editTaskForm) {
    editTaskForm.onsubmit = async function(e) {
      e.preventDefault();

      const id = this.getAttribute("data-id");
      const updatedTask = {
        id,
        taskName: document.getElementById('editTaskName').value,
        taskDescription: document.getElementById('editTaskDescription').value,
        taskDueDate: document.getElementById('editTaskDueDate').value,
        taskPriority: document.getElementById('editTaskPriority').value
      };

      await fetch('/editTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedTask)
      });
      document.getElementById('editModal').style.display = 'none';
      selectedTasks.clear();
      updateActionMenu();
      loadTasks();
    }
  }

  const markCompleteBtn = document.getElementById("markCompleteBtn");
  if (markCompleteBtn) {
    markCompleteBtn.addEventListener("click", async function() {
      if (selectedTasks.size === 0) return;
      const allCompleted = Array.from(selectedTasks).every(id => {
        const task = loadedTasks.find(t => t.id === id);
        return task && task.completed;
      });
     for (const id of selectedTasks) {
      await fetch('/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, completed: !allCompleted })
      });
     }
     selectedTasks.clear();
     updateActionMenu();
     loadTasks();
      swal("Tasks Updated", allCompleted ? "Selected tasks have been marked as incomplete!" : "Selected tasks have been marked as completed!", "success");
    });
  };

  const deleteBtn = document.getElementById("deleteBtn");
  const deleteModal = document.getElementById("deleteModal");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

  if (deleteBtn && confirmDeleteBtn && cancelDeleteBtn && deleteModal) {
    deleteBtn.addEventListener("click", function() {
      deleteModal.style.display = 'flex';
    });

    cancelDeleteBtn.addEventListener("click", function() {
      deleteModal.style.display = 'none';
    });

    confirmDeleteBtn.addEventListener("click", async function() {
      const ids = Array.from(selectedTasks);
      await fetch('/deleteTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids })
      });
      deleteModal.style.display = 'none';
      selectedTasks.clear();
      updateActionMenu();
      loadTasks();
      swal("Tasks Deleted", "The selected tasks have been deleted!", "success");
    });
  }

  const selectAll = document.getElementById("selectAll");
  if (selectAll) {
    selectAll.addEventListener("change", function() {
      const checkboxes = document.querySelectorAll(".select-task");
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        const id = checkbox.getAttribute("data-id");
        if (selectAll.checked) {
          selectedTasks.add(id);
        } else {
          selectedTasks.delete(id);
        }
      });
      updateActionMenu();
    });
  }
});