// ── Supabase ──
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Levels ──
const LEVELS = [
  { level: 1, name: 'Beginner', xp: 0 },
  { level: 2, name: 'Learner', xp: 100 },
  { level: 3, name: 'Thinker', xp: 200 },
  { level: 4, name: 'Explorer', xp: 300 },
  { level: 5, name: 'Builder', xp: 500 },
  { level: 6, name: 'Creator', xp: 750 },
  { level: 7, name: 'Achiever', xp: 1100 },
  { level: 8, name: 'Expert', xp: 1600 },
  { level: 9, name: 'Master', xp: 2200 },   
  { level: 10, name: 'Legend', xp: 3000 },
];

const REPEAT_LABELS = {
  none: 'No repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const AI_ADDON_DISMISS_KEY = 'focusup-ai-addon-dismissed';
const DASHBOARD_SETTINGS_KEY = 'focusup-dashboard-settings';
const DASHBOARD_SECTION_DEFS = [
  { key: 'hero', label: 'Hero overview' },
  { key: 'activeMetric', label: 'Active tasks metric' },
  { key: 'scheduledMetric', label: 'Scheduled metric' },
  { key: 'focusMetric', label: 'Focus metric' },
  { key: 'streakMetric', label: 'Streak metric' },
  { key: 'coach', label: 'Coach cards' },
  { key: 'score', label: 'Daily score' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'alerts', label: 'Coach alerts' },
  { key: 'tools', label: 'Lock in tools' },
  { key: 'snapshot', label: 'Today snapshot' },
  { key: 'focus', label: 'Focus momentum' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'birthdays', label: 'Birthday radar' },
];
const DASHBOARD_METRIC_KEYS = ['activeMetric', 'scheduledMetric', 'focusMetric', 'streakMetric'];
const DASHBOARD_TEMPLATES = [
  {
    key: 'balanced',
    label: 'Casual',
    description: 'The original relaxed dashboard.',
    sections: ['hero', 'activeMetric', 'scheduledMetric', 'focusMetric', 'streakMetric', 'coach', 'score', 'roadmap', 'alerts', 'tools', 'snapshot', 'focus', 'upcoming', 'birthdays'],
  },
  {
    key: 'work',
    label: 'Work',
    description: 'Priorities, schedule, and blockers.',
    sections: ['hero', 'activeMetric', 'scheduledMetric', 'focusMetric', 'coach', 'score', 'roadmap', 'alerts', 'tools', 'snapshot', 'focus', 'upcoming'],
  },
  {
    key: 'sport',
    label: 'Sport',
    description: 'Momentum, sessions, streak, and next action.',
    sections: ['hero', 'focusMetric', 'streakMetric', 'coach', 'score', 'tools', 'focus', 'roadmap', 'upcoming'],
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Only the essentials.',
    sections: ['hero', 'activeMetric', 'focusMetric', 'coach', 'snapshot', 'focus'],
  },
  {
    key: 'planning',
    label: 'Planning',
    description: 'Roadmap, upcoming tasks, and calendar-heavy view.',
    sections: ['hero', 'activeMetric', 'scheduledMetric', 'coach', 'roadmap', 'alerts', 'snapshot', 'upcoming', 'birthdays'],
  },
];

// ── State ──
let currentUser = null;
let state = defaultState();
let saveTimeout = null;
const isDemoMode = new URLSearchParams(window.location.search).get('demo') === '1';
let selectedDate = getTodayISO();
let calendarMonth = startOfMonth(selectedDate);
let editingTaskId = null;
let dashboardSettings = loadDashboardSettings();

function defaultState() {
  return {
    tasks: [
      createTask({
        id: 1,
        name: 'Finish homework',
        priority: 'high',
        done: false,
        scheduledFor: getTodayISO(),
        scheduledTime: '16:00',
        repeat: 'none',
        completedDates: [],
        kind: 'task',
      }),
      createTask({
        id: 2,
        name: 'Practice coding',
        priority: 'medium',
        done: false,
        scheduledFor: getTodayISO(),
        scheduledTime: '18:30',
        repeat: 'daily',
        completedDates: [],
        kind: 'task',
      }),
      createTask({
        id: 3,
        name: 'Read for 20 mins',
        priority: 'low',
        done: true,
        scheduledFor: addDays(getTodayISO(), -1),
        scheduledTime: '20:00',
        repeat: 'none',
        completedDates: [],
        kind: 'task',
      }),
      createTask({
        id: 4,
        name: 'Emma birthday',
        priority: 'low',
        done: false,
        scheduledFor: addDays(getTodayISO(), 7),
        scheduledTime: '',
        repeat: 'yearly',
        completedDates: [],
        kind: 'birthday',
      }),
    ],
    xp: 0,
    streak: 0,
    tasksDone: 0,
    sessions: 0,
    minsFocused: 0,
    lastDate: new Date().toDateString(),
  };
}

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(isoDate) {
  return `${isoDate.slice(0, 7)}-01`;
}

function startOfWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function makeTaskId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function createTask(task = {}) {
  const timestamp = task.updatedAt || nowIso();
  return {
    id: task.id ?? makeTaskId(),
    name: task.name || '',
    priority: task.priority || 'medium',
    done: Boolean(task.done),
    scheduledFor: task.scheduledFor || '',
    scheduledUntil: task.scheduledUntil || '',
    scheduledTime: task.scheduledTime || '',
    repeat: task.repeat || 'none',
    completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
    kind: task.kind || 'task',
    updatedAt: timestamp,
  };
}

function touchTask(task, updates = {}) {
  Object.assign(task, updates, { updatedAt: nowIso() });
  return task;
}

function normalizeTask(task) {
  return createTask(task);
}

function formatTaskSchedule(task) {
  if (!task.scheduledFor) return 'No date';
  const date = new Date(`${task.scheduledFor}T12:00:00`);
  const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endDateLabel = task.scheduledUntil && task.scheduledUntil !== task.scheduledFor
    ? new Date(`${task.scheduledUntil}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  if (task.kind === 'birthday') {
    return `${dateLabel} • Birthday`;
  }
  const dateRange = endDateLabel ? `${dateLabel} – ${endDateLabel}` : dateLabel;
  const base = task.scheduledTime ? `${dateRange} at ${task.scheduledTime}` : dateRange;
  return task.repeat && task.repeat !== 'none' ? `${base} • ${REPEAT_LABELS[task.repeat]}` : base;
}

function formatMonthDay(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDisplayName(task) {
  return task.kind === 'birthday' ? task.name.replace(/ birthday$/i, '') : task.name;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultDashboardSections() {
  return DASHBOARD_TEMPLATES[0].sections;
}

function normalizeDashboardSections(sections) {
  const allowed = new Set(DASHBOARD_SECTION_DEFS.map(section => section.key));
  if (!Array.isArray(sections)) return getDefaultDashboardSections();
  return Array.from(new Set(sections.filter(key => allowed.has(key))));
}

function getDashboardEditorOrder() {
  const picker = document.getElementById('dashboard-section-picker');
  if (!picker) return DASHBOARD_SECTION_DEFS.map(section => section.key);
  return Array.from(picker.querySelectorAll('[data-dashboard-section-key]'))
    .map(element => element.dataset.dashboardSectionKey)
    .filter(Boolean);
}

function getDashboardOrderedSections(includeHidden = false) {
  const visibleOrder = normalizeDashboardSections(dashboardSettings.sections);
  if (!includeHidden) return visibleOrder;

  const storedOrder = normalizeDashboardSections(dashboardSettings.order);
  const baseOrder = storedOrder.length ? storedOrder : visibleOrder;
  const used = new Set(baseOrder);
  return [
    ...baseOrder,
    ...DASHBOARD_SECTION_DEFS.map(section => section.key).filter(key => !used.has(key)),
  ];
}

function loadDashboardSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_SETTINGS_KEY) || '{}');
    return {
      template: saved.template || 'balanced',
      sections: normalizeDashboardSections(saved.sections),
      order: getDashboardSettingsOrder(saved),
    };
  } catch (error) {
    return {
      template: 'balanced',
      sections: getDefaultDashboardSections(),
      order: getDefaultDashboardSections(),
    };
  }
}

function getDashboardSettingsOrder(saved) {
  const savedOrder = Array.isArray(saved?.order) ? normalizeDashboardSections(saved.order) : [];
  if (savedOrder.length) return savedOrder;

  const savedSections = Array.isArray(saved?.sections) ? normalizeDashboardSections(saved.sections) : [];
  if (savedSections.length) return savedSections;

  return getDefaultDashboardSections();
}

function saveDashboardSettings() {
  localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(dashboardSettings));
}

function getDashboardVisibleSet() {
  return new Set(normalizeDashboardSections(dashboardSettings.sections));
}

function applyDashboardLayout() {
  const tab = document.getElementById('tab-dashboard');
  const visible = getDashboardVisibleSet();
  const isCasualTemplate = dashboardSettings.template === 'balanced';
  const order = isCasualTemplate
    ? [
      ...getDefaultDashboardSections(),
      ...DASHBOARD_SECTION_DEFS.map(section => section.key).filter(key => !getDefaultDashboardSections().includes(key)),
    ]
    : getDashboardOrderedSections(true);
  const orderIndex = key => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };

  if (tab) {
    tab.dataset.dashboardTemplate = dashboardSettings.template || 'balanced';
  }

  const metricGrid = document.querySelector('[data-dashboard-section="metrics"]');
  if (metricGrid) {
    const visibleMetricKeys = DASHBOARD_METRIC_KEYS.filter(key => visible.has(key));
    metricGrid.classList.toggle('dashboard-section-hidden', !visibleMetricKeys.length);
    metricGrid.style.order = String(20 + (visibleMetricKeys.length ? Math.min(...visibleMetricKeys.map(orderIndex)) : order.length));
  }

  const panelKeys = DASHBOARD_SECTION_DEFS
    .map(section => section.key)
    .filter(key => !['hero', 'coach', ...DASHBOARD_METRIC_KEYS].includes(key));
  const panelGrid = document.querySelector('.dashboard-panels');
  if (panelGrid) {
    const visiblePanelKeys = panelKeys.filter(key => visible.has(key));
    panelGrid.classList.toggle('dashboard-section-hidden', !visiblePanelKeys.length);
    panelGrid.style.order = String(20 + (visiblePanelKeys.length ? Math.min(...visiblePanelKeys.map(orderIndex)) : order.length));
  }

  DASHBOARD_SECTION_DEFS.forEach(section => {
    document.querySelectorAll(`[data-dashboard-section="${section.key}"]`).forEach(element => {
      element.classList.toggle('dashboard-section-hidden', !visible.has(section.key));
      element.style.order = String(20 + orderIndex(section.key));
    });
  });
}

function renderDashboardEditor() {
  const templateRow = document.getElementById('dashboard-template-row');
  const picker = document.getElementById('dashboard-section-picker');
  if (!templateRow || !picker) return;

  const visible = getDashboardVisibleSet();
  templateRow.innerHTML = DASHBOARD_TEMPLATES.map(template => `
    <button class="dashboard-template-btn ${dashboardSettings.template === template.key ? 'active' : ''}" type="button" data-dashboard-template="${template.key}">
      <span>${escapeHtml(template.label)}</span>
      <small>${escapeHtml(template.description)}</small>
    </button>
  `).join('');

  picker.innerHTML = getDashboardOrderedSections(true).map(key => {
    const section = DASHBOARD_SECTION_DEFS.find(item => item.key === key);
    if (!section) return '';
    return `
    <label class="dashboard-section-option" draggable="true" data-dashboard-section-key="${section.key}">
      <span class="dashboard-drag-handle" aria-hidden="true">::</span>
      <input type="checkbox" value="${section.key}" ${visible.has(section.key) ? 'checked' : ''} />
      <span>${escapeHtml(section.label)}</span>
    </label>
  `;
  }).join('');
}

function setDashboardEditorOpen(open) {
  const editor = document.getElementById('dashboard-editor');
  const button = document.getElementById('dashboard-edit-btn');
  if (!editor || !button) return;
  editor.classList.toggle('hidden', !open);
  button.classList.toggle('active', open);
  button.setAttribute('aria-expanded', String(open));
  button.textContent = open ? 'Done' : 'Edit';
}

function applyDashboardTemplate(templateKey) {
  const template = DASHBOARD_TEMPLATES.find(item => item.key === templateKey) || DASHBOARD_TEMPLATES[0];
  dashboardSettings = {
    template: template.key,
    sections: [...template.sections],
    order: [
      ...template.sections,
      ...DASHBOARD_SECTION_DEFS.map(section => section.key).filter(key => !template.sections.includes(key)),
    ],
  };
  saveDashboardSettings();
  renderDashboardEditor();
  applyDashboardLayout();
  showToast(`${template.label} template applied`);
}

function toggleDashboardSection(sectionKey, checked) {
  const currentOrder = getDashboardEditorOrder();
  const visible = getDashboardVisibleSet();

  dashboardSettings = {
    template: 'custom',
    sections: currentOrder.filter(key => key === sectionKey ? checked : visible.has(key)),
    order: currentOrder,
  };
  saveDashboardSettings();
  renderDashboardEditor();
  applyDashboardLayout();
}

function moveDashboardSection(sectionKey, targetKey) {
  if (!sectionKey || !targetKey || sectionKey === targetKey) return;

  const currentOrder = getDashboardEditorOrder();
  const fromIndex = currentOrder.indexOf(sectionKey);
  const toIndex = currentOrder.indexOf(targetKey);
  if (fromIndex === -1 || toIndex === -1) return;

  currentOrder.splice(fromIndex, 1);
  currentOrder.splice(toIndex, 0, sectionKey);

  const visible = getDashboardVisibleSet();
  dashboardSettings = {
    template: 'custom',
    sections: normalizeDashboardSections(currentOrder.filter(key => visible.has(key))),
    order: currentOrder,
  };
  saveDashboardSettings();
  renderDashboardEditor();
  applyDashboardLayout();
}

function getNextOccurrenceDate(task, fromDate = getTodayISO()) {
  if (!task.scheduledFor) return '';
  if (task.kind === 'birthday' || task.repeat === 'yearly') {
    const base = new Date(`${task.scheduledFor}T12:00:00`);
    const from = new Date(`${fromDate}T12:00:00`);
    let candidate = new Date(from.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    if (candidate < from) {
      candidate = new Date(from.getFullYear() + 1, base.getMonth(), base.getDate(), 12, 0, 0);
    }
    return candidate.toISOString().slice(0, 10);
  }
  return task.scheduledFor;
}

function formatLongDate(isoDate) {
  if (!isoDate) return 'No date selected';
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeLabel(time) {
  if (!time) return 'any time';
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDayDistanceLabel(isoDate, fromDate = getTodayISO()) {
  const start = new Date(`${fromDate}T12:00:00`);
  const target = new Date(`${isoDate}T12:00:00`);
  const diff = Math.round((target - start) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return 'Yesterday';
  return `${Math.abs(diff)} days ago`;
}

function normalizeRoutineKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getUpcomingWeekdays(limit = 5, fromDate = getTodayISO()) {
  const dates = [];
  const cursor = new Date(`${fromDate}T12:00:00`);
  while (dates.length < limit) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function buildRoutineSuggestions() {
  const routineMap = new Map();
  state.tasks
    .filter(task => task.kind === 'task' && task.scheduledFor)
    .forEach(task => {
      const key = `${normalizeRoutineKey(task.name)}__${task.scheduledTime || ''}`;
      if (!routineMap.has(key)) {
        routineMap.set(key, {
          name: task.name.trim(),
          scheduledTime: task.scheduledTime || '',
          count: 0,
          repeatTypes: new Set(),
          weekdayHits: new Set(),
        });
      }

      const entry = routineMap.get(key);
      entry.count += 1;
      if (task.repeat && task.repeat !== 'none') {
        entry.repeatTypes.add(task.repeat);
      }
      const weekday = new Date(`${task.scheduledFor}T12:00:00`).getDay();
      if (weekday >= 1 && weekday <= 5) {
        entry.weekdayHits.add(weekday);
      }
    });

  const suggestions = Array.from(routineMap.values())
    .filter(entry => entry.count > 1 || entry.repeatTypes.size > 0)
    .sort((a, b) => {
      const repeatDiff = b.repeatTypes.size - a.repeatTypes.size;
      if (repeatDiff !== 0) return repeatDiff;
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      if (!a.scheduledTime && !b.scheduledTime) return a.name.localeCompare(b.name);
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    })
    .slice(0, 3)
    .map(entry => ({
      ...entry,
      timeLabel: formatTimeLabel(entry.scheduledTime),
      weekdayFriendly: entry.repeatTypes.has('daily') || entry.weekdayHits.size >= 2,
    }));

  return suggestions;
}

function getRoutineSummary(suggestions) {
  if (!suggestions.length) {
    return 'Add a few scheduled tasks with times and repeated plans, and this card will build your usual schedule from your real routine.';
  }

  const fragments = suggestions.map((item, index) => {
    const name = `${item.name} at ${item.timeLabel}`;
    if (index === suggestions.length - 1 && suggestions.length > 1) {
      return `and ${name}`;
    }
    return name;
  });

  return `Your usual schedule is now based on real tasks: ${fragments.join(suggestions.length > 2 ? ', ' : ' ')}.`;
}

function renderAiAddons() {
  const card = document.getElementById('ai-addons-card');
  const copy = document.getElementById('ai-addons-copy');
  const list = document.getElementById('ai-addon-list');
  const weekdayBtn = document.getElementById('ai-weekday-btn');
  if (!card || !copy || !list || !weekdayBtn) return;

  if (localStorage.getItem(AI_ADDON_DISMISS_KEY) === '1') {
    card.style.display = 'none';
    return;
  }

  card.style.display = '';
  const suggestions = buildRoutineSuggestions();
  copy.textContent = getRoutineSummary(suggestions);

  if (!suggestions.length) {
    list.innerHTML = [
      'Schedule tasks with times',
      'Repeat habits daily or weekly',
      'AI will learn your routine',
    ].map(label => `<div class="ai-addon-pill">${escapeHtml(label)}</div>`).join('');
    weekdayBtn.disabled = true;
    weekdayBtn.textContent = 'Use on Weekdays';
    return;
  }

  list.innerHTML = suggestions.map(item => {
    const repeatLabel = item.repeatTypes.size ? Array.from(item.repeatTypes).map(type => REPEAT_LABELS[type]).join(', ') : 'Pattern found';
    return `<div class="ai-addon-pill">${escapeHtml(`${item.name} • ${item.timeLabel} • ${repeatLabel}`)}</div>`;
  }).join('');

  const hasWeekdaySuggestions = suggestions.some(item => item.weekdayFriendly);
  weekdayBtn.disabled = !hasWeekdaySuggestions;
  weekdayBtn.textContent = hasWeekdaySuggestions ? 'Use on Weekdays' : 'Need more weekday data';
}

function applyRoutineSuggestionsToWeekdays() {
  const suggestions = buildRoutineSuggestions().filter(item => item.weekdayFriendly);
  if (!suggestions.length) {
    showToast('Add more weekday schedule data first');
    return;
  }

  const upcomingDates = getUpcomingWeekdays(5);
  let added = 0;

  upcomingDates.forEach(date => {
    suggestions.forEach(item => {
      const exists = state.tasks.some(task => (
        task.kind === 'task'
        && doesTaskOccurOn(task, date)
        && task.scheduledTime === item.scheduledTime
        && normalizeRoutineKey(task.name) === normalizeRoutineKey(item.name)
      ));

      if (exists) return;

      state.tasks.unshift(createTask({
        id: makeTaskId() + added,
        name: item.name,
        priority: 'medium',
        done: false,
        scheduledFor: date,
        scheduledTime: item.scheduledTime,
        repeat: 'none',
        completedDates: [],
        kind: 'task',
      }));
      added += 1;
    });
  });

  if (!added) {
    showToast('Weekday plan already matches your routine');
    return;
  }

  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderAiAddons();
  scheduleSave();
  showToast(`Added ${added} weekday task${added === 1 ? '' : 's'}`);
}

// ── Auth ──
async function initAuth() {
  if (isDemoMode) {
    currentUser = {
      id: 'demo-user',
      email: 'demo@focusup.app',
      user_metadata: { username: 'Demo user' },
    };
    state = {
      ...defaultState(),
      xp: 340,
      streak: 6,
      tasksDone: 12,
      sessions: 8,
      minsFocused: 185,
    };
    document.getElementById('user-name').textContent = 'Demo user';
    document.getElementById('user-avatar').textContent = 'D';
    document.getElementById('mobile-appbar-avatar').textContent = 'D';
    document.getElementById('menu-signout-label').textContent = 'Exit demo';
    document.getElementById('mobile-signout').setAttribute('aria-label', 'Exit demo');
    document.querySelector('.signout-btn').title = 'Exit demo';
    renderAll();
    showToast('Demo mode — changes are not saved');
    return;
  }
  let session = null;
  try {
    ({ data: { session } } = await db.auth.getSession());
  } catch (error) {
    window.location.href = 'auth.html?auth_error=connection';
    return;
  }
  if (!session) { window.location.href = 'auth.html'; return; }
  currentUser = session.user;
  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
  document.getElementById('user-name').textContent = username;
  document.getElementById('user-avatar').textContent = username.charAt(0).toUpperCase();
  document.getElementById('mobile-appbar-avatar').textContent = username.charAt(0).toUpperCase();
  await loadProfile();
  renderAll();
}

async function loadProfile() {
  const { data, error } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error || !data) {
    await db.from('profiles').insert({
      id: currentUser.id,
      username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
      xp: 0, streak: 0, tasks_done: 0, sessions: 0, mins_focused: 0,
      last_date: new Date().toDateString(),
      tasks: defaultState().tasks,
    });
    return;
  }
  const streakChanged = checkStreak(data);
  state = {
    tasks: (data.tasks || defaultState().tasks).map(normalizeTask),
    xp: data.xp || 0,
    streak: data.streak || 0,
    tasksDone: data.tasks_done || 0,
    sessions: data.sessions || 0,
    minsFocused: data.mins_focused || 0,
    lastDate: data.last_date || new Date().toDateString(),
  };
  if (streakChanged) {
    await saveProfile();
  }
}

function checkStreak(data) {
  const today = new Date().toDateString();
  const last = new Date(data.last_date);
  const diff = Math.floor((new Date(today) - last) / 86400000);
  if (diff === 1) {
    data.streak = (data.streak || 0) + 1;
    data.last_date = today;
    return true;
  }
  if (diff > 1) {
    data.streak = 0;
    data.last_date = today;
    return true;
  }
  return false;
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveProfile, 800);
}

function flushSave() {
  clearTimeout(saveTimeout);
  saveTimeout = null;
  void saveProfile();
}

async function saveProfile() {
  if (isDemoMode) return;
  if (!currentUser) return;
  await db.from('profiles').upsert({
    id: currentUser.id,
    username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
    xp: state.xp,
    streak: state.streak,
    tasks_done: state.tasksDone,
    sessions: state.sessions,
    mins_focused: state.minsFocused,
    last_date: state.lastDate,
    tasks: state.tasks,
  });
}

async function handleSignOut() {
  if (isDemoMode) {
    window.location.href = 'auth.html';
    return;
  }
  await db.auth.signOut();
  window.location.href = 'auth.html';
}

// ── XP & Levels ──
function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) { current = LEVELS[i]; next = LEVELS[i + 1] || null; break; }
  }
  const base = current.xp;
  const cap = next ? next.xp : current.xp + 500;
  const pct = Math.min(100, Math.round(((xp - base) / (cap - base)) * 100));
  return { current, next, pct, base, cap };
}

function gainXP(amount) {
  state.xp += amount;
  updateXPUI();
  showToast(`+${amount} XP`);
  scheduleSave();
}

function updateXPUI() {
  const { current, pct, base, cap } = getLevelInfo(state.xp);
  const xpInLevel = state.xp - base;
  const xpNeeded = cap - base;
  document.getElementById('level-badge').textContent = `Lv ${current.level}`;
  document.getElementById('xp-label').textContent = `${xpInLevel} / ${xpNeeded} XP`;
  document.getElementById('xp-fill').style.width = pct + '%';
  document.getElementById('level-name').textContent = current.name;
  document.getElementById('lc-level').textContent = `Level ${current.level} — ${current.name}`;
  document.getElementById('lc-xp').textContent = `${state.xp} XP`;
  document.getElementById('lc-fill').style.width = pct + '%';
  document.querySelector('.level-milestones').innerHTML = `<span>${base} XP</span><span>Next level at ${cap} XP</span>`;
  document.getElementById('s-xp').textContent = state.xp;
  document.getElementById('mobile-level-value').textContent = `Lv ${current.level}`;
  document.getElementById('mobile-xp-value').textContent = `${state.xp} XP`;
  renderDashboard();
}

function renderLevels() {
  const { current } = getLevelInfo(state.xp);
  document.getElementById('levels-items').innerHTML = LEVELS.map(l => `
    <div class="level-row ${l.level === current.level ? 'current' : ''}">
      <span class="level-row-num">Lv${l.level}</span>
      <span class="level-row-name">${l.name}</span>
      <span class="level-row-xp">${l.xp} XP</span>
    </div>
  `).join('');
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('xp-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function updateScheduleToggleUI() {
  const enabled = document.getElementById('schedule-toggle').checked;
  const fields = document.getElementById('schedule-fields');
  fields.classList.toggle('hidden', !enabled);
  fields.closest('.add-task-bar').classList.toggle('is-scheduled', enabled);

  if (enabled && !document.getElementById('task-date').value) {
    document.getElementById('task-date').value = selectedDate;
  }
  document.getElementById('task-end-date').min = document.getElementById('task-date').value;

  const timeInput = document.getElementById('task-time');
  timeInput.closest('.time-field').classList.toggle('has-time', Boolean(timeInput.value));
}

function toggleScheduleQuickAdd(forceOpen) {
  const panel = document.getElementById('schedule-quick-add');
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !shouldOpen);
  if (shouldOpen) {
    const timeInput = document.getElementById('schedule-task-time');
    timeInput.closest('.time-field').classList.toggle('has-time', Boolean(timeInput.value));
    document.getElementById('schedule-end-date').min = selectedDate;
    document.getElementById('schedule-task-input').focus();
  }
}

function addScheduledTaskFromCalendar() {
  const input = document.getElementById('schedule-task-input');
  const timeInput = document.getElementById('schedule-task-time');
  const repeat = document.getElementById('schedule-repeat-select').value;
  const endDate = document.getElementById('schedule-end-date').value;
  const priority = document.getElementById('schedule-priority-select').value;
  const name = input.value.trim();
  if (!name) return;
  if (endDate && endDate < selectedDate) {
    showToast('End date cannot be before start date');
    return;
  }

  state.tasks.unshift(createTask({
    id: makeTaskId(),
    name,
    priority,
    done: false,
    scheduledFor: selectedDate,
    scheduledUntil: endDate,
    scheduledTime: timeInput.value || '',
    repeat,
    completedDates: [],
    kind: 'task',
  }));

  input.value = '';
  document.getElementById('schedule-end-date').value = '';
  timeInput.value = '';
  document.getElementById('schedule-task-time-desktop').value = '';
  timeInput.closest('.time-field').classList.remove('has-time');
  document.getElementById('schedule-repeat-select').value = 'none';
  document.getElementById('schedule-priority-select').value = 'medium';
  toggleScheduleQuickAdd(false);
  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderAiAddons();
  scheduleSave();
}

// ── Tasks ──
function addTask() {
  const input = document.getElementById('task-input');
  const scheduleToggle = document.getElementById('schedule-toggle');
  const dateInput = document.getElementById('task-date');
  const endDateInput = document.getElementById('task-end-date');
  const timeInput = document.getElementById('task-time');
  const repeat = document.getElementById('repeat-select').value;
  const priority = document.getElementById('priority-select').value;
  const name = input.value.trim();
  if (!name) return;
  const startDate = dateInput.value || selectedDate;
  if (scheduleToggle.checked && endDateInput.value && endDateInput.value < startDate) {
    showToast('End date cannot be before start date');
    return;
  }
  state.tasks.unshift(createTask({
    id: makeTaskId(),
    name,
    priority,
    done: false,
    scheduledFor: scheduleToggle.checked ? startDate : '',
    scheduledUntil: scheduleToggle.checked ? endDateInput.value : '',
    scheduledTime: scheduleToggle.checked ? (timeInput.value || '') : '',
    repeat: scheduleToggle.checked ? repeat : 'none',
    completedDates: [],
    kind: 'task',
  }));
  input.value = '';
  dateInput.value = selectedDate;
  endDateInput.value = '';
  timeInput.value = '';
  document.getElementById('task-time-desktop').value = '';
  timeInput.closest('.time-field').classList.remove('has-time');
  document.getElementById('repeat-select').value = 'none';
  scheduleToggle.checked = false;
  updateScheduleToggleUI();
  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderAiAddons();
  scheduleSave();
}

function isTaskDoneOn(task, isoDate = getTodayISO()) {
  if (task.kind === 'birthday') return false;
  if (task.repeat && task.repeat !== 'none') {
    return task.completedDates.includes(isoDate);
  }
  return task.done;
}

function shouldHideTaskFromViews(task, isoDate = getTodayISO()) {
  if (task.kind !== 'task') return false;
  return isTaskDoneOn(task, isoDate);
}

function doesTaskOccurOn(task, isoDate) {
  if (!task.scheduledFor) return false;
  if (isoDate < task.scheduledFor) return false;
  if (task.scheduledUntil && isoDate > task.scheduledUntil) return false;

  if (!task.repeat || task.repeat === 'none') {
    return true;
  }

  const start = new Date(`${task.scheduledFor}T12:00:00`);
  const current = new Date(`${isoDate}T12:00:00`);

  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekly') return start.getDay() === current.getDay();
  if (task.repeat === 'monthly') return start.getDate() === current.getDate();
  if (task.repeat === 'yearly') {
    return start.getDate() === current.getDate() && start.getMonth() === current.getMonth();
  }

  return false;
}

function toggleTask(id, occurrenceDate = getTodayISO()) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  if (t.kind === 'birthday') return;

  if (t.repeat && t.repeat !== 'none') {
    if (!doesTaskOccurOn(t, occurrenceDate)) return;
    const doneForDay = t.completedDates.includes(occurrenceDate);
    touchTask(t, {
      completedDates: doneForDay
      ? t.completedDates.filter(date => date !== occurrenceDate)
      : [...t.completedDates, occurrenceDate],
    });

    if (!doneForDay) {
      state.tasksDone++;
      gainXP(20);
    } else {
      state.tasksDone = Math.max(0, state.tasksDone - 1);
      state.xp = Math.max(0, state.xp - 20);
      updateXPUI();
    }
    document.getElementById('s-done').textContent = state.tasksDone;
  } else {
    touchTask(t, { done: !t.done });
    if (t.done) {
      state.tasksDone++;
      gainXP(20);
      state.tasks = state.tasks.filter(task => task.id !== id);
    } else {
      state.tasksDone = Math.max(0, state.tasksDone - 1);
      state.xp = Math.max(0, state.xp - 20);
      updateXPUI();
    }
    document.getElementById('s-done').textContent = state.tasksDone;
  }

  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderAiAddons();
  flushSave();
}

function deleteTask(id) {
  const taskToDelete = state.tasks.find(t => t.id === id);
  if (!taskToDelete) return;

  state.tasks = state.tasks.filter(t => t.id !== id);
  if (editingTaskId === id) editingTaskId = null;
  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderBirthdays();
  renderAiAddons();
  flushSave();
}

function startEditingTask(id) {
  editingTaskId = id;
  renderSchedule();
}

function cancelEditingTask() {
  editingTaskId = null;
  renderSchedule();
}

function saveTaskFromSchedule(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  const prefix = `schedule-edit-${id}`;
  const name = document.getElementById(`${prefix}-name`).value.trim();
  const date = document.getElementById(`${prefix}-date`).value;
  const endDate = document.getElementById(`${prefix}-end-date`)?.value || '';

  if (!name) {
    showToast('Name is required');
    return;
  }

  if (!date) {
    showToast('Date is required');
    return;
  }
  if (endDate && endDate < date) {
    showToast('End date cannot be before start date');
    return;
  }

  touchTask(task, { scheduledFor: date, scheduledUntil: task.kind === 'birthday' ? '' : endDate });

  if (task.kind === 'birthday') {
    touchTask(task, { name: `${name} birthday` });
  } else {
    touchTask(task, {
      name,
      scheduledTime: document.getElementById(`${prefix}-time`).value,
      priority: document.getElementById(`${prefix}-priority`).value,
      repeat: document.getElementById(`${prefix}-repeat`).value,
    });
  }

  editingTaskId = null;
  selectedDate = date;
  calendarMonth = startOfMonth(date);
  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderBirthdays();
  renderAiAddons();
  scheduleSave();
  showToast('Updated');
}

function promptRequiredValue(message, currentValue, { placeholder = '', validator = null, allowBlank = false } = {}) {
  const initialValue = currentValue || placeholder;
  const value = window.prompt(message, initialValue);
  if (value === null) return null;
  const trimmed = value.trim();
  if (!allowBlank && !trimmed) {
    showToast('Value cannot be empty');
    return null;
  }
  if (validator && trimmed && !validator(trimmed)) {
    showToast('Invalid value');
    return null;
  }
  return trimmed;
}

function editTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  if (task.kind === 'birthday') {
    editBirthday(id);
    return;
  }

  const nextName = promptRequiredValue('Edit task name', task.name);
  if (nextName === null) return;

  const nextDate = promptRequiredValue(
    'Edit date (YYYY-MM-DD). Leave blank to remove the date.',
    task.scheduledFor,
    {
      allowBlank: true,
      validator: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    }
  );
  if (nextDate === null) return;

  const nextEndDate = promptRequiredValue(
    'Edit end date (YYYY-MM-DD). Leave blank for a one-day task.',
    task.scheduledUntil,
    {
      allowBlank: true,
      validator: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    }
  );
  if (nextEndDate === null) return;
  if (nextEndDate && nextEndDate < nextDate) {
    showToast('End date cannot be before start date');
    return;
  }

  const nextTime = promptRequiredValue(
    'Edit time (HH:MM). Leave blank for no time.',
    task.scheduledTime,
    {
      allowBlank: true,
      validator: value => /^\d{2}:\d{2}$/.test(value),
    }
  );
  if (nextTime === null) return;

  const nextPriority = promptRequiredValue(
    'Edit priority: high, medium or low',
    task.priority,
    {
      validator: value => ['high', 'medium', 'low'].includes(value.toLowerCase()),
    }
  );
  if (nextPriority === null) return;

  const nextRepeat = promptRequiredValue(
    'Edit repeat: none, daily, weekly, monthly or yearly',
    task.repeat || 'none',
    {
      validator: value => ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(value.toLowerCase()),
    }
  );
  if (nextRepeat === null) return;

  touchTask(task, {
    name: nextName,
    scheduledFor: nextDate,
    scheduledUntil: nextDate ? nextEndDate : '',
    scheduledTime: nextTime,
    priority: nextPriority.toLowerCase(),
    repeat: nextDate ? nextRepeat.toLowerCase() : 'none',
  });

  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderAiAddons();
  scheduleSave();
  showToast('Task updated');
}

function editBirthday(id) {
  const task = state.tasks.find(item => item.id === id && item.kind === 'birthday');
  if (!task) return;

  const currentName = getDisplayName(task);
  const nextName = promptRequiredValue('Edit birthday name', currentName);
  if (nextName === null) return;

  const nextDate = promptRequiredValue('Edit birthday date (YYYY-MM-DD)', task.scheduledFor, {
    validator: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
  });
  if (nextDate === null) return;

  touchTask(task, {
    name: `${nextName} birthday`,
    scheduledFor: nextDate,
  });

  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderBirthdays();
  scheduleSave();
  showToast('Birthday updated');
}

function addBirthday() {
  const nameInput = document.getElementById('birthday-name-input');
  const dateInput = document.getElementById('birthday-date-input');
  const name = nameInput.value.trim();
  const date = dateInput.value;
  if (!name || !date) return;

  state.tasks.unshift(createTask({
    id: makeTaskId(),
    name: `${name} birthday`,
    priority: 'low',
    done: false,
    scheduledFor: date,
    scheduledTime: '',
    repeat: 'yearly',
    completedDates: [],
    kind: 'birthday',
  }));

  nameInput.value = '';
  dateInput.value = '';
  renderTasks();
  updateTasksSub();
  renderCalendar();
  renderSchedule();
  renderBirthdays();
  renderAiAddons();
  scheduleSave();
}

function renderTasks() {
  const filter = document.getElementById('filter-select').value;
  const today = getTodayISO();
  let tasks = state.tasks.filter(task => task.kind === 'task' && !shouldHideTaskFromViews(task, today));
  if (filter !== 'all') tasks = tasks.filter(t => t.priority === filter);
  const el = document.getElementById('task-list');
  document.getElementById('tasks-list-count').textContent = `${tasks.length} open`;
  if (tasks.length === 0) { el.innerHTML = '<div class="empty-state">No active tasks right now. Add one above!</div>'; return; }
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  const priorityCopy = { high: 'Do first', medium: 'Keep moving', low: 'Light lift' };
  el.innerHTML = tasks.map(t => `
    <div class="task-item priority-${t.priority}">
      <button class="check-btn" onclick="toggleTask(${t.id}, '${today}')"></button>
      <div class="task-main">
        <div class="task-topline">
          <span class="priority-pill ${t.priority}">${priorityLabel[t.priority]}</span>
          <span class="task-weight">${priorityCopy[t.priority]}</span>
        </div>
        <span class="task-name">${escapeHtml(t.name)}</span>
        <div class="task-meta">
          <span class="task-schedule ${t.scheduledFor ? '' : 'empty'}">${escapeHtml(formatTaskSchedule(t))}</span>
        </div>
      </div>
      <button class="del-btn" onclick="deleteTask(${t.id})">✕</button>
    </div>
  `).join('');
  renderDashboard();
}

function updateTasksSub() {
  const today = getTodayISO();
  const regularTasks = state.tasks.filter(task => task.kind === 'task');
  const visibleTasks = regularTasks.filter(task => !shouldHideTaskFromViews(task, today));
  const done = regularTasks.filter(t => isTaskDoneOn(t, today)).length;
  const scheduled = visibleTasks.filter(t => t.scheduledFor || (t.repeat && t.repeat !== 'none')).length;
  document.getElementById('tasks-sub').textContent = `${visibleTasks.length} active • ${done} completed today • ${scheduled} scheduled`;
  const activeEl = document.getElementById('tasks-overview-active');
  const scheduledEl = document.getElementById('tasks-overview-scheduled');
  const doneEl = document.getElementById('tasks-overview-done');
  if (activeEl && scheduledEl && doneEl) {
    activeEl.textContent = String(visibleTasks.length);
    scheduledEl.textContent = String(scheduled);
    doneEl.textContent = String(done);
  }
  renderDashboard();
}

// ── Timer ──
let timerInterval = null;
let timerRunning = false;
let timerSeconds = 25 * 60;
let selectedMinutes = 25;
const CIRCUMFERENCE = 603;

function getTimerXP(minutes = selectedMinutes) {
  return minutes;
}

function updateTimerXPUI() {
  document.getElementById('xp-per-session').textContent = `+${getTimerXP()}`;
  renderDashboard();
}

function updatePresetIndicator(activeButton = document.querySelector('#timer-preset-row .preset.active')) {
  const row = document.getElementById('timer-preset-row');
  const indicator = document.getElementById('timer-preset-indicator');
  if (!row || !indicator) return;

  const buttons = Array.from(row.querySelectorAll('.preset[data-mins]'));
  const activeIndex = Math.max(0, buttons.indexOf(activeButton));
  row.style.setProperty('--preset-index', activeIndex);
  row.classList.toggle('no-preset-active', !activeButton);
  buttons.forEach((button, index) => {
    button.classList.toggle('active', index === activeIndex && activeButton);
    button.setAttribute('aria-checked', String(index === activeIndex && activeButton));
  });
}

function setPreset(mins, el) {
  selectedMinutes = mins;
  timerSeconds = mins * 60;
  document.querySelectorAll('.preset').forEach(p => {
    p.classList.remove('active');
    if (p.matches('[role="radio"]')) {
      p.setAttribute('aria-checked', 'false');
    }
  });
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-checked', 'true');
  }
  updatePresetIndicator(el);
  updateTimerDisplay();
  updateTimerXPUI();
  const customInput = document.getElementById('custom-timer-input');
  if (customInput && document.activeElement !== customInput) {
    customInput.value = '';
  }
  if (timerRunning) { clearInterval(timerInterval); timerRunning = false; document.getElementById('start-btn').textContent = 'Start'; }
}

function parseCustomTimerMinutes(value) {
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }

  let totalMinutes = 0;
  let matched = false;
  const normalized = raw.replace(/,/g, '.');
  const regex = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/g;
  let part;

  while ((part = regex.exec(normalized)) !== null) {
    matched = true;
    const amount = Number.parseFloat(part[1]);
    const unit = part[2];
    if (unit.startsWith('h')) {
      totalMinutes += amount * 60;
    } else {
      totalMinutes += amount;
    }
  }

  if (!matched) return null;

  const roundedMinutes = Math.round(totalMinutes);
  return roundedMinutes > 0 ? roundedMinutes : null;
}

function applyCustomTimer() {
  const input = document.getElementById('custom-timer-input');
  const customButton = document.getElementById('custom-timer-btn');
  const customMinutes = parseCustomTimerMinutes(input.value);
  if (!Number.isInteger(customMinutes) || customMinutes < 1) {
    input.value = '';
    input.placeholder = 'Use formats like 90, 30m, 1h 30min';
    input.focus();
    return;
  }

  input.placeholder = 'Custom time, e.g. 1h 30min';
  setPreset(customMinutes, null);
  customButton.classList.add('active');
  input.value = String(customMinutes);
}

function setupLiquidPresetDrag() {
  const row = document.getElementById('timer-preset-row');
  if (!row) return;

  const buttons = Array.from(row.querySelectorAll('.preset[data-mins]'));
  if (!buttons.length) return;

  let dragging = false;
  let activePointerId = null;
  let pointerStartX = 0;
  let suppressNextClick = false;

  const getButtonFromPoint = clientX => {
    const rowRect = row.getBoundingClientRect();
    const clampedX = Math.max(rowRect.left, Math.min(clientX, rowRect.right - 1));
    const directHit = buttons.find(button => {
      const rect = button.getBoundingClientRect();
      return clampedX >= rect.left && clampedX <= rect.right;
    });
    if (directHit) return directHit;

    return buttons.reduce((closest, button) => {
      const closestRect = closest.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const closestDistance = Math.abs(clampedX - (closestRect.left + closestRect.width / 2));
      const buttonDistance = Math.abs(clampedX - (buttonRect.left + buttonRect.width / 2));
      return buttonDistance < closestDistance ? button : closest;
    }, buttons[0]);
  };

  const chooseFromPoint = clientX => {
    const button = getButtonFromPoint(clientX);
    const minutes = Number.parseInt(button.dataset.mins, 10);
    if (Number.isInteger(minutes) && selectedMinutes !== minutes) {
      setPreset(minutes, button);
    } else {
      updatePresetIndicator(button);
    }
  };

  row.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    suppressNextClick = false;
    row.classList.add('is-dragging');
    row.setPointerCapture(activePointerId);
    chooseFromPoint(event.clientX);
  });

  row.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== activePointerId) return;
    if (Math.abs(event.clientX - pointerStartX) > 4) {
      suppressNextClick = true;
    }
    chooseFromPoint(event.clientX);
  });

  const endDrag = event => {
    if (!dragging || event.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    row.classList.remove('is-dragging');
  };

  row.addEventListener('click', event => {
    if (!suppressNextClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = false;
  }, true);

  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);
  updatePresetIndicator();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('start-btn').textContent = 'Start';
  } else {
    timerRunning = true;
    document.getElementById('start-btn').textContent = 'Pause';
    timerInterval = setInterval(tick, 1000);
  }
  renderDashboard();
}

function tick() {
  timerSeconds--;
  updateTimerDisplay();
  if (timerSeconds <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('start-btn').textContent = 'Start';
    document.getElementById('timer-mode').textContent = 'Complete!';
    state.sessions++;
    state.minsFocused += selectedMinutes;
    document.getElementById('sessions-today').textContent = state.sessions;
    document.getElementById('mins-focused').textContent = state.minsFocused;
    document.getElementById('s-sessions').textContent = state.sessions;
    gainXP(getTimerXP());
    timerSeconds = selectedMinutes * 60;
    setTimeout(() => { updateTimerDisplay(); document.getElementById('timer-mode').textContent = 'Focus'; }, 2000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = selectedMinutes * 60;
  document.getElementById('start-btn').textContent = 'Start';
  document.getElementById('timer-mode').textContent = 'Focus';
  updateTimerDisplay();
  renderDashboard();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timer-display').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const offset = CIRCUMFERENCE * (1 - timerSeconds / (selectedMinutes * 60));
  document.getElementById('ring-progress').style.strokeDashoffset = offset;
  const dashboardTime = document.getElementById('dashboard-focus-time');
  if (dashboardTime) {
    dashboardTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

function getTasksForDate(isoDate) {
  return state.tasks
    .filter(task => doesTaskOccurOn(task, isoDate))
    .sort((a, b) => {
      if (!a.scheduledTime && !b.scheduledTime) return 0;
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
}

function getVisibleTasksForDate(isoDate) {
  return getTasksForDate(isoDate).filter(task => !shouldHideTaskFromViews(task, isoDate));
}

function selectDate(isoDate) {
  selectedDate = isoDate;
  calendarMonth = startOfMonth(isoDate);
  if (document.getElementById('schedule-toggle').checked) {
    document.getElementById('task-date').value = isoDate;
    document.getElementById('task-end-date').min = isoDate;
  }
  renderCalendar();
  renderSchedule();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  const sub = document.getElementById('calendar-sub');
  const monthDate = new Date(`${calendarMonth}T12:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  title.textContent = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const today = getTodayISO();
  const scheduledCount = Array.from({ length: daysInMonth }, (_, i) => {
    const isoDate = `${calendarMonth.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;
    return getVisibleTasksForDate(isoDate).length;
  }).reduce((sum, count) => sum + count, 0);
  sub.textContent = `${scheduledCount} scheduled this month`;

  const cells = [];
  for (let i = 0; i < offset; i++) {
    cells.push('<button class="calendar-day muted" type="button" disabled></button>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = `${calendarMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`;
    const tasks = getVisibleTasksForDate(isoDate);
    const classes = [
      'calendar-day',
      isoDate === selectedDate ? 'selected' : '',
      isoDate === today ? 'today' : '',
      tasks.length ? 'has-items' : '',
    ].filter(Boolean).join(' ');

    cells.push(`
      <button class="${classes}" type="button" onclick="selectDate('${isoDate}')">
        <span class="calendar-num">${day}</span>
        <span class="calendar-task-list">
          ${tasks.slice(0, 2).map(task => `<span class="calendar-task-name">${escapeHtml(getDisplayName(task))}</span>`).join('')}
          ${tasks.length > 2 ? `<span class="calendar-count">+${tasks.length - 2} more</span>` : ''}
        </span>
      </button>
    `);
  }

  grid.innerHTML = cells.join('');
  renderMobileWeekSchedule();
}

function renderMobileWeekSchedule() {
  const days = document.getElementById('mobile-week-days');
  if (!days) return;

  const weekStart = startOfWeek(selectedDate);
  const today = getTodayISO();

  days.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const isoDate = addDays(weekStart, index);
    const date = new Date(`${isoDate}T12:00:00`);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const tasks = getVisibleTasksForDate(isoDate);
    const taskList = tasks.length || isoDate === selectedDate
      ? `<span class="mobile-week-task-list">
          ${tasks.length
            ? tasks.map(task => `<span class="mobile-week-task">
                <span class="mobile-week-task-name">${escapeHtml(getDisplayName(task))}</span>
                <span class="mobile-week-task-time">${escapeHtml(task.kind === 'birthday' ? 'Birthday' : (task.scheduledTime || 'Any time'))}</span>
              </span>`).join('')
            : '<span class="mobile-week-empty">No tasks for this day.</span>'}
        </span>`
      : '';
    const classes = [
      'mobile-week-day',
      isoDate === selectedDate ? 'selected' : '',
      isoDate === today ? 'today' : '',
    ].filter(Boolean).join(' ');

    return `<button class="${classes}" type="button" onclick="selectDate('${isoDate}')" aria-pressed="${isoDate === selectedDate}">
      <span class="mobile-week-day-name">${escapeHtml(dayName)}</span>
      ${taskList}
    </button>`;
  }).join('');
}

function renderSchedule() {
  const label = document.getElementById('schedule-date');
  const list = document.getElementById('schedule-list');
  label.textContent = formatLongDate(selectedDate);

  const tasks = getVisibleTasksForDate(selectedDate);
  if (!tasks.length) {
    list.innerHTML = '<div class="schedule-empty">No tasks scheduled for this day yet.</div>';
    return;
  }

  list.innerHTML = tasks.map(task => {
    const isEditing = editingTaskId === task.id;
    const editPrefix = `schedule-edit-${task.id}`;
    return `
    <div class="schedule-item ${task.kind === 'birthday' ? 'birthday' : ''} ${isTaskDoneOn(task, selectedDate) ? 'done' : ''}">
      <div class="schedule-time">${task.kind === 'birthday' ? 'Birthday' : (task.scheduledTime || 'Any time')}</div>
      <div class="schedule-body">
        ${isEditing ? `
        <div class="schedule-edit-form">
          <input class="task-input schedule-inline-input" id="${editPrefix}-name" value="${escapeHtml(getDisplayName(task))}" />
          <div class="schedule-inline-grid">
            <input class="date-input" id="${editPrefix}-date" type="date" value="${task.scheduledFor || selectedDate}" />
            ${task.kind === 'birthday'
              ? ''
              : `<input class="date-input" id="${editPrefix}-end-date" type="date" value="${task.scheduledUntil || ''}" min="${task.scheduledFor || selectedDate}" aria-label="End date (optional)" title="End date (optional)" />`}
            ${task.kind === 'birthday'
              ? ''
              : `<input class="time-input" id="${editPrefix}-time" type="time" value="${task.scheduledTime || ''}" />`}
          </div>
          ${task.kind === 'birthday'
            ? ''
            : `<div class="schedule-inline-grid">
            <select class="priority-select" id="${editPrefix}-priority">
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
            </select>
            <select class="priority-select repeat-select" id="${editPrefix}-repeat">
              <option value="none" ${task.repeat === 'none' ? 'selected' : ''}>No repeat</option>
              <option value="daily" ${task.repeat === 'daily' ? 'selected' : ''}>Repeat daily</option>
              <option value="weekly" ${task.repeat === 'weekly' ? 'selected' : ''}>Repeat weekly</option>
              <option value="monthly" ${task.repeat === 'monthly' ? 'selected' : ''}>Repeat monthly</option>
              <option value="yearly" ${task.repeat === 'yearly' ? 'selected' : ''}>Repeat yearly</option>
            </select>
          </div>`}
        </div>
        <div class="schedule-item-actions schedule-item-actions-block">
          <button class="schedule-toggle" type="button" onclick="saveTaskFromSchedule(${task.id})">Save</button>
          <button class="schedule-toggle danger" type="button" onclick="cancelEditingTask()">Cancel</button>
        </div>`
        : `<button class="schedule-task-button" type="button" onclick="startEditingTask(${task.id})">
          <span class="schedule-task">${escapeHtml(getDisplayName(task))}</span>
          <span class="schedule-edit-hint">Tap to edit</span>
        </button>`}
        <div class="schedule-meta">
          ${task.kind === 'birthday'
            ? `<span class="birthday-pill">Birthday</span>`
            : `<span class="priority-pill ${task.priority}">${task.priority}</span>
          ${task.repeat && task.repeat !== 'none' ? `<span class="repeat-pill">${REPEAT_LABELS[task.repeat]}</span>` : ''}`}
        </div>
        ${isEditing ? '' : (task.kind === 'birthday'
          ? `<div class="schedule-item-actions schedule-item-actions-block">
          <button class="schedule-toggle" type="button" onclick="startEditingTask(${task.id})">Edit</button>
          <button class="schedule-toggle danger" type="button" onclick="deleteTask(${task.id})">Delete</button>
        </div>`
          : `<div class="schedule-item-actions schedule-item-actions-block">
          <button class="schedule-toggle" type="button" onclick="startEditingTask(${task.id})">Edit</button>
          <button class="schedule-toggle" type="button" onclick="toggleTask(${task.id}, '${selectedDate}')">${isTaskDoneOn(task, selectedDate) ? 'Mark active' : 'Mark done'}</button>
          <button class="schedule-toggle danger" type="button" onclick="deleteTask(${task.id})">Delete</button>
        </div>`)}
      </div>
    </div>
  `;
  }).join('');
}

function renderBirthdays() {
  const list = document.getElementById('birthdays-list');
  const subtitle = document.getElementById('birthdays-sub');
  const birthdays = state.tasks
    .filter(task => task.kind === 'birthday')
    .sort((a, b) => getNextOccurrenceDate(a).localeCompare(getNextOccurrenceDate(b)));

  subtitle.textContent = `${birthdays.length} birthday${birthdays.length === 1 ? '' : 's'} saved`;

  if (!birthdays.length) {
    list.innerHTML = '<div class="schedule-empty">No birthdays added yet.</div>';
    renderDashboard();
    return;
  }

  list.innerHTML = birthdays.map(task => {
    const nextDate = getNextOccurrenceDate(task);
    return `
      <div class="birthday-row">
        <div>
          <div class="birthday-name">${escapeHtml(getDisplayName(task))}</div>
          <div class="birthday-meta">${escapeHtml(formatMonthDay(task.scheduledFor))} • Next: ${escapeHtml(formatLongDate(nextDate))}</div>
        </div>
        <div class="birthday-actions">
          <button class="action-btn" type="button" onclick="editBirthday(${task.id})">Edit</button>
          <button class="del-btn birthday-del-btn" type="button" onclick="deleteTask(${task.id})">✕</button>
        </div>
      </div>
    `;
  }).join('');
  renderDashboard();
}

function updateCritiqueCard(id, insight) {
  const title = document.getElementById(`${id}-title`);
  const copy = document.getElementById(`${id}-copy`);
  const action = document.getElementById(`${id}-action`);
  if (!title || !copy || !action) return;

  title.textContent = insight.title;
  copy.textContent = insight.copy;
  action.textContent = insight.action;
  action.onclick = () => activateTab(insight.tab);
}

function getDashboardOverviewData(sectionKey) {
  const today = getTodayISO();
  const activeTasks = state.tasks.filter(task => task.kind === 'task' && !shouldHideTaskFromViews(task, today));
  const doneToday = state.tasks.filter(task => task.kind === 'task' && isTaskDoneOn(task, today));
  const overdueTasks = activeTasks.filter(task => task.scheduledFor && task.scheduledFor < today);
  const unscheduledTasks = activeTasks.filter(task => !task.scheduledFor);
  const highPriorityTasks = activeTasks.filter(task => task.priority === 'high');
  const scheduledTasks = [];
  const upcomingItems = [];

  for (let index = 0; index <= 7; index++) {
    const date = addDays(today, index);
    getVisibleTasksForDate(date)
      .filter(task => task.kind === 'task')
      .forEach(task => scheduledTasks.push({ task, date }));
  }

  for (let index = 0; index < 21 && upcomingItems.length < 5; index++) {
    const date = addDays(today, index);
    getVisibleTasksForDate(date).forEach(task => {
      if (upcomingItems.length < 5) upcomingItems.push({ task, date });
    });
  }

  const birthdays = state.tasks
    .filter(task => task.kind === 'birthday')
    .sort((a, b) => getNextOccurrenceDate(a).localeCompare(getNextOccurrenceDate(b)))
    .slice(0, 5);

  const { current, next, pct, cap } = getLevelInfo(state.xp);
  const overview = {
    hero: {
      title: 'Today at a glance',
      copy: `${activeTasks.length} active tasks, ${doneToday.length} completed today, ${state.sessions} focus sessions, and ${state.streak} day streak.`,
      stats: [
        ['Level', `Lv ${current.level}`],
        ['XP', `${state.xp}`],
        ['Progress', `${pct}%`],
      ],
      items: next ? [`${Math.max(0, cap - state.xp)} XP until ${next.name}`] : ['You are at the top level.'],
      action: 'Open stats',
      tab: 'stats',
    },
    activeMetric: {
      title: 'Active tasks',
      copy: 'Tasks that still need attention today.',
      stats: [['Active', activeTasks.length], ['High priority', highPriorityTasks.length], ['Unscheduled', unscheduledTasks.length]],
      items: activeTasks.slice(0, 5).map(task => `${task.name} - ${task.scheduledFor ? formatTaskSchedule(task) : 'No date'}`),
      action: 'Open tasks',
      tab: 'tasks',
    },
    scheduledMetric: {
      title: 'Scheduled soon',
      copy: 'Tasks planned across the next 7 days.',
      stats: [['Next 7 days', scheduledTasks.length], ['Today done', doneToday.length], ['Overdue', overdueTasks.length]],
      items: scheduledTasks.slice(0, 5).map(({ task, date }) => `${task.name} - ${getDayDistanceLabel(date, today)} at ${formatTimeLabel(task.scheduledTime)}`),
      action: 'Open calendar',
      tab: 'calendar',
    },
    focusMetric: {
      title: 'Focus overview',
      copy: 'Your focus time and the next session reward.',
      stats: [['Minutes', `${state.minsFocused}m`], ['Sessions', state.sessions], ['Next XP', `+${getTimerXP()}`]],
      items: [`Current timer is set to ${selectedMinutes} minutes.`, timerRunning ? 'A focus session is running now.' : 'Timer is ready for the next session.'],
      action: 'Start focus',
      tab: 'timer',
    },
    streakMetric: {
      title: 'Momentum overview',
      copy: 'Your current consistency signal.',
      stats: [['Streak', state.streak], ['Tasks done', state.tasksDone], ['XP', state.xp]],
      items: state.streak > 0 ? [`Keep the ${state.streak}-day streak alive with one completed task or session.`] : ['Complete one task or focus session to start momentum.'],
      action: 'Open stats',
      tab: 'stats',
    },
    coach: {
      title: 'Coach overview',
      copy: 'The highest-signal actions from your current plan.',
      stats: [['Overdue', overdueTasks.length], ['High priority', highPriorityTasks.length], ['Unscheduled', unscheduledTasks.length]],
      items: [
        overdueTasks[0] ? `First risk: ${overdueTasks[0].name}` : 'No overdue tasks right now.',
        highPriorityTasks[0] ? `Top priority: ${highPriorityTasks[0].name}` : 'No high-priority blocker found.',
        unscheduledTasks[0] ? `Needs planning: ${unscheduledTasks[0].name}` : 'No floating task needs a date.',
      ],
      action: 'Review tasks',
      tab: 'tasks',
    },
    score: {
      title: 'Daily score',
      copy: 'A compact read on today: done work, priority, schedule, and unplanned tasks.',
      stats: [['Done', doneToday.length], ['Priority', highPriorityTasks.length], ['Planned', activeTasks.filter(task => task.scheduledFor).length]],
      items: [`${unscheduledTasks.length} task${unscheduledTasks.length === 1 ? '' : 's'} still need planning.`],
      action: 'Open tasks',
      tab: 'tasks',
    },
    roadmap: {
      title: 'Roadmap',
      copy: 'What is coming across the next few days.',
      stats: [['Next items', upcomingItems.length], ['Scheduled soon', scheduledTasks.length], ['Birthdays', birthdays.length]],
      items: upcomingItems.map(({ task, date }) => `${getDisplayName(task)} - ${getDayDistanceLabel(date, today)}`),
      action: 'Open calendar',
      tab: 'calendar',
    },
    alerts: {
      title: 'Coach alerts',
      copy: 'Tasks most likely to slip if ignored.',
      stats: [['Overdue', overdueTasks.length], ['High', highPriorityTasks.length], ['Unscheduled', unscheduledTasks.length]],
      items: [...overdueTasks, ...highPriorityTasks, ...unscheduledTasks].slice(0, 5).map(task => `${task.name} - ${task.scheduledFor ? formatTaskSchedule(task) : 'Needs a date'}`),
      action: 'Review plan',
      tab: 'tasks',
    },
    tools: {
      title: 'Lock in tools',
      copy: 'Fast routes to the main workflows.',
      stats: [['Tasks', activeTasks.length], ['Timer', `${selectedMinutes}m`], ['XP reward', `+${getTimerXP()}`]],
      items: ['Add tasks', 'Start a focus session', 'Plan the week', 'Check progress'],
      action: 'Start focus',
      tab: 'timer',
    },
    snapshot: {
      title: 'Today snapshot',
      copy: 'A quick view of current work and completed tasks.',
      stats: [['Open', activeTasks.length], ['Done today', doneToday.length], ['High', highPriorityTasks.length]],
      items: [...activeTasks.slice(0, 4), ...doneToday.slice(0, 1)].map(task => `${task.name} - ${isTaskDoneOn(task, today) ? 'Done' : (task.scheduledFor ? formatTaskSchedule(task) : 'Unscheduled')}`),
      action: 'Open tasks',
      tab: 'tasks',
    },
    focus: {
      title: 'Focus momentum',
      copy: timerRunning ? 'A timer is running right now.' : 'Your next focus session is ready.',
      stats: [['Timer', `${selectedMinutes}m`], ['Focused', `${state.minsFocused}m`], ['Sessions', state.sessions]],
      items: [`Complete the next session for +${getTimerXP()} XP.`],
      action: 'Open timer',
      tab: 'timer',
    },
    upcoming: {
      title: 'Upcoming',
      copy: 'The next tasks and date-based reminders.',
      stats: [['Items', upcomingItems.length], ['Tasks soon', scheduledTasks.length], ['Birthdays', birthdays.length]],
      items: upcomingItems.map(({ task, date }) => `${getDisplayName(task)} - ${formatLongDate(date)}`),
      action: 'Open calendar',
      tab: 'calendar',
    },
    birthdays: {
      title: 'Birthday radar',
      copy: 'Upcoming birthdays saved in FocusUp.',
      stats: [['Saved', state.tasks.filter(task => task.kind === 'birthday').length], ['Shown', birthdays.length], ['Next', birthdays[0] ? getDayDistanceLabel(getNextOccurrenceDate(birthdays[0]), today) : 'None']],
      items: birthdays.map(task => `${getDisplayName(task)} - ${formatLongDate(getNextOccurrenceDate(task, today))}`),
      action: 'Open birthdays',
      tab: 'birthdays',
    },
  };

  const fallback = overview[sectionKey] || overview.hero;
  return {
    ...fallback,
    items: fallback.items.length ? fallback.items : ['Nothing to show here yet.'],
  };
}

function openDashboardOverview(sectionKey) {
  const modal = document.getElementById('dashboard-overview-modal');
  if (!modal) return;

  const data = getDashboardOverviewData(sectionKey);
  document.getElementById('dashboard-overview-kicker').textContent = 'Overview';
  document.getElementById('dashboard-overview-title').textContent = data.title;
  document.getElementById('dashboard-overview-copy').textContent = data.copy;
  document.getElementById('dashboard-overview-stats').innerHTML = data.stats.map(([label, value]) => `
    <div class="dashboard-overview-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');
  document.getElementById('dashboard-overview-list').innerHTML = data.items.map(item => `
    <div class="dashboard-overview-item">${escapeHtml(item)}</div>
  `).join('');

  const action = document.getElementById('dashboard-overview-action');
  action.textContent = data.action;
  action.onclick = () => {
    closeDashboardOverview();
    activateTab(data.tab);
  };

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeDashboardOverview() {
  const modal = document.getElementById('dashboard-overview-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderDashboard() {
  const tab = document.getElementById('tab-dashboard');
  if (!tab) return;
  applyDashboardLayout();

  const today = getTodayISO();
  const activeTasks = state.tasks.filter(task => task.kind === 'task' && !shouldHideTaskFromViews(task, today));
  const doneToday = state.tasks.filter(task => task.kind === 'task' && isTaskDoneOn(task, today)).length;
  const upcomingItems = [];
  const weekItems = [];

  for (let index = 0; index < 21 && upcomingItems.length < 3; index++) {
    const date = addDays(today, index);
    getVisibleTasksForDate(date).forEach(task => {
      if (upcomingItems.length >= 3) return;
      upcomingItems.push({ task, date });
    });
  }

  for (let index = 0; index < 7; index++) {
    const date = addDays(today, index);
    weekItems.push({
      date,
      tasks: getVisibleTasksForDate(date).filter(task => task.kind === 'task'),
      birthdays: getVisibleTasksForDate(date).filter(task => task.kind === 'birthday'),
    });
  }

  const birthdayItems = state.tasks
    .filter(task => task.kind === 'birthday')
    .sort((a, b) => getNextOccurrenceDate(a).localeCompare(getNextOccurrenceDate(b)))
    .slice(0, 3);

  const overdueTasks = activeTasks.filter(task => task.scheduledFor && task.scheduledFor < today);
  const unscheduledTasks = activeTasks.filter(task => !task.scheduledFor);
  const highPriorityTasks = activeTasks.filter(task => task.priority === 'high');
  const attentionItems = [
    ...overdueTasks.map(task => ({ task, label: 'Overdue', meta: formatTaskSchedule(task) })),
    ...highPriorityTasks
      .filter(task => !overdueTasks.includes(task))
      .map(task => ({ task, label: 'High', meta: task.scheduledFor ? formatTaskSchedule(task) : 'High priority with no date' })),
    ...unscheduledTasks
      .filter(task => !highPriorityTasks.includes(task))
      .map(task => ({ task, label: 'Unscheduled', meta: 'Needs a date or time' })),
  ].slice(0, 3);

  let scheduledSoon = 0;
  for (let index = 0; index <= 7; index++) {
    const date = addDays(today, index);
    scheduledSoon += getVisibleTasksForDate(date).filter(task => task.kind === 'task').length;
  }

  const { current, next, pct, cap } = getLevelInfo(state.xp);
  const dashboardSub = document.getElementById('dashboard-sub');
  const dashboardDate = document.getElementById('dashboard-date');
  const dashboardWelcome = document.getElementById('dashboard-welcome');
  const dashboardHeroText = document.getElementById('dashboard-hero-text');

  dashboardSub.textContent = `${activeTasks.length} active right now • ${doneToday} completed today • ${state.sessions} focus sessions finished`;
  dashboardDate.textContent = formatLongDate(today);
  dashboardWelcome.textContent = activeTasks.length ? `You have ${activeTasks.length} priority items in motion.` : 'Your dashboard is calm and under control.';
  dashboardHeroText.textContent = activeTasks.length
    ? `Keep moving: ${scheduledSoon} scheduled item${scheduledSoon === 1 ? '' : 's'} are coming up next, and your streak is still alive.`
    : 'Use this space to restart momentum with one task, one focus session, or one planned date.';
  document.getElementById('mobile-appbar-title').textContent = activeTasks.length
    ? `${activeTasks.length} active item${activeTasks.length === 1 ? '' : 's'} today`
    : (state.streak > 0 ? `${state.streak}-day streak still going.` : 'Ready to lock in?');

  document.getElementById('dashboard-level-pill').textContent = `Level ${current.level} • ${current.name}`;
  document.getElementById('dashboard-level-fill').style.width = `${pct}%`;
  document.getElementById('dashboard-level-meta').textContent = next
    ? `${Math.max(0, cap - state.xp)} XP to reach ${next.name}`
    : `You are at the top tier with ${state.xp} XP`;

  document.getElementById('dashboard-metric-active').textContent = String(activeTasks.length);
  document.getElementById('dashboard-metric-scheduled').textContent = String(scheduledSoon);
  document.getElementById('dashboard-metric-focus').textContent = `${state.minsFocused}m`;
  document.getElementById('dashboard-metric-streak').textContent = String(state.streak);
  document.getElementById('dashboard-task-sub').textContent = `${doneToday} done today • ${activeTasks.length} still open`;
  document.getElementById('dashboard-today-sub').textContent = `${doneToday} complete • ${highPriorityTasks.length} high priority • ${scheduledSoon} scheduled soon`;

  const nextAction = overdueTasks[0]
    ? {
      title: 'Clear the overdue item first',
      copy: `${overdueTasks[0].name} is past its planned date. Finish it, reschedule it, or delete it so it stops dragging the day.`,
      action: 'Open tasks',
      tab: 'tasks',
    }
    : highPriorityTasks[0]
      ? {
        title: 'Attack the high-priority task',
        copy: `${highPriorityTasks[0].name} is the strongest next move. Keep the day simple and move this one forward.`,
        action: 'Open tasks',
        tab: 'tasks',
      }
      : unscheduledTasks[0]
        ? {
          title: 'Give one task a date',
          copy: `${unscheduledTasks[0].name} is still floating. Scheduling it will make the rest of the plan easier to trust.`,
          action: 'Plan it',
          tab: 'calendar',
        }
        : activeTasks[0]
          ? {
            title: 'Finish one active task',
            copy: `${activeTasks[0].name} is ready. Complete one small thing before adding more to the board.`,
            action: 'Open tasks',
            tab: 'tasks',
          }
          : {
            title: 'Start a clean focus block',
            copy: `No active task is pulling attention right now. Use a ${selectedMinutes}-minute session to build momentum.`,
            action: 'Start focus',
            tab: 'timer',
          };

  const riskAction = overdueTasks.length
    ? {
      title: `${overdueTasks.length} overdue item${overdueTasks.length === 1 ? '' : 's'}`,
      copy: 'The schedule is losing trust here. Review overdue work before planning more.',
      action: 'Review tasks',
      tab: 'tasks',
    }
    : unscheduledTasks.length
      ? {
        title: `${unscheduledTasks.length} task${unscheduledTasks.length === 1 ? '' : 's'} without a date`,
        copy: 'These can disappear from your attention. Put the important ones onto the calendar.',
        action: 'Open calendar',
        tab: 'calendar',
      }
      : highPriorityTasks.length
        ? {
          title: `${highPriorityTasks.length} high-priority item${highPriorityTasks.length === 1 ? '' : 's'}`,
          copy: 'Priority is clear. The risk now is switching away before one of them is done.',
          action: 'Open tasks',
          tab: 'tasks',
        }
        : {
          title: 'No major risk detected',
          copy: 'Your board is relatively clean. Protect that by avoiding unnecessary new tasks.',
          action: 'Check progress',
          tab: 'stats',
        };

  const rewardAction = activeTasks.length
    ? {
      title: `+${getTimerXP()} XP focus opportunity`,
      copy: `A ${selectedMinutes}-minute session can convert today’s open work into progress without rearranging the whole plan.`,
      action: 'Start focus',
      tab: 'timer',
    }
    : doneToday
      ? {
        title: `${doneToday} task${doneToday === 1 ? '' : 's'} already done`,
        copy: 'You have momentum. Log one more focused session or stop while the day still feels clean.',
        action: 'View stats',
        tab: 'stats',
      }
      : {
        title: 'First win is still available',
        copy: 'Add one small task or start one short focus block. The goal is motion, not a perfect plan.',
        action: 'Add task',
        tab: 'tasks',
      };

  updateCritiqueCard('critique-next', nextAction);
  updateCritiqueCard('critique-risk', riskAction);
  updateCritiqueCard('critique-reward', rewardAction);

  const todayGrid = document.getElementById('dashboard-today-grid');
  todayGrid.innerHTML = [
    {
      kicker: 'Done',
      value: String(doneToday),
      copy: 'Tasks completed today',
    },
    {
      kicker: 'Priority',
      value: String(highPriorityTasks.length),
      copy: 'High-priority items open',
    },
    {
      kicker: 'Scheduled',
      value: String(activeTasks.filter(task => task.scheduledFor).length),
      copy: 'Tasks with a date attached',
    },
    {
      kicker: 'Unplanned',
      value: String(unscheduledTasks.length),
      copy: 'Tasks that still need planning',
    },
  ].map(card => `
    <div class="dashboard-summary-card">
      <span class="dashboard-summary-kicker">${card.kicker}</span>
      <div class="dashboard-summary-value">${card.value}</div>
      <div class="dashboard-summary-copy">${card.copy}</div>
    </div>
  `).join('');

  const taskList = document.getElementById('dashboard-task-list');
  const taskPreview = [...activeTasks.slice(0, 2)];
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  state.tasks
    .filter(task => task.kind === 'task' && isTaskDoneOn(task, today))
    .slice(0, 1)
    .forEach(task => taskPreview.push(task));
  taskList.innerHTML = taskPreview.length
    ? taskPreview.map(task => {
      const complete = isTaskDoneOn(task, today);
      return `
        <div class="dashboard-list-item ${complete ? 'is-complete' : ''}">
          <div class="dashboard-list-main">
            <div class="dashboard-list-title">${escapeHtml(task.name)}</div>
            <div class="dashboard-list-meta">${escapeHtml(task.scheduledFor ? formatTaskSchedule(task) : 'Unscheduled task')}</div>
          </div>
          <div class="dashboard-item-badge ${complete ? 'complete' : ''}">${complete ? 'Done' : priorityLabel[task.priority] || 'Task'}</div>
        </div>
      `;
    }).join('')
    : '<div class="dashboard-empty">No active tasks today. Add one and it will appear here immediately.</div>';

  const upcomingList = document.getElementById('dashboard-upcoming-list');
  upcomingList.innerHTML = upcomingItems.length
    ? upcomingItems.map(({ task, date }) => `
        <div class="dashboard-list-item">
          <div class="dashboard-list-main">
            <div class="dashboard-list-title">${escapeHtml(getDisplayName(task))}</div>
            <div class="dashboard-list-meta">${escapeHtml(`${getDayDistanceLabel(date, today)} • ${formatLongDate(date)}${task.kind === 'birthday' ? '' : ` • ${formatTimeLabel(task.scheduledTime)}`}`)}</div>
          </div>
          <div class="dashboard-item-badge ${task.kind === 'birthday' ? 'birthday' : ''}">${task.kind === 'birthday' ? 'Birthday' : 'Planned'}</div>
        </div>
      `).join('')
    : '<div class="dashboard-empty">Nothing scheduled yet for the next few days.</div>';

  const weekList = document.getElementById('dashboard-week-list');
  const busiestDay = weekItems.reduce((best, entry) => {
    const score = entry.tasks.length + entry.birthdays.length;
    const bestScore = best.tasks.length + best.birthdays.length;
    return score > bestScore ? entry : best;
  }, weekItems[0]);
  const weekTaskCount = weekItems.reduce((sum, entry) => sum + entry.tasks.length, 0);
  document.getElementById('dashboard-week-sub').textContent = `${weekTaskCount} visible tasks across the next 7 days • busiest: ${formatMonthDay(busiestDay.date)}`;
  weekList.innerHTML = weekItems.slice(0, 4).map(entry => {
    const total = entry.tasks.length + entry.birthdays.length;
    return `
      <div class="dashboard-list-item">
        <div class="dashboard-list-main">
          <div class="dashboard-list-title">${escapeHtml(getDayDistanceLabel(entry.date, today))}</div>
          <div class="dashboard-list-meta">${escapeHtml(`${formatLongDate(entry.date)} • ${entry.tasks.length} task${entry.tasks.length === 1 ? '' : 's'}${entry.birthdays.length ? ` • ${entry.birthdays.length} birthday` : ''}`)}</div>
        </div>
        <div class="dashboard-item-badge">${total}</div>
      </div>
    `;
  }).join('');

  const attentionList = document.getElementById('dashboard-attention-list');
  document.getElementById('dashboard-attention-sub').textContent = attentionItems.length
    ? `${attentionItems.length} item${attentionItems.length === 1 ? '' : 's'} could use attention next`
    : 'Nothing urgent right now. Your board is under control.';
  attentionList.innerHTML = attentionItems.length
    ? attentionItems.map(item => `
      <div class="dashboard-list-item">
        <div class="dashboard-list-main">
          <div class="dashboard-list-title">${escapeHtml(item.task.name)}</div>
          <div class="dashboard-list-meta">${escapeHtml(item.meta)}</div>
        </div>
        <div class="dashboard-item-badge">${escapeHtml(item.label)}</div>
      </div>
    `).join('')
    : '<div class="dashboard-empty">No overdue, unscheduled, or high-priority blockers right now.</div>';

  document.getElementById('dashboard-focus-status').textContent = timerRunning
    ? 'Timer is running right now.'
    : `Next session is set to ${selectedMinutes} minutes.`;
  document.getElementById('dashboard-focus-copy').textContent = timerRunning
    ? `Stay locked in. This session will add +${getTimerXP()} XP when it completes.`
    : `${state.sessions} sessions finished so far, ${state.minsFocused} minutes focused, and +${getTimerXP()} XP ready on the next run.`;

  const birthdayList = document.getElementById('dashboard-birthday-list');
  birthdayList.innerHTML = birthdayItems.length
    ? birthdayItems.map(task => {
      const nextDate = getNextOccurrenceDate(task, today);
      return `
        <div class="dashboard-list-item">
          <div class="dashboard-list-main">
            <div class="dashboard-list-title">${escapeHtml(getDisplayName(task))}</div>
            <div class="dashboard-list-meta">${escapeHtml(`${formatMonthDay(task.scheduledFor)} • ${getDayDistanceLabel(nextDate, today)} • ${formatLongDate(nextDate)}`)}</div>
          </div>
          <div class="dashboard-item-badge birthday">Soon</div>
        </div>
      `;
    }).join('')
    : '<div class="dashboard-empty">No birthdays saved yet.</div>';

}

// ── Mobile Menu ──
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');

function setMobileMenu(open) {
  document.body.classList.toggle('menu-open', open);
  mobileMenuToggle.setAttribute('aria-expanded', String(open));
  mobileMenuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileMenuOverlay.hidden = !open;
  mobileMenuOverlay.classList.toggle('is-visible', open);
}

function toggleMobileMenu() {
  setMobileMenu(!document.body.classList.contains('menu-open'));
}

// ── Tabs ──
const tabOrder = Array.from(document.querySelectorAll('.nav-btn[data-tab]')).map(btn => btn.dataset.tab);
const mobileTabTitles = {
  dashboard: 'Today at a glance',
  tasks: 'Tasks',
  timer: 'Focus timer',
  calendar: 'Calendar',
  birthdays: 'Birthdays',
  stats: 'Stats',
};

function updateMobileShell(tab) {
  const title = document.getElementById('mobile-appbar-title');
  if (!title || window.innerWidth > 640) return;

  if (tab === 'dashboard') {
    renderDashboard();
    return;
  }

  title.textContent = mobileTabTitles[tab] || 'FocusUp';
}

function activateTab(tab) {
  if (window.innerWidth <= 640) tab = 'calendar';
  document.body.classList.toggle('calendar-only-mobile', tab === 'calendar');
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === `tab-${tab}`);
  });
  if (window.innerWidth <= 640) {
    setMobileMenu(false);
    updateMobileShell(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// ── Mobile Swipe Tabs ──
const swipeArea = document.querySelector('.main');
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartTab = null;

function canSwipeTabsFrom(target) {
  return window.innerWidth <= 640
    && !document.body.classList.contains('menu-open')
    && !target.closest('button, input, select, textarea, a, [contenteditable="true"]');
}

function getActiveTab() {
  return document.querySelector('.nav-btn.active')?.dataset.tab || tabOrder[0];
}

function activateAdjacentTab(direction) {
  const activeIndex = tabOrder.indexOf(getActiveTab());
  if (activeIndex === -1) return;

  const nextIndex = Math.max(0, Math.min(tabOrder.length - 1, activeIndex + direction));
  if (nextIndex !== activeIndex) {
    activateTab(tabOrder[nextIndex]);
  }
}

if (swipeArea) {
  swipeArea.addEventListener('touchstart', event => {
    if (!canSwipeTabsFrom(event.target) || event.touches.length !== 1) {
      swipeStartTab = null;
      return;
    }

    swipeStartX = event.touches[0].clientX;
    swipeStartY = event.touches[0].clientY;
    swipeStartTab = getActiveTab();
  }, { passive: true });

  swipeArea.addEventListener('touchend', event => {
    if (!swipeStartTab || event.changedTouches.length !== 1) return;

    const deltaX = event.changedTouches[0].clientX - swipeStartX;
    const deltaY = event.changedTouches[0].clientY - swipeStartY;
    const isHorizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    if (isHorizontalSwipe && getActiveTab() === swipeStartTab) {
      activateAdjacentTab(deltaX < 0 ? 1 : -1);
    }

    swipeStartTab = null;
  }, { passive: true });
}

mobileMenuToggle.addEventListener('click', toggleMobileMenu);
mobileMenuOverlay.addEventListener('click', () => setMobileMenu(false));

window.addEventListener('resize', () => {
  if (window.innerWidth > 640) {
    setMobileMenu(false);
  }
  setThemeLabels(document.documentElement.getAttribute('data-theme') || 'dark');
});

document.getElementById('filter-select').addEventListener('change', renderTasks);
document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
document.getElementById('schedule-toggle').addEventListener('change', updateScheduleToggleUI);
document.getElementById('task-date').addEventListener('change', event => {
  document.getElementById('task-end-date').min = event.currentTarget.value;
});
const taskTimeInput = document.getElementById('task-time');
const taskTimeDesktopInput = document.getElementById('task-time-desktop');
const syncTaskTimeLabel = () => {
  taskTimeDesktopInput.value = taskTimeInput.value;
  taskTimeInput.closest('.time-field').classList.toggle('has-time', Boolean(taskTimeInput.value));
};
taskTimeInput.addEventListener('input', syncTaskTimeLabel);
taskTimeInput.addEventListener('change', syncTaskTimeLabel);
document.getElementById('schedule-add-btn').addEventListener('click', () => toggleScheduleQuickAdd());
document.getElementById('schedule-save-btn').addEventListener('click', addScheduledTaskFromCalendar);
document.getElementById('schedule-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addScheduledTaskFromCalendar(); });
const scheduleTaskTimeInput = document.getElementById('schedule-task-time');
const scheduleTaskTimeDesktopInput = document.getElementById('schedule-task-time-desktop');
taskTimeDesktopInput.innerHTML = scheduleTaskTimeDesktopInput.innerHTML;
taskTimeDesktopInput.addEventListener('change', event => {
  taskTimeInput.value = event.currentTarget.value;
  syncTaskTimeLabel();
});
const syncScheduleTimeLabel = () => {
  scheduleTaskTimeInput.closest('.time-field').classList.toggle('has-time', Boolean(scheduleTaskTimeInput.value));
};
scheduleTaskTimeInput.addEventListener('input', syncScheduleTimeLabel);
scheduleTaskTimeInput.addEventListener('change', syncScheduleTimeLabel);
scheduleTaskTimeDesktopInput.addEventListener('change', event => {
  scheduleTaskTimeInput.value = event.currentTarget.value;
  syncScheduleTimeLabel();
});
syncTaskTimeLabel();
syncScheduleTimeLabel();
document.getElementById('ai-weekday-btn').addEventListener('click', applyRoutineSuggestionsToWeekdays);
document.getElementById('ai-dismiss-btn').addEventListener('click', () => {
  localStorage.setItem(AI_ADDON_DISMISS_KEY, '1');
  renderAiAddons();
});
document.getElementById('dashboard-edit-btn').addEventListener('click', () => {
  const editor = document.getElementById('dashboard-editor');
  setDashboardEditorOpen(editor.classList.contains('hidden'));
});
document.getElementById('dashboard-editor-close').addEventListener('click', () => setDashboardEditorOpen(false));
document.getElementById('dashboard-template-row').addEventListener('click', event => {
  const button = event.target.closest('[data-dashboard-template]');
  if (!button) return;
  applyDashboardTemplate(button.dataset.dashboardTemplate);
});
document.getElementById('dashboard-section-picker').addEventListener('change', event => {
  if (event.target.matches('input[type="checkbox"]')) {
    toggleDashboardSection(event.target.value, event.target.checked);
  }
});
document.getElementById('dashboard-section-picker').addEventListener('dragstart', event => {
  const option = event.target.closest('[data-dashboard-section-key]');
  if (!option) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', option.dataset.dashboardSectionKey);
  option.classList.add('dragging');
});
document.getElementById('dashboard-section-picker').addEventListener('dragover', event => {
  const option = event.target.closest('[data-dashboard-section-key]');
  if (!option) return;
  event.preventDefault();
  option.classList.add('drag-over');
});
document.getElementById('dashboard-section-picker').addEventListener('dragleave', event => {
  const option = event.target.closest('[data-dashboard-section-key]');
  if (option) option.classList.remove('drag-over');
});
document.getElementById('dashboard-section-picker').addEventListener('drop', event => {
  const option = event.target.closest('[data-dashboard-section-key]');
  if (!option) return;
  event.preventDefault();
  document.querySelectorAll('.dashboard-section-option.drag-over').forEach(item => item.classList.remove('drag-over'));
  moveDashboardSection(event.dataTransfer.getData('text/plain'), option.dataset.dashboardSectionKey);
});
document.getElementById('dashboard-section-picker').addEventListener('dragend', () => {
  document.querySelectorAll('.dashboard-section-option.dragging, .dashboard-section-option.drag-over').forEach(item => {
    item.classList.remove('dragging', 'drag-over');
  });
});
document.getElementById('tab-dashboard').addEventListener('click', event => {
  if (event.target.closest('button, input, select, textarea, a, .dashboard-editor')) return;
  const section = event.target.closest('[data-dashboard-section]');
  if (!section || section.dataset.dashboardSection === 'metrics') return;
  openDashboardOverview(section.dataset.dashboardSection);
});
document.getElementById('dashboard-overview-close').addEventListener('click', closeDashboardOverview);
document.getElementById('dashboard-overview-backdrop').addEventListener('click', closeDashboardOverview);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeDashboardOverview();
  }
});
document.getElementById('birthday-add-btn').addEventListener('click', addBirthday);
document.getElementById('birthday-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') addBirthday(); });
document.getElementById('calendar-prev').addEventListener('click', () => {
  const monthDate = new Date(`${calendarMonth}T12:00:00`);
  monthDate.setMonth(monthDate.getMonth() - 1);
  calendarMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
  renderCalendar();
});
document.getElementById('calendar-next').addEventListener('click', () => {
  const monthDate = new Date(`${calendarMonth}T12:00:00`);
  monthDate.setMonth(monthDate.getMonth() + 1);
  calendarMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
  renderCalendar();
});
document.getElementById('schedule-today').addEventListener('click', () => selectDate(getTodayISO()));
document.getElementById('custom-timer-btn').addEventListener('click', applyCustomTimer);
document.getElementById('custom-timer-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') applyCustomTimer();
});
setupLiquidPresetDrag();

// ── Theme ──
function setThemeLabels(theme) {
  const nextMode = theme === 'dark' ? 'Light' : 'Dark';
  document.getElementById('theme-label').textContent = `${nextMode} mode`;
  document.getElementById('menu-theme-label').textContent = window.innerWidth <= 640 ? nextMode : `${nextMode} mode`;
  const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
  if (mobileThemeToggle) {
    mobileThemeToggle.setAttribute('aria-label', `Switch to ${nextMode.toLowerCase()} mode`);
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('focusup-theme', theme);
  setThemeLabels(theme);
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
document.getElementById('menu-theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  if (window.innerWidth <= 640) {
    setMobileMenu(false);
  }
});
document.getElementById('mobile-theme-toggle')?.addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
document.getElementById('mobile-signout')?.addEventListener('click', handleSignOut);
setTheme(localStorage.getItem('focusup-theme') || 'dark');

// ── Render All ──
function renderAll() {
  document.getElementById('task-date').value = selectedDate;
  document.getElementById('repeat-select').value = 'none';
  document.getElementById('schedule-repeat-select').value = 'none';
  document.getElementById('schedule-toggle').checked = false;
  updateScheduleToggleUI();
  renderTasks();
  updateTasksSub();
  updateXPUI();
  renderLevels();
  renderDashboardEditor();
  renderDashboard();
  renderCalendar();
  renderSchedule();
  renderBirthdays();
  renderAiAddons();
  document.getElementById('s-streak').textContent = state.streak;
  updateTimerDisplay();
  updateTimerXPUI();
  document.getElementById('sessions-today').textContent = state.sessions;
  document.getElementById('mins-focused').textContent = state.minsFocused;
  document.getElementById('s-sessions').textContent = state.sessions;
  document.getElementById('s-done').textContent = state.tasksDone;
}

// ── Boot ──
initAuth();
