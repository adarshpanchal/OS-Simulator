const treeEl=document.getElementById('tree');
const detailsEl=document.getElementById('details');
const metricsEl=document.getElementById('metrics');
const nodeNameEl=document.getElementById('nodeName');
const nodeTypeEl=document.getElementById('nodeType');
const createBtn=document.getElementById('create');
const deleteBtn=document.getElementById('delete');
const resetBtn=document.getElementById('reset');

let root = { type:'dir', name:'/', children:[ {type:'dir', name:'home', children:[{type:'file', name:'readme.txt'}]}, {type:'dir', name:'var', children:[]}, {type:'file', name:'boot.log'} ] };
let selectedPath=[]; // list of names from root

function getNode(path){ let node=root; for(const part of path){ if(!node.children) return null; node=node.children.find(c=>c.name===part); if(!node) return null; } return node; }
function parentOf(path){ if(path.length===0) return null; const parentPath=path.slice(0,-1); return getNode(parentPath) || root; }

function renderTree(){
    function item(node, path){
        const li=document.createElement('li');
        const n=document.createElement('div'); n.className='node'; n.dataset.path=JSON.stringify(path); if(eqPath(path, selectedPath)) n.classList.add('selected');
        const icon=node.type==='dir'?'📁':'📄';
        n.innerHTML=`<span>${icon}</span><span>${node.name}</span>`;
        n.addEventListener('click',()=>{ selectedPath=path; renderTree(); renderDetails(); });
        li.appendChild(n);
        if(node.type==='dir' && node.children?.length){
            const ul=document.createElement('ul');
            node.children.forEach(child=> ul.appendChild(item(child, [...path, child.name])));
            li.appendChild(ul);
        }
        return li;
    }
    treeEl.innerHTML='';
    const ul=document.createElement('ul');
    ul.appendChild(item(root, []));
    treeEl.appendChild(ul);
}

function eqPath(a,b){ if(a.length!==b.length) return false; return a.every((v,i)=>v===b[i]); }
function renderDetails(){
    const node=getNode(selectedPath) || root;
    if(node.type==='dir'){
        const countFiles=(n)=> n.type==='file'?1: (n.children||[]).reduce((s,c)=> s+countFiles(c),0);
        const countDirs=(n)=> n.type==='dir'?1:0 + (n.children||[]).reduce((s,c)=> s+countDirs(c),0);
        const numFiles=(node.children||[]).reduce((s,c)=> s + (c.type==='file'?1: countFiles(c)),0);
        const numDirs=(node.children||[]).reduce((s,c)=> s + (c.type==='dir'?1: countDirs(c)),0);
        detailsEl.textContent=`Directory ${node.name} — ${numDirs} subdirs, ${numFiles} files`;
        metricsEl.innerHTML=`<span class="chip">Nodes: ${(node.children||[]).length}</span>`;
    } else {
        detailsEl.textContent=`File ${node.name}`;
        metricsEl.innerHTML=`<span class="chip">Leaf</span>`;
    }
}

async function createNode(){
    const name=(nodeNameEl.value||'').trim(); if(!name) return;
    const type=nodeTypeEl.value;
    try {
        const data = {
            action: 'create',
            path: selectedPath,
            name: name,
            type: type
        };
        const response = await fetch('http://127.0.0.1:5000/filetree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        root = result;
        nodeNameEl.value = '';
        renderTree();
        renderDetails();
    } catch (error) {
        console.error('Error calling backend:', error);
        // Fallback to local implementation
        const parent=getNode(selectedPath) || root;
        if(parent.type!=='dir'){ return; }
        if(parent.children.some(c=>c.name===name)) { alert('Name already exists in this directory'); return; }
        parent.children.push(type==='dir'? {type:'dir', name, children:[]} : {type:'file', name});
        nodeNameEl.value = '';
        renderTree();
    }
}

async function deleteSelected(){ 
    if(selectedPath.length===0){ alert('Cannot delete root'); return; }
    try {
        const data = { path: selectedPath };
        const response = await fetch('http://127.0.0.1:5000/filetree', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        root = result;
        selectedPath=[];
        renderTree();
        renderDetails();
    } catch (error) {
        console.error('Error calling backend:', error);
        // Fallback to local implementation
        const parent=parentOf(selectedPath); if(!parent||!parent.children) return; const name=selectedPath[selectedPath.length-1]; parent.children=parent.children.filter(c=>c.name!==name); selectedPath=[]; renderTree(); renderDetails();
    }
}
async function resetAll(){ 
    try {
        const data = { action: 'reset' };
        const response = await fetch('http://127.0.0.1:5000/filetree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        root = result;
        selectedPath=[];
        renderTree();
        renderDetails();
    } catch (error) {
        console.error('Error calling backend:', error);
        // Fallback to local implementation
        root={ type:'dir', name:'/', children:[ {type:'dir', name:'home', children:[{type:'file', name:'readme.txt'}]}, {type:'dir', name:'var', children:[]}, {type:'file', name:'boot.log'} ] }; selectedPath=[]; renderTree(); renderDetails();
    }
}

async function runAlgorithm(data, endpoint){ const res=await fetch(`http://127.0.0.1:5000/${endpoint}`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)}); return await res.json(); }

// Load initial tree from backend
async function loadTree() {
    try {
        const response = await fetch('http://127.0.0.1:5000/filetree', {
            method: 'GET'
        });
        const result = await response.json();
        root = result;
        renderTree();
        renderDetails();
    } catch (error) {
        console.error('Error loading tree from backend:', error);
        // Use local tree
        renderTree();
        renderDetails();
    }
}

createBtn.addEventListener('click', createNode);
deleteBtn.addEventListener('click', deleteSelected);
resetBtn.addEventListener('click', resetAll);

loadTree();

