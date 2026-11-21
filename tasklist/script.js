/**
 * script.js — Task List Application
 * -------------------------------------------------
 * Features:
 *   - CRUD: Create, Read, Update, Delete tasks
 *   - Toggle task status: Active <-> Completed
 *   - Filter tasks: All | Active | Completed
 *   - Persistent storage via localStorage
 *   - Edit modal with keyboard support (Escape to close)
 * -------------------------------------------------
 */

// ============================================================
// STATE
// ============================================================

/** @type {{ id: string, title: string, completed: boolean }[]} */
let tasks = [];

/** @type {'all' | 'active' | 'completed'} */
let currentFilter = 'all';

/** ID of the task currently being edited (null when modal is closed) */
let editingTaskId = null;

// ============================================================
// DOM REFERENCES
// ============================================================

const taskForm          = document.getElementById('task-form');
const taskInput         = document.getElementById('task-input');
const inputError        = document.getElementById('input-error');
const taskList          = document.getElementById('task-list');
const emptyState        = document.getElementById('empty-state');
const emptyMessage      = document.getElementById('empty-message');
const taskCounter       = document.getElementById('task-counter');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const filterBtns        = document.querySelectorAll('.filter-btn');

const editModal         = document.getElementById('edit-modal');
const editInput         = document.getElementById('edit-input');
const editError         = document.getElementById('edit-error');
const editSaveBtn       = document.getElementById('edit-save');
const editCancelBtn     = document.getElementById('edit-cancel');

// ============================================================
// PERSISTENCE: localStorage helpers
// ============================================================

/** Load tasks array from localStorage (returns [] if nothing saved). */
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem('tl_tasks')) || [];
  } catch {
    return [];
  }
}

/** Persist the current tasks array to localStorage. */
function saveTasks() {
  localStorage.setItem('tl_tasks', JSON.stringify(tasks));
}

// ============================================================
// UTILITY
// ============================================================

/** Generate a simple unique ID using timestamp + random suffix. */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Escape HTML entities to prevent XSS when injecting task titles. */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// RENDER
// ============================================================

/**
 * Return tasks filtered by the current filter value.
 * @returns {{ id: string, title: string, completed: boolean }[]}
 */
function getFilteredTasks() {
  if (currentFilter === 'active')    return tasks.filter(t => !t.completed);
  if (currentFilter === 'completed') return tasks.filter(t =>  t.completed);
  return tasks; // 'all'
}

/**
 * Build the HTML for a single task item <li>.
 * @param {{ id: string, title: string, completed: boolean }} task
 * @returns {string}
 */
function createTaskHTML(task) {
  const titleClass = task.completed ? 'task-title-completed' : '';
  const checkedAttr = task.completed ? 'checked' : '';

  return `
    <li
      class="task-item flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 group"
      data-id="${task.id}"
      role="listitem"
    >
      <!-- Toggle completed checkbox -->
      <input
        type="checkbox"
        class="task-checkbox"
        aria-label="Mark '${escapeHTML(task.title)}' as ${task.completed ? 'active' : 'completed'}"
        ${checkedAttr}
      />

      <!-- Task title -->
      <span class="flex-1 text-sm text-slate-700 leading-snug break-words min-w-0 ${titleClass}">
        ${escapeHTML(task.title)}
      </span>

      <!-- Action buttons (visible on hover / always on mobile) -->
      <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
        <!-- Edit button -->
        <button class="action-btn btn-edit" data-action="edit" aria-label="Edit task '${escapeHTML(task.title)}'">
          <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                 m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <!-- Delete button -->
        <button class="action-btn btn-delete" data-action="delete" aria-label="Delete task '${escapeHTML(task.title)}'">
          <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
                 m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  `;
}

/** Re-render the task list and update counter / empty state. */
function render() {
  const filtered = getFilteredTasks();

  // Inject task items
  taskList.innerHTML = filtered.map(createTaskHTML).join('');

  // Empty state visibility
  if (filtered.length === 0) {
    emptyState.classList.add('show');
    emptyMessage.textContent = currentFilter === 'all'
      ? 'No tasks yet. Add one above!'
      : currentFilter === 'active'
        ? 'No active tasks.'
        : 'No completed tasks.';
  } else {
    emptyState.classList.remove('show');
  }

  // Counter: count active (non-completed) tasks from full list
  const activeCount    = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t =>  t.completed).length;
  const totalCount     = tasks.length;

  taskCounter.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''} remaining`;

  // Update filter tab labels with counts
  document.getElementById('tab-label-all').textContent       = `All (${totalCount})`;
  document.getElementById('tab-label-active').textContent    = `Active (${activeCount})`;
  document.getElementById('tab-label-completed').textContent = `Completed (${completedCount})`;

  // Clear completed button: disabled if nothing to clear
  const hasCompleted = completedCount > 0;
  clearCompletedBtn.disabled = !hasCompleted;
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Create: add a new task to the list.
 * @param {string} title
 */
function addTask(title) {
  const trimmed = title.trim();
  if (!trimmed) return;

  tasks.unshift({ id: generateId(), title: trimmed, completed: false });
  saveTasks();
  render();
}

/**
 * Update (Edit): update task title by ID.
 * @param {string} id
 * @param {string} newTitle
 */
function updateTask(id, newTitle) {
  const trimmed = newTitle.trim();
  if (!trimmed) return;

  tasks = tasks.map(t => t.id === id ? { ...t, title: trimmed } : t);
  saveTasks();
  render();
}

/**
 * Delete: remove a task by ID.
 * @param {string} id
 */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

/**
 * Toggle: flip the completed status of a task by ID.
 * @param {string} id
 */
function toggleTask(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveTasks();
  render();
}

/** Delete all tasks that are marked completed. */
function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
}

// ============================================================
// MODAL HELPERS
// ============================================================

/** Open the edit modal pre-filled with the task's current title. */
function openEditModal(task) {
  editingTaskId   = task.id;
  editInput.value = task.title;
  editError.classList.add('hidden');
  editModal.classList.remove('hidden');
  // Focus the input after the modal is visible
  requestAnimationFrame(() => editInput.focus());
}

/** Close the edit modal and reset state. */
function closeEditModal() {
  editModal.classList.add('hidden');
  editingTaskId   = null;
  editInput.value = '';
  editError.classList.add('hidden');
}

// ============================================================
// FILTER HELPERS
// ============================================================

/**
 * Switch active filter and update tab styling.
 * @param {'all' | 'active' | 'completed'} filter
 */
function setFilter(filter) {
  currentFilter = filter;

  filterBtns.forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active-filter');
    } else {
      btn.classList.remove('active-filter');
    }
  });

  render();
}

// ============================================================
// INPUT VALIDATION
// ============================================================

/** Show an inline error under the add-task input. */
function showInputError(msg) {
  inputError.textContent = msg;
  inputError.classList.remove('hidden');
}

/** Hide the inline error under the add-task input. */
function hideInputError() {
  inputError.classList.add('hidden');
  inputError.textContent = '';
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// --- Add task form submit ---
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = taskInput.value;

  if (!value.trim()) {
    showInputError('Task title cannot be empty.');
    taskInput.focus();
    return;
  }

  hideInputError();
  addTask(value);
  taskInput.value = '';
  taskInput.focus();
});

// Clear error when user starts typing again
taskInput.addEventListener('input', hideInputError);

// --- Task list: delegate clicks for checkbox, edit, delete ---
taskList.addEventListener('click', (e) => {
  // Walk up to the <li> to get the task ID
  const li = e.target.closest('[data-id]');
  if (!li) return;
  const id = li.dataset.id;

  // Checkbox toggle
  if (e.target.classList.contains('task-checkbox')) {
    toggleTask(id);
    return;
  }

  // Action buttons
  const action = e.target.closest('[data-action]')?.dataset?.action;
  if (action === 'edit') {
    const task = tasks.find(t => t.id === id);
    if (task) openEditModal(task);
  } else if (action === 'delete') {
    deleteTask(id);
  }
});

// --- Filter buttons ---
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// --- Clear completed ---
clearCompletedBtn.addEventListener('click', clearCompleted);

// --- Edit modal: Save ---
editSaveBtn.addEventListener('click', () => {
  const value = editInput.value;

  if (!value.trim()) {
    editError.textContent = 'Task title cannot be empty.';
    editError.classList.remove('hidden');
    editInput.focus();
    return;
  }

  updateTask(editingTaskId, value);
  closeEditModal();
});

// --- Edit modal: Cancel ---
editCancelBtn.addEventListener('click', closeEditModal);

// --- Edit modal: close on backdrop click ---
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// --- Edit modal: close on Escape key ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editingTaskId) closeEditModal();
});

// --- Edit modal: save on Enter key ---
editInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') editSaveBtn.click();
});

// ============================================================
// INIT
// ============================================================

/** Bootstrap the app: load from storage, set default filter, render. */
function init() {
  tasks = loadTasks();
  setFilter('all'); // also triggers render()
}

init();
