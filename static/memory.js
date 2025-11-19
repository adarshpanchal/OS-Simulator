function pastel(seed){ const base=[Math.sin(seed+1)*127+128,Math.sin(seed+2)*127+128,Math.sin(seed+3)*127+128]; const [r,g,b]=base.map(v=>Math.round((v+255)/2)); return `rgb(${r}, ${g}, ${b})` }

const algoSelect=document.getElementById('algoSelect');
const blockBody=document.querySelector('#blockTable tbody');
const procBody=document.querySelector('#procTable tbody');
const visEl=document.getElementById('vis');
const metricsEl=document.getElementById('metrics');

const addBlockBtn=document.getElementById('addBlock');
const addProcessBtn=document.getElementById('addProcess');
const runBtn=document.getElementById('run');
const resetBtn=document.getElementById('reset');

let blocks=[{id:1,size:100},{id:2,size:250},{id:3,size:300}];
let processes=[{id:'P1',size:120,color:pastel(1)},{id:'P2',size:60,color:pastel(2)},{id:'P3',size:200,color:pastel(3)}];

function renderTables(){
    blockBody.innerHTML='';
    blocks.forEach((b,idx)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>B${b.id}</td>
        <td><input type="number" min="1" value="${b.size}" data-idx="${idx}" data-type="block" /></td>
        <td><button class="danger" data-action="del-block" data-idx="${idx}" type="button">Delete</button></td>`;
        blockBody.appendChild(tr);
    });
    procBody.innerHTML='';
    processes.forEach((p,idx)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${p.id}</td>
        <td><input type="number" min="1" value="${p.size}" data-idx="${idx}" data-type="proc" /></td>
        <td><button class="danger" data-action="del-proc" data-idx="${idx}" type="button">Delete</button></td>`;
        procBody.appendChild(tr);
    });
}

function onTableChange(e){
    const t=e.target; if(t.tagName!=="INPUT" && !t.dataset.action) return;
    if(t.tagName==='INPUT'){
        const idx=+t.dataset.idx; const val=Math.max(1,+t.value||1);
        if(t.dataset.type==='block') blocks[idx].size=val; else processes[idx].size=val;
    } else {
        const idx=+t.dataset.idx;
        if(t.dataset.action==='del-block'){ blocks.splice(idx,1); }
        if(t.dataset.action==='del-proc'){ processes.splice(idx,1); }
        renderTables();
    }
}

function addBlock(){ const id=(blocks.at(-1)?.id||0)+1; blocks.push({id,size:64}); renderTables(); }
function addProcess(){ const idNum=processes.length+1; processes.push({id:`P${idNum}`, size:32, color:pastel(idNum+5)}); renderTables(); }

// Fit algorithms return allocation map: processId -> {blockId, start, size}
function firstFit(blocksIn, procs){
    const blocks=blocksIn.map(b=>({id:b.id, size:b.size, remaining:b.size, cursor:0}));
    const alloc=new Map();
    for(const p of procs){
        let placed=false;
        for(const b of blocks){
            if(b.remaining>=p.size){
                alloc.set(p.id,{blockId:b.id,start:b.cursor,size:p.size,color:p.color});
                b.cursor+=p.size; b.remaining-=p.size; placed=true; break;
            }
        }
        if(!placed) alloc.set(p.id,null);
    }
    return alloc;
}

function bestFit(blocksIn, procs){
    const blocks=blocksIn.map(b=>({id:b.id, size:b.size, remaining:b.size, cursor:0}));
    const alloc=new Map();
    for(const p of procs){
        let bestIndex=-1; let bestWaste=Infinity;
        for(let i=0;i<blocks.length;i++){
            const b=blocks[i]; if(b.remaining>=p.size){ const waste=b.remaining-p.size; if(waste<bestWaste){ bestWaste=waste; bestIndex=i; } }
        }
        if(bestIndex>=0){ const b=blocks[bestIndex]; alloc.set(p.id,{blockId:b.id,start:b.cursor,size:p.size,color:p.color}); b.cursor+=p.size; b.remaining-=p.size; }
        else alloc.set(p.id,null);
    }
    return alloc;
}

function worstFit(blocksIn, procs){
    const blocks=blocksIn.map(b=>({id:b.id, size:b.size, remaining:b.size, cursor:0}));
    const alloc=new Map();
    for(const p of procs){
        let worstIndex=-1; let worstRemaining=-1;
        for(let i=0;i<blocks.length;i++){
            const b=blocks[i]; if(b.remaining>=p.size && b.remaining>worstRemaining){ worstRemaining=b.remaining; worstIndex=i; }
        }
        if(worstIndex>=0){ const b=blocks[worstIndex]; alloc.set(p.id,{blockId:b.id,start:b.cursor,size:p.size,color:p.color}); b.cursor+=p.size; b.remaining-=p.size; }
        else alloc.set(p.id,null);
    }
    return alloc;
}

function renderVis(alloc){
    visEl.innerHTML='';
    const container=document.createElement('div');
    container.style.display='grid';
    container.style.gap='12px';
    // Build per-block visualization
    const byBlock=new Map();
    for(const b of blocks){ byBlock.set(b.id,[]); }
    for(const p of processes){ const a=alloc.get(p.id); if(a){ byBlock.get(a.blockId).push({...a, id:p.id}); } }
    for(const b of blocks){
        const wrap=document.createElement('div');
        wrap.innerHTML=`<div class="muted">Block B${b.id} (size ${b.size})</div>`;
        const track=document.createElement('div');
        track.style.display='grid';
        track.style.gridAutoFlow='column';
        track.style.gap='4px';
        track.style.border='1px solid var(--border)';
        track.style.borderRadius='8px';
        track.style.padding='6px';
        track.style.background='#0f0f18';
        const segments=byBlock.get(b.id).sort((a,c)=>a.start-c.start);
        let cursor=0;
        function seg(widthPx, bg, label, title){
            const el=document.createElement('div'); el.className='gantt-seg'; el.style.background=bg; el.style.minWidth=Math.max(24, widthPx)+'px'; el.style.height='28px'; el.style.borderRadius='6px'; el.style.display='grid'; el.style.placeItems='center'; el.style.color='#0b0b10'; el.style.fontWeight='700'; el.style.fontSize='12px'; el.textContent=label; el.title=title; return el;
        }
        for(const s of segments){
            const gap=s.start-cursor; if(gap>0){ track.appendChild(seg(gap, '#1b1b2e', '', `Free: ${gap}`)); }
            track.appendChild(seg(s.size, s.color, s.id, `${s.id}: ${s.size}`)); cursor=s.start+s.size;
        }
        const tail=b.size-cursor; if(tail>0){ track.appendChild(seg(tail, '#1b1b2e', '', `Free: ${tail}`)); }
        wrap.appendChild(track);
        container.appendChild(wrap);
    }
    visEl.appendChild(container);
}

function computeMetrics(alloc){
    let allocated=0, failed=0; let internalFrag=0;
    for(const p of processes){ const a=alloc.get(p.id); if(a){ allocated++; internalFrag+=0; } else failed++; }
    // External fragmentation approximated as free spaces distributed across blocks that cannot satisfy any remaining process
    const totalBlock=blocks.reduce((s,b)=>s+b.size,0);
    const totalUsed=[...alloc.values()].reduce((s,a)=> s + (a? a.size:0), 0);
    const externalFrag=totalBlock-totalUsed; // upper bound visualization metric
    return { allocated, failed, externalFrag };
}

async function run(){
    try {
        const data = {
            blocks: blocks.map(b => b.size),
            processes: processes.map(p => p.size),
            method: algoSelect.value
        };
        
        const response = await fetch('http://127.0.0.1:5000/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        // Convert backend allocation to frontend format
        const alloc = new Map();
        processes.forEach((p, idx) => {
            const allocInfo = result.allocation[idx];
            if (allocInfo && allocInfo.allocated) {
                // Find block and calculate start position
                const blockId = allocInfo.block;
                const block = blocks.find(b => b.id === blockId + 1); // Backend uses 0-indexed
                if (block) {
                    alloc.set(p.id, {
                        blockId: block.id,
                        start: 0, // Backend doesn't track start position, use 0
                        size: p.size,
                        color: p.color
                    });
                } else {
                    alloc.set(p.id, null);
                }
            } else {
                alloc.set(p.id, null);
            }
        });
        
        renderVis(alloc);
        const m=computeMetrics(alloc);
        metricsEl.innerHTML=`<span class="chip">Allocated: ${m.allocated}</span><span class="chip">Failed: ${m.failed}</span><span class="chip">External Fragmentation (approx): ${m.externalFrag}</span>`;
    } catch (error) {
        console.error('Error calling backend:', error);
        // Fallback to local implementation
        let alloc;
        const algo=algoSelect.value;
        const procs=processes.map(p=>({id:p.id,size:+p.size,color:p.color}));
        if(algo==='first') alloc=firstFit(blocks, procs);
        else if(algo==='best') alloc=bestFit(blocks, procs);
        else alloc=worstFit(blocks, procs);
        renderVis(alloc);
        const m=computeMetrics(alloc);
        metricsEl.innerHTML=`<span class="chip">Allocated: ${m.allocated}</span><span class="chip">Failed: ${m.failed}</span><span class="chip">External Fragmentation (approx): ${m.externalFrag}</span>`;
    }
}

function resetAll(){ blocks=[{id:1,size:100},{id:2,size:250},{id:3,size:300}]; processes=[{id:'P1',size:120,color:pastel(1)},{id:'P2',size:60,color:pastel(2)},{id:'P3',size:200,color:pastel(3)}]; renderTables(); visEl.innerHTML=''; metricsEl.innerHTML=''; }

async function runAlgorithm(data, endpoint){ const res=await fetch(`http://127.0.0.1:5000/${endpoint}`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)}); return await res.json(); }

blockBody.addEventListener('input', onTableChange);
blockBody.addEventListener('click', onTableChange);
procBody.addEventListener('input', onTableChange);
procBody.addEventListener('click', onTableChange);
addBlockBtn.addEventListener('click', addBlock);
addProcessBtn.addEventListener('click', addProcess);
runBtn.addEventListener('click', run);
resetBtn.addEventListener('click', resetAll);

renderTables();

