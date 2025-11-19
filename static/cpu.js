function pastel(seed) { const base = [Math.sin(seed + 1) * 127 + 128, Math.sin(seed + 2) * 127 + 128, Math.sin(seed + 3) * 127 + 128]; const [r, g, b] = base.map(v => Math.round((v + 255) / 2)); return `rgb(${r}, ${g}, ${b})` }

const algoTitle = document.getElementById('algoTitle');
const algoDesc = document.getElementById('algoDesc');
const algoSnippet = document.getElementById('algoSnippet');
const quantumField = document.getElementById('quantumField');
const quantumEl = document.getElementById('quantum');
const tableBody = document.querySelector('#procTable tbody');
const ganttEl = document.getElementById('gantt');
const metricsEl = document.getElementById('metrics');

const tabs = document.getElementById('tabs');
const addBtn = document.getElementById('addProcess');
const runBtn = document.getElementById('run');
const resetBtn = document.getElementById('reset');

let mode = 'FCFS';
let processes = [
    { id: 'P1', arrival: 0, burst: 4, color: pastel(1) },
    { id: 'P2', arrival: 1, burst: 3, color: pastel(2) },
    { id: 'P3', arrival: 2, burst: 5, color: pastel(3) }
];

function renderTable() {
    tableBody.innerHTML = '';
    processes.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.id}</td>
      <td><input type="number" min="0" value="${p.arrival}" data-idx="${idx}" data-field="arrival"/></td>
      <td><input type="number" min="1" value="${p.burst}" data-idx="${idx}" data-field="burst"/></td>
      <td><span class="color-dot" style="background:${p.color}"></span></td>
      <td><button class="danger" data-action="del" data-idx="${idx}" type="button">Delete</button></td>`;
        tableBody.appendChild(tr);
    })
}

function onTable(e) {
    const t = e.target;
    if (t.tagName === 'INPUT') {
        const idx = +t.dataset.idx;
        const field = t.dataset.field;
        const val = +t.value;
        processes[idx][field] = field === 'arrival' ? Math.max(0, val) : Math.max(1, val);
    } else if (t.dataset.action === 'del') {
        processes.splice(+t.dataset.idx, 1);
        renderTable();
    }
}

function addProcess() {
    const id = `P${processes.length+1}`;
    processes.push({ id, arrival: 0, burst: 1, color: pastel(processes.length + 5) });
    renderTable();
}

// Algorithms
function fcfs(proc) {
    const p = [...proc].sort((a, b) => a.arrival - b.arrival);
    const gantt = [];
    let time = 0;
    const completion = new Map();
    for (const pr of p) {
        if (time < pr.arrival) time = pr.arrival;
        const start = time;
        const end = time + Number(pr.burst);
        gantt.push({ id: pr.id, color: pr.color, start, end });
        time = end;
        completion.set(pr.id, time);
    }
    return finalize(proc, completion, gantt);
}

function sjf(proc) {
    const ready = [...proc].map(p => ({ id: p.id, arrival: +p.arrival, burst: +p.burst, color: p.color }));
    ready.sort((a, b) => a.arrival - b.arrival);
    const gantt = [];
    const completion = new Map();
    let time = 0;
    let i = 0;
    const heap = [];
    while (i < ready.length || heap.length) {
        if (!heap.length && i < ready.length && time < ready[i].arrival) time = ready[i].arrival;
        while (i < ready.length && ready[i].arrival <= time) {
            heap.push(ready[i++]);
            heap.sort((a, b) => a.burst - b.burst);
        }
        if (!heap.length) continue;
        const cur = heap.shift();
        const start = time;
        const end = time + cur.burst;
        gantt.push({ id: cur.id, color: cur.color, start, end });
        time = end;
        completion.set(cur.id, time);
    }
    return finalize(proc, completion, gantt);
}

function rr(proc, quantum) {
    const ready = proc.map(p => ({ id: p.id, arrival: +p.arrival, burst: +p.burst, remaining: +p.burst, color: p.color })).sort((a, b) => a.arrival - b.arrival);
    const gantt = [];
    const completion = new Map();
    let time = 0;
    let i = 0;
    const q = [];
    while (i < ready.length || q.length) {
        if (!q.length && i < ready.length && time < ready[i].arrival) time = ready[i].arrival;
        while (i < ready.length && ready[i].arrival <= time) q.push(ready[i++]);
        if (!q.length) continue;
        const cur = q.shift();
        const run = Math.min(quantum, cur.remaining);
        const start = time;
        const end = time + run;
        gantt.push({ id: cur.id, color: cur.color, start, end });
        cur.remaining -= run;
        time = end;
        while (i < ready.length && ready[i].arrival <= time) q.push(ready[i++]);
        if (cur.remaining > 0) q.push(cur);
        else completion.set(cur.id, time);
    }
    return finalize(proc, completion, gantt);
}

function finalize(proc, completion, gantt) {
    const waiting = new Map(),
        turnaround = new Map();
    proc.forEach(p => {
        const ct = completion.get(p.id);
        const tat = ct - +p.arrival;
        const wt = tat - +p.burst;
        waiting.set(p.id, wt);
        turnaround.set(p.id, tat);
    });
    const avgWT = [...waiting.values()].reduce((a, b) => a + b, 0) / (waiting.size || 1);
    const avgTAT = [...turnaround.values()].reduce((a, b) => a + b, 0) / (turnaround.size || 1);
    return { gantt, waiting, turnaround, avgWT, avgTAT };
}

function snippetFor(m) {
    if (m === 'FCFS') return `function fcfs(proc){\n  const p=[...proc].sort((a,b)=>a.arrival-b.arrival);\n  const gantt=[]; let time=0;\n  for(const pr of p){ if(time<pr.arrival) time=pr.arrival;\n    const start=time, end=time+Number(pr.burst);\n    gantt.push({id:pr.id,color:pr.color,start,end}); time=end; }\n  return gantt;\n}`;
    if (m === 'SJF') return `function sjf(proc){\n  const ready=[...proc].sort((a,b)=>a.arrival-b.arrival);\n  const gantt=[]; let time=0, i=0; const heap=[];\n  while(i<ready.length||heap.length){\n    if(!heap.length&&i<ready.length&&time<ready[i].arrival) time=ready[i].arrival;\n    while(i<ready.length&&ready[i].arrival<=time){ heap.push(ready[i++]); heap.sort((a,b)=>a.burst-b.burst);}\n    const cur=heap.shift(); const start=time, end=time+cur.burst;\n    gantt.push({id:cur.id,color:cur.color,start,end}); time=end;\n  }\n  return gantt;\n}`;
    return `function roundRobin(processes, q){\n  const r=processes.map(p=>({id:p.id,arrival:+p.arrival,burst:+p.burst,remaining:+p.burst,color:p.color}))\n    .sort((a,b)=>a.arrival-b.arrival);\n  const g=[]; let t=0,i=0; const Q=[];\n  while(i<r.length||Q.length){ if(!Q.length&&i<r.length&&t<r[i].arrival) t=r[i].arrival;\n    while(i<r.length&&r[i].arrival<=t) Q.push(r[i++]); if(!Q.length) continue;\n    const c=Q.shift(); const run=Math.min(q,c.remaining); const s=t,e=t+run;\n    g.push({id:c.id,color:c.color,start:s,end:e}); c.remaining-=run; t=e;\n    while(i<r.length&&r[i].arrival<=t) Q.push(r[i++]); if(c.remaining>0) Q.push(c); }\n  return g;\n}`;
}

function switchMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (mode === 'FCFS') {
        algoTitle.textContent = 'First-Come, First-Served (FCFS)';
        algoDesc.textContent = 'Non-preemptive: processes are executed in order of arrival.';
        quantumField.style.display = 'none';
    } else if (mode === 'SJF') {
        algoTitle.textContent = 'Shortest Job First (SJF)';
        algoDesc.textContent = 'Non-preemptive: pick the process with the smallest burst time among arrived.';
        quantumField.style.display = 'none';
    } else {
        algoTitle.textContent = 'Round Robin (RR)';
        algoDesc.textContent = 'Preemptive: fixed time slice per process in a cycle.';
        quantumField.style.display = 'grid';
    }
    algoSnippet.textContent = snippetFor(mode);
    ganttEl.innerHTML = '';
    metricsEl.innerHTML = '';
}

function renderGantt(g) {
    ganttEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'gantt-row';
    const track = document.createElement('div');
    track.className = 'gantt-track';
    g.forEach(seg => {
        const el = document.createElement('div');
        el.className = 'gantt-seg';
        el.style.background = seg.color;
        el.textContent = seg.id;
        el.title = `${seg.id}: ${seg.start} → ${seg.end}`;
        track.appendChild(el);
    });
    const times = document.createElement('div');
    times.className = 'gantt-time';
    if (g.length) {
        const labels = [g[0].start, ...g.map(s => s.end)];
        times.textContent = labels.join('  ');
    }
    row.appendChild(track);
    ganttEl.appendChild(row);
    ganttEl.appendChild(times);
}

function renderMetrics(r) { metricsEl.innerHTML = `<span class="chip">Average Waiting Time: ${r.avgWT.toFixed(2)}</span><span class="chip">Average Turnaround Time: ${r.avgTAT.toFixed(2)}</span>` }

async function run() {
    try {
        const algorithmMap = { 'FCFS': 'FCFS', 'SJF': 'SJF', 'RR': 'RR' };
        const algo = algorithmMap[mode] || 'FCFS';
        const quantum = Math.max(1, +quantumEl.value || 4);
        
        const data = {
            processes: processes.map(p => ({ pid: p.id, arrival: +p.arrival, burst: +p.burst })),
            algorithm: algo,
            quantum: quantum
        };
        
        const response = await fetch('http://127.0.0.1:5000/cpu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        // Map pid back to id and add colors
        const ganttWithColors = result.gantt.map(seg => {
            const proc = processes.find(p => p.id === seg.pid);
            return { ...seg, id: seg.pid, color: proc ? proc.color : '#7c4dff' };
        });
        
        renderGantt(ganttWithColors);
        renderMetrics({ avgWT: result.avg_waiting, avgTAT: result.avg_turnaround });
    } catch (error) {
        console.error('Error calling backend:', error);
        // Fallback to local implementation
        let res;
        if (mode === 'FCFS') res = fcfs(processes);
        else if (mode === 'SJF') res = sjf(processes);
        else res = rr(processes, Math.max(1, +quantumEl.value || 1));
        renderGantt(res.gantt);
        renderMetrics(res);
    }
}

function resetAll() {
    processes = [{ id: 'P1', arrival: 0, burst: 4, color: pastel(1) }, { id: 'P2', arrival: 1, burst: 3, color: pastel(2) }, { id: 'P3', arrival: 2, burst: 5, color: pastel(3) }];
    quantumEl.value = 2;
    renderTable();
    ganttEl.innerHTML = '';
    metricsEl.innerHTML = '';
}

// Events
tabs.addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    switchMode(btn.dataset.mode)
});
tableBody.addEventListener('input', onTable);
tableBody.addEventListener('click', onTable);
addBtn.addEventListener('click', addProcess);
runBtn.addEventListener('click', run);
resetBtn.addEventListener('click', resetAll);
document.getElementById('themeToggle').addEventListener('click', () => document.body.classList.toggle('light'));

// Init
switchMode('FCFS');
renderTable();