const STORAGE_KEY = 'poop-calendar.days.v1';
const LEGACY_KEY = 'gutlog.records.v1';
let days = loadDays();
let cursor = new Date();
let toastTimer;

const $ = id => document.getElementById(id);

function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
}
function dayDiff(a,b) {
  const aa = new Date(a.getFullYear(),a.getMonth(),a.getDate());
  const bb = new Date(b.getFullYear(),b.getMonth(),b.getDate());
  return Math.round((aa-bb)/86400000);
}
function loadDays() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved) && saved.length) return [...new Set(saved)].sort();
    // 自动兼容上一版详细记录：只保留“哪一天有记录”。
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      const migrated = [...new Set(legacy.map(x => x.date).filter(Boolean))].sort();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (_) {}
  return [];
}
function saveDays() {
  days = [...new Set(days)].sort();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}
function hasDay(s) { return days.includes(s); }
function toggleDay(s) {
  if (hasDay(s)) {
    days = days.filter(x => x !== s);
    showToast('已取消这一天');
  } else {
    days.push(s);
    showToast('已记下 💩');
  }
  saveDays();
  renderAll();
}
function fmtMonthDay(s) {
  const d = parseDate(s);
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function renderToday() {
  const now = new Date();
  const today = localDateString(now);
  const marked = hasDay(today);
  const weekdays = ['日','一','二','三','四','五','六'];
  $('todayDate').textContent = `${now.getMonth()+1}月${now.getDate()}日 · 周${weekdays[now.getDay()]}`;
  $('todayStatus').textContent = marked ? '今天已记录 ✓' : '今天还没记录';
  $('checkinLabel').textContent = marked ? '取消今天' : '今天拉了';
  $('checkinBtn').classList.toggle('done', marked);
  $('checkinBtn').setAttribute('aria-pressed', marked ? 'true' : 'false');

  const past = days.filter(x => x <= today).sort();
  if (!past.length) {
    $('lastText').textContent = '点一下就记住，不需要填写其他东西。';
    return;
  }
  const last = past[past.length-1];
  const gap = dayDiff(now, parseDate(last));
  if (gap === 0) $('lastText').textContent = '最近一次就是今天。';
  else if (gap === 1) $('lastText').textContent = '上一次记录是昨天。';
  else $('lastText').textContent = `上一次记录是 ${fmtMonthDay(last)}，距今 ${gap} 天。`;
}

function renderCalendar() {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  $('monthTitle').textContent = `${y}年 ${m+1}月`;
  const monthDays = days.filter(s => {
    const d = parseDate(s);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  $('monthSummary').textContent = monthDays.length ? `这个月 ${monthDays.length} 天有记录` : '这个月还没有记录';

  const first = new Date(y,m,1);
  const mondayOffset = (first.getDay()+6)%7;
  const start = new Date(y,m,1-mondayOffset);
  const today = localDateString();
  let html = '';
  for (let i=0;i<42;i++) {
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const ds = localDateString(d);
    const cls = ['day'];
    if (d.getMonth() !== m) cls.push('other');
    if (ds === today) cls.push('today');
    if (hasDay(ds)) cls.push('marked');
    html += `<button class="${cls.join(' ')}" data-date="${ds}" aria-label="${ds}${hasDay(ds)?'，已记录':'，未记录'}">${d.getDate()}</button>`;
  }
  $('calendar').innerHTML = html;
  $('calendar').querySelectorAll('.day').forEach(el => el.addEventListener('click', () => toggleDay(el.dataset.date)));
}

function renderStats() {
  const today = new Date();
  const todayS = localDateString(today);
  const start = new Date(today); start.setDate(today.getDate()-29);
  const list30 = days.filter(s => {
    const d = parseDate(s);
    return d >= new Date(start.getFullYear(),start.getMonth(),start.getDate()) && d <= new Date(today.getFullYear(),today.getMonth(),today.getDate());
  });
  $('days30').textContent = list30.length;

  const past = days.filter(s => s <= todayS).sort();
  if (past.length >= 2) {
    const gaps = [];
    for (let i=1;i<past.length;i++) gaps.push(dayDiff(parseDate(past[i]), parseDate(past[i-1])));
    $('avgGap').textContent = (gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(1);
  } else $('avgGap').textContent = '—';

  if (past.length) {
    const gap = dayDiff(today, parseDate(past[past.length-1]));
    $('currentGap').textContent = gap;
    if (gap <= 1) $('trendNote').textContent = '最近有记录。继续只记日期即可，时间久了就能看到自己的排便频率规律。';
    else if (gap === 2) $('trendNote').textContent = '距离上一次记录 2 天。若你每天都会及时记，这能帮你观察自己的排便间隔是否和平时不同。';
    else $('trendNote').textContent = `距离上一次记录 ${gap} 天。这里不做诊断；如果这确实代表连续多天没有排便且你同时明显不舒服，可以考虑咨询医生。`;
  } else {
    $('currentGap').textContent = '—';
    $('trendNote').textContent = '数据够多以后，这里只做频率趋势提示，不要求你记录任何细节。';
  }
}

function renderAll() {
  renderToday();
  renderCalendar();
  renderStats();
}

function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}
function download(filename, content, type='application/json') {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('checkinBtn').addEventListener('click', () => toggleDay(localDateString()));
$('todayBtn').addEventListener('click', () => { cursor = new Date(); renderCalendar(); });
$('prevMonth').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(),cursor.getMonth()-1,1); renderCalendar(); });
$('nextMonth').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(),cursor.getMonth()+1,1); renderCalendar(); });
$('exportBtn').addEventListener('click', () => download(`poop-calendar-${localDateString()}.json`, JSON.stringify({version:1, days}, null, 2)));
$('importInput').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.days;
    if (!Array.isArray(incoming)) throw new Error();
    days = [...new Set(incoming.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
    saveDays(); renderAll(); showToast('记录已导入');
  } catch (_) { alert('这个文件无法识别。'); }
  e.target.value = '';
});

renderAll();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
