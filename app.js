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

// ── State ──
let currentUser = null;
let state = defaultState();
let saveTimeout = null;
let selectedDate = getTodayISO();
let calendarMonth = startOfMonth(selectedDate);
let editingTaskId = null;
let leaderboard = {
  entries: [],
  currentUserRank: null,
  loaded: false,
  error: false,
};

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
  if (task.kind === 'birthday') {
    return `${dateLabel} • Birthday`;
  }
  const base = task.scheduledTime ? `${dateLabel} at ${task.scheduledTime}` : dateLabel;
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
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  currentUser = session.user;
  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
  document.getElementById('user-name').textContent = username;
  document.getElementById('user-avatar').textContent = username.charAt(0).toUpperCase();
  document.getElementById('mobile-appbar-avatar').textContent = username.charAt(0).toUpperCase();
  await loadProfile();
  await loadLeaderboard();
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
  await loadLeaderboard();
}

function getProfileDisplayName(profile) {
  if (!profile) return 'Unknown';
  if (profile.id === currentUser?.id) {
    return currentUser.user_metadata?.username || currentUser.email.split('@')[0];
  }
  return profile.username || 'Anonymous';
}

function getCurrentUserLeaderboardEntry() {
  if (!currentUser) return null;
  return {
    id: currentUser.id,
    username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
    xp: state.xp,
    tasks_done: state.tasksDone,
    sessions: state.sessions,
    streak: state.streak,
  };
}

async function loadLeaderboard() {
  if (!currentUser) return;

  const { data, error } = await db.rpc('get_global_leaderboard', {
    result_limit: 5,
  });

  if (error) {
    leaderboard = {
      entries: [],
      currentUserRank: null,
      loaded: true,
      error: true,
    };
    renderLeaderboard();
    return;
  }

  const topEntries = (data || []).map(profile => ({
    id: profile.id,
    username: profile.username || 'Anonymous',
    xp: profile.xp || 0,
    tasks_done: profile.tasks_done || 0,
    sessions: profile.sessions || 0,
    streak: profile.streak || 0,
    rank: profile.rank || null,
  }));

  leaderboard = {
    entries: topEntries,
    currentUserRank: null,
    loaded: true,
    error: false,
  };

  renderLeaderboard();
}

async function handleSignOut() {
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

  if (enabled && !document.getElementById('task-date').value) {
    document.getElementById('task-date').value = selectedDate;
  }
}

function toggleScheduleQuickAdd(forceOpen) {
  const panel = document.getElementById('schedule-quick-add');
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !shouldOpen);
  if (shouldOpen) {
    document.getElementById('schedule-task-input').focus();
  }
}

function addScheduledTaskFromCalendar() {
  const input = document.getElementById('schedule-task-input');
  const timeInput = document.getElementById('schedule-task-time');
  const repeat = document.getElementById('schedule-repeat-select').value;
  const priority = document.getElementById('schedule-priority-select').value;
  const name = input.value.trim();
  if (!name) return;

  state.tasks.unshift(createTask({
    id: makeTaskId(),
    name,
    priority,
    done: false,
    scheduledFor: selectedDate,
    scheduledTime: timeInput.value || '',
    repeat,
    completedDates: [],
    kind: 'task',
  }));

  input.value = '';
  timeInput.value = '';
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
  const timeInput = document.getElementById('task-time');
  const repeat = document.getElementById('repeat-select').value;
  const priority = document.getElementById('priority-select').value;
  const name = input.value.trim();
  if (!name) return;
  state.tasks.unshift(createTask({
    id: makeTaskId(),
    name,
    priority,
    done: false,
    scheduledFor: scheduleToggle.checked ? (dateInput.value || selectedDate) : '',
    scheduledTime: scheduleToggle.checked ? (timeInput.value || '') : '',
    repeat: scheduleToggle.checked ? repeat : 'none',
    completedDates: [],
    kind: 'task',
  }));
  input.value = '';
  dateInput.value = selectedDate;
  timeInput.value = '';
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

  if (!task.repeat || task.repeat === 'none') {
    return task.scheduledFor === isoDate;
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

  if (!name) {
    showToast('Name is required');
    return;
  }

  if (!date) {
    showToast('Date is required');
    return;
  }

  touchTask(task, { scheduledFor: date });

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
  if (tasks.length === 0) { el.innerHTML = '<div class="empty-state">No active tasks right now. Add one above!</div>'; return; }
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  el.innerHTML = tasks.map(t => `
    <div class="task-item">
      <button class="check-btn" onclick="toggleTask(${t.id}, '${today}')"></button>
      <div class="task-main">
        <span class="task-name">${escapeHtml(t.name)}</span>
        <div class="task-meta">
          <span class="task-schedule ${t.scheduledFor ? '' : 'empty'}">${escapeHtml(formatTaskSchedule(t))}</span>
        </div>
      </div>
      <span class="priority-pill ${t.priority}">${priorityLabel[t.priority]}</span>
      <button class="action-btn" type="button" onclick="editTask(${t.id})">Edit</button>
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

function setPreset(mins, el) {
  selectedMinutes = mins;
  timerSeconds = mins * 60;
  document.querySelectorAll('.preset').forEach(p => p.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  }
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
        <span class="calendar-count">${tasks.length ? `${tasks.length} task${tasks.length > 1 ? 's' : ''}` : ''}</span>
      </button>
    `);
  }

  grid.innerHTML = cells.join('');
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

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const subtitle = document.getElementById('leaderboard-sub');
  if (!list || !subtitle) return;

  if (!leaderboard.loaded) {
    subtitle.textContent = 'Loading top players';
    list.innerHTML = '<div class="schedule-empty">Loading leaderboard...</div>';
    renderDashboard();
    return;
  }

  if (leaderboard.error) {
    subtitle.textContent = 'Leaderboard unavailable right now';
    list.innerHTML = '<div class="schedule-empty">Could not load leaderboard.</div>';
    renderDashboard();
    return;
  }

  const uniqueEntries = [];
  const seenIds = new Set();
  leaderboard.entries.forEach(entry => {
    if (!entry || seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    uniqueEntries.push(entry);
  });

  if (!uniqueEntries.length) {
    subtitle.textContent = 'No ranking data yet';
    list.innerHTML = '<div class="schedule-empty">No leaderboard data yet.</div>';
    renderDashboard();
    return;
  }

  subtitle.textContent = 'Global Top 5 by XP';

  const currentEntry = getCurrentUserLeaderboardEntry();
  list.innerHTML = uniqueEntries.map((entry, index) => {
    const isCurrentUser = entry.id === currentEntry?.id;
    const rank = entry.rank || index + 1;
    const medalClass = rank <= 3 ? `rank-${rank}` : '';
    return `
      <div class="leaderboard-row ${medalClass} ${isCurrentUser ? 'is-current-user' : ''}">
        <div class="leaderboard-rank">#${rank}</div>
        <div class="leaderboard-user">
          <div class="leaderboard-name">
            <span>${escapeHtml(getProfileDisplayName(entry))}</span>
            ${isCurrentUser ? '<span class="leaderboard-you">You</span>' : ''}
          </div>
          <div class="leaderboard-meta">${entry.tasks_done || 0} tasks done • ${entry.sessions || 0} focus sessions • ${entry.streak || 0} day streak</div>
        </div>
        <div class="leaderboard-score">
          <div class="leaderboard-xp">${entry.xp || 0}</div>
          <div class="leaderboard-score-label">XP</div>
        </div>
      </div>
    `;
  }).join('');
  renderDashboard();
}

function renderDashboard() {
  const tab = document.getElementById('tab-dashboard');
  if (!tab) return;

  const today = getTodayISO();
  const activeTasks = state.tasks.filter(task => task.kind === 'task' && !shouldHideTaskFromViews(task, today));
  const doneToday = state.tasks.filter(task => task.kind === 'task' && isTaskDoneOn(task, today)).length;
  const upcomingItems = [];
  const weekItems = [];

  for (let index = 0; index < 21 && upcomingItems.length < 6; index++) {
    const date = addDays(today, index);
    getVisibleTasksForDate(date).forEach(task => {
      if (upcomingItems.length >= 6) return;
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
    .slice(0, 4);

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
  ].slice(0, 5);

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
  const taskPreview = [...activeTasks.slice(0, 3)];
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  state.tasks
    .filter(task => task.kind === 'task' && isTaskDoneOn(task, today))
    .slice(0, 2)
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
  weekList.innerHTML = weekItems.map(entry => {
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

  const miniLeaderboard = document.getElementById('dashboard-leaderboard-list');
  const leaderboardSub = document.getElementById('dashboard-leaderboard-sub');
  if (!leaderboard.loaded) {
    leaderboardSub.textContent = 'Loading current ranking.';
    miniLeaderboard.innerHTML = '<div class="dashboard-empty">Loading leaderboard...</div>';
    return;
  }

  if (leaderboard.error) {
    leaderboardSub.textContent = 'Ranking is unavailable right now.';
    miniLeaderboard.innerHTML = '<div class="dashboard-empty">Could not load leaderboard right now.</div>';
    return;
  }

  const uniqueEntries = [];
  const seenIds = new Set();
  leaderboard.entries.forEach(entry => {
    if (!entry || seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    uniqueEntries.push(entry);
  });

  if (!uniqueEntries.length) {
    leaderboardSub.textContent = 'No ranking data yet.';
    miniLeaderboard.innerHTML = '<div class="dashboard-empty">No leaderboard data yet.</div>';
    return;
  }

  leaderboardSub.textContent = 'A quick look at the current top players.';
  miniLeaderboard.innerHTML = uniqueEntries.slice(0, 3).map((entry, index) => `
    <div class="dashboard-list-item ${entry.id === currentUser?.id ? 'is-current-user' : ''}">
      <div class="dashboard-rank">#${entry.rank || index + 1}</div>
      <div class="dashboard-list-main">
        <div class="dashboard-list-title ${entry.id === currentUser?.id ? 'is-current-user' : ''}">${escapeHtml(getProfileDisplayName(entry))}</div>
        <div class="dashboard-list-meta">${entry.xp || 0} XP • ${entry.tasks_done || 0} tasks • ${entry.sessions || 0} sessions</div>
      </div>
    </div>
  `).join('');
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
function activateTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === `tab-${tab}`);
  });
  if (window.innerWidth <= 640) {
    setMobileMenu(false);
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

mobileMenuToggle.addEventListener('click', toggleMobileMenu);
mobileMenuOverlay.addEventListener('click', () => setMobileMenu(false));

window.addEventListener('resize', () => {
  if (window.innerWidth > 640) {
    setMobileMenu(false);
  }
});

document.getElementById('filter-select').addEventListener('change', renderTasks);
document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
document.getElementById('schedule-toggle').addEventListener('change', updateScheduleToggleUI);
document.getElementById('schedule-add-btn').addEventListener('click', () => toggleScheduleQuickAdd());
document.getElementById('schedule-save-btn').addEventListener('click', addScheduledTaskFromCalendar);
document.getElementById('schedule-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addScheduledTaskFromCalendar(); });
document.getElementById('ai-weekday-btn').addEventListener('click', applyRoutineSuggestionsToWeekdays);
document.getElementById('ai-dismiss-btn').addEventListener('click', () => {
  localStorage.setItem(AI_ADDON_DISMISS_KEY, '1');
  renderAiAddons();
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

// ── Theme ──
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('focusup-theme', theme);
  document.getElementById('theme-label').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
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
  renderLeaderboard();
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
