function pastel(seed){ const base=[Math.sin(seed+1)*127+128,Math.sin(seed+2)*127+128,Math.sin(seed+3)*127+128]; const [r,g,b]=base.map(v=>Math.round((v+255)/2)); return `rgb(${r}, ${g}, ${b})` }

const modeSel=document.getElementById('mode');
const entityBody=document.querySelector('#entityTable tbody');
const visEl=document.getElementById('vis');
const metricsEl=document.getElementById('metrics');

const addProcBtn=document.getElementById('addProcess');
const addResBtn=document.getElementById('addResource');
const runBtn=document.getElementById('run');
const resetBtn=document.getElementById('reset');

let processes=[{id:'P1', allocation: {R1:1}, request:{R2:1}, max:{R1:1,R2:1}, color:pastel(1)}, {id:'P2', allocation: {R2:1}, request:{R1:1}, max:{R1:1,R2:1}, color:pastel(2)}];
let resources=[{id:'R1', instances:1},{id:'R2', instances:1}];

function renderTable(){
    entityBody.innerHTML='';
    // Resources rows
    resources.forEach((r,idx)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>Resource</td><td>${r.id}</td>
        <td><input type="number" min="0" value="${r.instances}" data-kind="res" data-idx="${idx}" data-field="instances"/></td>
        <td></td><td></td>
        <td><button class="danger" data-action="del-res" data-idx="${idx}" type="button">Delete</button></td>`;
        entityBody.appendChild(tr);
    });
    // Process rows
    processes.forEach((p,idx)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>Process</td><td>${p.id}</td>
        <td><input type="text" value="${Object.values(p.max).join(',')}" data-kind="proc" data-idx="${idx}" data-field="max" title="Comma separated per-resource max in resource order"/></td>
        <td><input type="text" value="${Object.values(p.allocation).join(',')}" data-kind="proc" data-idx="${idx}" data-field="allocation" title="Comma separated allocations in resource order"/></td>
        <td><input type="text" value="${Object.values(p.request).join(',')}" data-kind="proc" data-idx="${idx}" data-field="request" title="Comma separated outstanding request/need in resource order"/></td>
        <td><button class="danger" data-action="del-proc" data-idx="${idx}" type="button">Delete</button></td>`;
        entityBody.appendChild(tr);
    });
}

function onTable(e){
    const t=e.target;
    if(t.tagName==='INPUT'){
        const idx=+t.dataset.idx; const field=t.dataset.field; const kind=t.dataset.kind;
        if(kind==='res'){ resources[idx][field]=Math.max(0,+t.value||0); }
        else{
            const order=resources.map(r=>r.id); const nums=(t.value||'').split(',').map(x=>Math.max(0, +x||0));
            const obj={}; order.forEach((rid,i)=> obj[rid]=nums[i]||0);
            processes[idx][field]=obj;
        }
    } else if(t.dataset.action){
        const idx=+t.dataset.idx;
        if(t.dataset.action==='del-res'){ resources.splice(idx,1); }
        if(t.dataset.action==='del-proc'){ processes.splice(idx,1); }
        renderTable();
    }
}

function addProcess(){ const id=`P${processes.length+1}`; const order=resources.map(r=>r.id); const zero={}; order.forEach(r=>zero[r]=0); processes.push({id, allocation:{...zero}, request:{...zero}, max:{...zero}, color:pastel(processes.length+5)}); renderTable(); }
function addResource(){ const id=`R${resources.length+1}`; resources.push({id, instances:1}); processes.forEach(p=>{ p.allocation[id]=0; p.request[id]=0; p.max[id]=0; }); renderTable(); }

// RAG detection: find cycle using simple DFS on bipartite graph P∪R
function detectDeadlockRAG(proc, res){
    // Build edges: P->R for requests (>0), R->P for allocations (>0)
    const edges=new Map();
    function add(u,v){ if(!edges.has(u)) edges.set(u,[]); edges.get(u).push(v); }
    for(const p of proc){ for(const [rid,need] of Object.entries(p.request)){ if(need>0) add(p.id, rid); } for(const [rid,a] of Object.entries(p.allocation)){ if(a>0) add(rid, p.id); } }
    const seen=new Set(), stack=new Set();
    const cycleNodes=new Set();
    function dfs(u){ if(stack.has(u)){ cycleNodes.add(u); return true; } if(seen.has(u)) return false; seen.add(u); stack.add(u); const adj=edges.get(u)||[]; for(const v of adj){ if(dfs(v)) { cycleNodes.add(u); stack.delete(u); return true; } } stack.delete(u); return false; }
    let hasCycle=false; for(const u of edges.keys()){ if(dfs(u)) { hasCycle=true; break; } }
    return { hasCycle, cycleNodes };
}

// Banker's Algorithm safety check (single-instance simplified to vectors; supports multi-instance by per-resource vectors)
function bankersSafety(proc, res){
    const order=res.map(r=>r.id);
    const available={}; order.forEach(rid=> available[rid]=res.find(r=>r.id===rid).instances - proc.reduce((s,p)=> s + (p.allocation[rid]||0),0));
    const need=proc.map(p=>({ id:p.id, need: Object.fromEntries(order.map(rid=> [rid, Math.max(0,(p.max[rid]||0)-(p.allocation[rid]||0))])) }));
    const finished=new Set(); const sequence=[]; let progress=true;
    while(finished.size<proc.length && progress){
        progress=false;
        for(const p of proc){ if(finished.has(p.id)) continue; let canRun=true; for(const rid of order){ if((need.find(n=>n.id===p.id).need[rid]||0) > (available[rid]||0)){ canRun=false; break; } }
            if(canRun){ sequence.push(p.id); finished.add(p.id); for(const rid of order){ available[rid]+=p.allocation[rid]||0; } progress=true; }
        }
    }
    const safe= finished.size===proc.length;
    return { safe, sequence, available };
}

function renderRAG(proc, res){
    visEl.innerHTML='';
    const wrap=document.createElement('div');
    wrap.style.display='grid'; wrap.style.gap='10px';
    const rowP=document.createElement('div'); rowP.className='gantt-row';
    proc.forEach(p=>{ const el=document.createElement('span'); el.className='chip'; el.style.background=p.color; el.style.color='#0b0b10'; el.textContent=p.id; rowP.appendChild(el); });
    const rowR=document.createElement('div'); rowR.className='gantt-row';
    res.forEach(r=>{ const el=document.createElement('span'); el.className='chip'; el.textContent=`${r.id}(${r.instances})`; rowR.appendChild(el); });
    wrap.appendChild(rowP); wrap.appendChild(rowR);
    const edges=document.createElement('div'); edges.className='muted';
    const req=[]; const alloc=[];
    proc.forEach(p=>{ for(const [rid,need] of Object.entries(p.request)){ if(need>0) req.push(`${p.id} → ${rid}`); } for(const [rid,a] of Object.entries(p.allocation)){ if(a>0) alloc.push(`${rid} → ${p.id}`); } });
    edges.textContent = `Requests: ${req.join(', ')} | Allocations: ${alloc.join(', ')}`;
    wrap.appendChild(edges);
    const det=detectDeadlockRAG(proc,res);
    metricsEl.innerHTML=`<span class="chip">Deadlock: ${det.hasCycle? 'Yes':'No'}</span>`;
    visEl.appendChild(wrap);
}

function renderBanker(proc, res){
    const result=bankersSafety(proc,res);
    visEl.innerHTML='';
    const row=document.createElement('div'); row.className='gantt-row';
    result.sequence.forEach((pid,i)=>{ const el=document.createElement('div'); el.className='gantt-seg'; el.style.background=processes.find(p=>p.id===pid).color; el.textContent=pid; el.title=`Order ${i+1}`; row.appendChild(el); });
    visEl.appendChild(row);
    metricsEl.innerHTML=`<span class="chip">Safe: ${result.safe?'Yes':'No'}</span>`;
}

async function run(){ 
    if(modeSel.value==='rag') {
        try {
            const data = { processes: processes, resources: resources };
            const response = await fetch('http://127.0.0.1:5000/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            // Update renderRAG to use backend result
            visEl.innerHTML='';
            const wrap=document.createElement('div');
            wrap.style.display='grid'; wrap.style.gap='10px';
            const rowP=document.createElement('div'); rowP.className='gantt-row';
            processes.forEach(p=>{ const el=document.createElement('span'); el.className='chip'; el.style.background=p.color; el.style.color='#0b0b10'; el.textContent=p.id; rowP.appendChild(el); });
            const rowR=document.createElement('div'); rowR.className='gantt-row';
            resources.forEach(r=>{ const el=document.createElement('span'); el.className='chip'; el.textContent=`${r.id}(${r.instances})`; rowR.appendChild(el); });
            wrap.appendChild(rowP); wrap.appendChild(rowR);
            const edges=document.createElement('div'); edges.className='muted';
            const req=[]; const alloc=[];
            processes.forEach(p=>{ for(const [rid,need] of Object.entries(p.request)){ if(need>0) req.push(`${p.id} → ${rid}`); } for(const [rid,a] of Object.entries(p.allocation)){ if(a>0) alloc.push(`${rid} → ${p.id}`); } });
            edges.textContent = `Requests: ${req.join(', ')} | Allocations: ${alloc.join(', ')}`;
            wrap.appendChild(edges);
            metricsEl.innerHTML=`<span class="chip">Deadlock: ${result.hasCycle? 'Yes':'No'}</span>`;
            visEl.appendChild(wrap);
        } catch (error) {
            console.error('Error calling backend:', error);
            renderRAG(processes, resources);
        }
    } else {
        try {
            const data = { processes: processes, resources: resources };
            const response = await fetch('http://127.0.0.1:5000/banker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            // Update renderBanker to use backend result
            visEl.innerHTML='';
            const row=document.createElement('div'); row.className='gantt-row';
            result.sequence.forEach((pid,i)=>{ const el=document.createElement('div'); el.className='gantt-seg'; el.style.background=processes.find(p=>p.id===pid).color; el.textContent=pid; el.title=`Order ${i+1}`; row.appendChild(el); });
            visEl.appendChild(row);
            metricsEl.innerHTML=`<span class="chip">Safe: ${result.safe?'Yes':'No'}</span>`;
        } catch (error) {
            console.error('Error calling backend:', error);
            renderBanker(processes, resources);
        }
    }
}
function resetAll(){ processes=[{id:'P1', allocation:{R1:1}, request:{R2:1}, max:{R1:1,R2:1}, color:pastel(1)},{id:'P2', allocation:{R2:1}, request:{R1:1}, max:{R1:1,R2:1}, color:pastel(2)}]; resources=[{id:'R1',instances:1},{id:'R2',instances:1}]; renderTable(); visEl.innerHTML=''; metricsEl.innerHTML=''; }

async function runAlgorithm(data, endpoint){ const res=await fetch(`http://127.0.0.1:5000/${endpoint}`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)}); return await res.json(); }

entityBody.addEventListener('input', onTable);
entityBody.addEventListener('click', onTable);
addProcBtn.addEventListener('click', addProcess);
addResBtn.addEventListener('click', addResource);
runBtn.addEventListener('click', run);
resetBtn.addEventListener('click', resetAll);

renderTable();

