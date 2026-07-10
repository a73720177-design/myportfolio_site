let todos = [];

// config.js는 index.html에서 script.js보다 먼저 불러옵니다.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const TODO_TABLE = 'todos';

function fromDbTodo(row){
  return {
    // HTML data-* 값은 항상 문자열이므로 DB id도 문자열로 통일합니다.
    id: String(row.id),
    title: row.title,
    category: row.category || '기타',
    priority: row.priority || 'medium',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    group: row.group_name || 'today',
    done: Boolean(row.done)
  };
}

function toDbTodo(todo){
  return {
    title: todo.title,
    category: todo.category,
    priority: todo.priority,
    start_time: todo.startTime || null,
    end_time: todo.endTime || null,
    group_name: todo.group,
    done: todo.done
  };
}

function showDbError(action, error){
  console.error(`Supabase ${action} 실패:`, error);
  const detail = error?.message ? `\n${error.message}` : '';
  alert(`${action}에 실패했습니다.${detail}`);
}

async function loadTodos(){
  try {
    const { data, error } = await sb
      .from(TODO_TABLE)
      .select('*')
      .order('created_at', { ascending: true });

    if(error) throw error;
    todos = (data || []).map(fromDbTodo);
    render();
  } catch(error) {
    showDbError('목록 불러오기', error);
  }
}


let currentFilter = 'all';
let editingId = null; // id of the todo currently being edited, or null

const listEl = document.getElementById('list');
const tabs = document.querySelectorAll('.tab');

const PRIORITY_LABEL = { low: '낮음', medium: '중간', high: '높음' };
const PRIORITY_ORDER = { low: 0, medium: 1, high: 2 };

function priorityLabel(p){ return PRIORITY_LABEL[p] || p; }

function formatTimeKR(t){
  if(!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  const period = h < 12 ? '오전' : '오후';
  let hour12 = h % 12;
  if(hour12 === 0) hour12 = 12;
  return `${period} ${hour12}:${String(m).padStart(2, '0')}`;
}

function formatTimeRangeKR(todo){
  if(todo.startTime && todo.endTime) return `${formatTimeKR(todo.startTime)} – ${formatTimeKR(todo.endTime)}`;
  if(todo.startTime) return formatTimeKR(todo.startTime);
  return '';
}

function priorityOptionsHtml(selected){
  return ['low', 'medium', 'high'].map(p =>
    `<option value="${p}" ${p === selected ? 'selected' : ''}>${priorityLabel(p)}</option>`
  ).join('');
}

function renderTodoItem(todo){
  if(editingId === todo.id){
    return renderEditForm(todo);
  }

  const timeText = formatTimeRangeKR(todo);
  const priorityHtml = `
    <div class="dot"></div>
    <span class="priority ${todo.priority}"><span class="pdot"></span>${priorityLabel(todo.priority)}</span>
  `;
  const timeHtml = timeText ? `
    <div class="dot"></div>
    <span class="time">${timeText}</span>
  ` : '';

  return `
    <div class="todo-item ${todo.done ? 'done' : 'pending'}" data-id="${todo.id}">
      <button class="checkbox ${todo.done ? 'checked' : ''}" data-id="${todo.id}" aria-label="완료 표시"></button>
      <div class="todo-body">
        <p class="todo-title">${escapeHtml(todo.title)}</p>
        <div class="todo-meta">
          <span class="category">${escapeHtml(todo.category)}</span>
          ${priorityHtml}
          ${timeHtml}
        </div>
      </div>
      <div class="item-actions">
        <button class="edit-btn" data-id="${todo.id}">수정</button>
        <button class="delete-btn" data-id="${todo.id}">삭제</button>
      </div>
    </div>
  `;
}

function renderEditForm(todo){
  return `
    <div class="todo-item" data-id="${todo.id}">
      <form class="edit-form" data-id="${todo.id}">
        <div class="form-row">
          <input type="text" class="edit-title" value="${escapeHtml(todo.title)}" placeholder="할 일을 입력하세요" />
        </div>
        <div class="form-row">
          <input type="text" class="edit-category" value="${escapeHtml(todo.category)}" placeholder="카테고리" style="max-width:120px" />
          <select class="edit-priority">
            ${priorityOptionsHtml(todo.priority)}
          </select>
        </div>
        <div class="form-row time-row">
          <label>시작 <input type="time" class="edit-start" value="${todo.startTime || ''}" /></label>
          <label>종료 <input type="time" class="edit-end" value="${todo.endTime || ''}" /></label>
        </div>
        <div class="form-buttons">
          <button type="button" class="secondary cancel-edit-btn" data-id="${todo.id}">취소</button>
          <button type="submit" class="primary">저장</button>
        </div>
      </form>
    </div>
  `;
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSection(label, items, extraClass){
  if(items.length === 0) return '';
  const countHtml = extraClass === 'today' ? '' : `<span class="count">${items.length}개</span>`;
  return `
    <div class="section-label ${extraClass}">
      <span>${label}</span>
      <div class="rule"></div>
      ${countHtml}
    </div>
    ${items.map(renderTodoItem).join('')}
  `;
}

function render(){
  let filtered = todos;
  if(currentFilter === 'done'){
    filtered = todos.filter(t => t.done);
  } else if(currentFilter === 'priority'){
    filtered = [...todos].sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
  }

  if(currentFilter === 'all' || currentFilter === 'priority'){
    const yesterday = filtered.filter(t => t.group === 'yesterday' && !t.done);
    const today = filtered.filter(t => t.group !== 'yesterday' || t.done);
    let html = renderSection('어제 완료하지 못한 일', yesterday, '');
    html += renderSection('오늘 할 일', today, 'today');
    listEl.innerHTML = html || '<div class="empty-state">할 일이 없어요. 새 항목을 추가해보세요.</div>';
  } else {
    listEl.innerHTML = filtered.length
      ? filtered.map(renderTodoItem).join('')
      : '<div class="empty-state">완료된 항목이 없어요.</div>';
  }

  attachListEvents();
  updateProgress();
}

function attachListEvents(){
  document.querySelectorAll('.checkbox').forEach(cb => {
    cb.addEventListener('click', () => toggleDone(cb.dataset.id));
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = btn.dataset.id;
      render();
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTodo(btn.dataset.id));
  });

  document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingId = null;
      render();
    });
  });

  document.querySelectorAll('.edit-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.dataset.id;
      saveEdit(id, form);
    });
  });
}

async function saveEdit(id, form){
  const title = form.querySelector('.edit-title').value.trim();
  if(!title) return;
  const category = form.querySelector('.edit-category').value.trim() || '기타';
  const priority = form.querySelector('.edit-priority').value;
  const startTime = form.querySelector('.edit-start').value;
  const endTime = form.querySelector('.edit-end').value;

  const todo = todos.find(t => t.id === id);
  if(!todo) return;

  const changedTodo = { ...todo, title, category, priority, startTime, endTime };
  const { data, error } = await sb
    .from(TODO_TABLE)
    .update(toDbTodo(changedTodo))
    .eq('id', id)
    .select()
    .single();

  if(error){
    showDbError('할 일 수정', error);
    return;
  }

  todos = todos.map(t => t.id === id ? fromDbTodo(data) : t);
  editingId = null;
  render();
}

async function deleteTodo(id){
  const { error } = await sb.from(TODO_TABLE).delete().eq('id', id);
  if(error){
    showDbError('할 일 삭제', error);
    return;
  }

  todos = todos.filter(t => t.id !== id);
  if(editingId === id) editingId = null;
  render();
}

function updateProgress(){
  const total = todos.length;
  const done = todos.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('percentValue').innerHTML = `${pct}<span class="percent-sign">%</span>`;
  document.getElementById('percentLabel').textContent = `${done} / ${total} 완료`;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('countAll').textContent = total;
}

async function toggleDone(id){
  const todo = todos.find(t => t.id === id);
  if(!todo) return;

  const { data, error } = await sb
    .from(TODO_TABLE)
    .update(toDbTodo({ ...todo, done: !todo.done }))
    .eq('id', id)
    .select()
    .single();

  if(error){
    showDbError('완료 상태 변경', error);
    return;
  }

  todos = todos.map(t => t.id === id ? fromDbTodo(data) : t);
  render();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    editingId = null;
    render();
  });
});

const addForm = document.getElementById('addForm');
document.getElementById('showAddForm').addEventListener('click', () => {
  addForm.classList.toggle('open');
  if(addForm.classList.contains('open')) document.getElementById('newTitle').focus();
});

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('newTitle').value.trim();
  if(!title) return;
  const category = document.getElementById('newCategory').value.trim() || '기타';
  const priority = document.getElementById('newPriority').value;
  const startTime = document.getElementById('newStart').value;
  const endTime = document.getElementById('newEnd').value;

  const newTodo = {
    title,
    category,
    priority,
    startTime,
    endTime,
    group: 'today', // new items always go into today's list
    done: false
  };

  const submitButton = addForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data, error } = await sb
    .from(TODO_TABLE)
    .insert(toDbTodo(newTodo))
    .select()
    .single();

  submitButton.disabled = false;
  if(error){
    showDbError('할 일 추가', error);
    return;
  }

  todos.push(fromDbTodo(data));

  document.getElementById('newTitle').value = '';
  document.getElementById('newCategory').value = '';
  document.getElementById('newStart').value = '';
  document.getElementById('newEnd').value = '';
  addForm.classList.remove('open');
  render();
});

render();
loadTodos();
