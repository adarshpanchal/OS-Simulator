from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static')
CORS(app)

# Serve index page
@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

# In-memory file tree storage
file_tree = {
    "type": "dir",
    "name": "/",
    "children": [
        {"type": "dir", "name": "home", "children": [{"type": "file", "name": "readme.txt"}]},
        {"type": "dir", "name": "var", "children": []},
        {"type": "file", "name": "boot.log"}
    ]
}


def fcfs_scheduling(processes):
    """First Come First Served (non-preemptive)"""
    sorted_procs = sorted(processes, key=lambda x: x['arrival'])
    gantt = []
    time = 0
    
    for proc in sorted_procs:
        if time < proc['arrival']:
            time = proc['arrival']
        start = time
        end = time + proc['burst']
        gantt.append({"pid": proc['pid'], "start": start, "end": end})
        time = end
    
    return calculate_metrics(processes, gantt)


def sjf_scheduling(processes):
    """Shortest Job First (non-preemptive)"""
    ready = sorted(processes, key=lambda x: x['arrival'])
    gantt = []
    time = 0
    queue = []
    i = 0
    
    while i < len(ready) or queue:
        # Add arrived processes to queue
        while i < len(ready) and ready[i]['arrival'] <= time:
            queue.append(ready[i])
            i += 1
        
        if not queue:
            if i < len(ready):
                time = ready[i]['arrival']
                continue
            break
        
        # Sort by burst time and pick shortest
        queue.sort(key=lambda x: x['burst'])
        proc = queue.pop(0)
        start = time
        end = time + proc['burst']
        gantt.append({"pid": proc['pid'], "start": start, "end": end})
        time = end
    
    return calculate_metrics(processes, gantt)


def srtf_scheduling(processes):
    """Shortest Remaining Time First (preemptive)"""
    procs = [{"pid": p['pid'], "arrival": p['arrival'], "burst": p['burst'], "remaining": p['burst']} for p in processes]
    procs.sort(key=lambda x: x['arrival'])
    gantt = []
    time = 0
    queue = []
    i = 0
    current = None
    
    while i < len(procs) or queue or current:
        # Add arrived processes to queue
        while i < len(procs) and procs[i]['arrival'] <= time:
            queue.append(procs[i])
            i += 1
        
        # Sort queue by remaining time
        queue.sort(key=lambda x: x['remaining'])
        
        # If current process exists, check if it should be preempted
        if current and queue and queue[0]['remaining'] < current['remaining']:
            # Preempt current process
            if gantt and gantt[-1]['pid'] == current['pid']:
                gantt[-1]['end'] = time
            else:
                gantt.append({"pid": current['pid'], "start": time, "end": time})
            queue.append(current)
            current = None
        
        # Select next process
        if not current:
            if queue:
                current = queue.pop(0)
                # Start new segment or continue existing
                if not gantt or gantt[-1]['pid'] != current['pid'] or gantt[-1]['end'] != time:
                    gantt.append({"pid": current['pid'], "start": time, "end": time})
        
        if current:
            # Execute for 1 unit
            current['remaining'] -= 1
            time += 1
            gantt[-1]['end'] = time
            
            if current['remaining'] == 0:
                current = None
        else:
            if i < len(procs):
                time = procs[i]['arrival']
            else:
                break
    
    # Merge consecutive segments
    merged = []
    for seg in gantt:
        if merged and merged[-1]['pid'] == seg['pid'] and merged[-1]['end'] == seg['start']:
            merged[-1]['end'] = seg['end']
        else:
            merged.append(seg)
    
    return calculate_metrics(processes, merged)


def priority_scheduling(processes):
    """Priority Scheduling (non-preemptive, lower number = higher priority)"""
    procs = [p.copy() for p in processes]
    # If priority not provided, use arrival order
    for p in procs:
        if 'priority' not in p:
            p['priority'] = p.get('arrival', 0)
    
    ready = sorted(procs, key=lambda x: x['arrival'])
    gantt = []
    time = 0
    queue = []
    i = 0
    
    while i < len(ready) or queue:
        while i < len(ready) and ready[i]['arrival'] <= time:
            queue.append(ready[i])
            i += 1
        
        if not queue:
            if i < len(ready):
                time = ready[i]['arrival']
                continue
            break
        
        # Sort by priority (lower = higher priority)
        queue.sort(key=lambda x: x['priority'])
        proc = queue.pop(0)
        start = time
        end = time + proc['burst']
        gantt.append({"pid": proc['pid'], "start": start, "end": end})
        time = end
    
    return calculate_metrics(processes, gantt)


def round_robin(processes, quantum):
    """Round Robin scheduling"""
    procs = [{"pid": p['pid'], "arrival": p['arrival'], "burst": p['burst'], "remaining": p['burst']} for p in processes]
    procs.sort(key=lambda x: x['arrival'])
    gantt = []
    time = 0
    queue = []
    i = 0
    
    while i < len(procs) or queue:
        # Add arrived processes
        while i < len(procs) and procs[i]['arrival'] <= time:
            queue.append(procs[i])
            i += 1
        
        if not queue:
            if i < len(procs):
                time = procs[i]['arrival']
                continue
            break
        
        proc = queue.pop(0)
        start = time
        run_time = min(quantum, proc['remaining'])
        end = time + run_time
        gantt.append({"pid": proc['pid'], "start": start, "end": end})
        proc['remaining'] -= run_time
        time = end
        
        # Add newly arrived processes
        while i < len(procs) and procs[i]['arrival'] <= time:
            queue.append(procs[i])
            i += 1
        
        # Re-add current process if not finished
        if proc['remaining'] > 0:
            queue.append(proc)
    
    return calculate_metrics(processes, gantt)


def calculate_metrics(processes, gantt):
    """Calculate waiting time and turnaround time from gantt chart"""
    completion = {}
    for seg in gantt:
        completion[seg['pid']] = seg['end']
    
    waiting_times = []
    turnaround_times = []
    
    for proc in processes:
        pid = proc['pid']
        ct = completion.get(pid, proc['arrival'] + proc['burst'])
        tat = ct - proc['arrival']
        wt = tat - proc['burst']
        waiting_times.append(wt)
        turnaround_times.append(tat)
    
    avg_waiting = sum(waiting_times) / len(waiting_times) if waiting_times else 0
    avg_turnaround = sum(turnaround_times) / len(turnaround_times) if turnaround_times else 0
    
    return {
        "gantt": gantt,
        "avg_waiting": round(avg_waiting, 2),
        "avg_turnaround": round(avg_turnaround, 2)
    }


def first_fit(blocks, processes):
    """First Fit memory allocation"""
    allocation = []
    blocks_copy = [{"id": i, "size": b, "remaining": b} for i, b in enumerate(blocks)]
    
    for proc in processes:
        placed = False
        for block in blocks_copy:
            if block['remaining'] >= proc:
                allocation.append({"process": proc, "block": block['id'], "allocated": True})
                block['remaining'] -= proc
                placed = True
                break
        if not placed:
            allocation.append({"process": proc, "block": None, "allocated": False})
    
    return allocation


def best_fit(blocks, processes):
    """Best Fit memory allocation"""
    allocation = []
    blocks_copy = [{"id": i, "size": b, "remaining": b} for i, b in enumerate(blocks)]
    
    for proc in processes:
        best_idx = -1
        best_waste = float('inf')
        
        for i, block in enumerate(blocks_copy):
            if block['remaining'] >= proc:
                waste = block['remaining'] - proc
                if waste < best_waste:
                    best_waste = waste
                    best_idx = i
        
        if best_idx >= 0:
            block = blocks_copy[best_idx]
            allocation.append({"process": proc, "block": block['id'], "allocated": True})
            block['remaining'] -= proc
        else:
            allocation.append({"process": proc, "block": None, "allocated": False})
    
    return allocation


def worst_fit(blocks, processes):
    """Worst Fit memory allocation"""
    allocation = []
    blocks_copy = [{"id": i, "size": b, "remaining": b} for i, b in enumerate(blocks)]
    
    for proc in processes:
        worst_idx = -1
        worst_size = -1
        
        for i, block in enumerate(blocks_copy):
            if block['remaining'] >= proc and block['remaining'] > worst_size:
                worst_size = block['remaining']
                worst_idx = i
        
        if worst_idx >= 0:
            block = blocks_copy[worst_idx]
            allocation.append({"process": proc, "block": block['id'], "allocated": True})
            block['remaining'] -= proc
        else:
            allocation.append({"process": proc, "block": None, "allocated": False})
    
    return allocation


def detect_rag_cycle(processes, resources):
    """Detect cycle in Resource Allocation Graph"""
    # Build graph: P -> R (request edge), R -> P (allocation edge)
    edges = {}
    
    for proc in processes:
        pid = proc['id']
        # Request edges: P -> R
        for rid, need in proc.get('request', {}).items():
            if need > 0:
                if pid not in edges:
                    edges[pid] = []
                edges[pid].append(rid)
        
        # Allocation edges: R -> P
        for rid, alloc in proc.get('allocation', {}).items():
            if alloc > 0:
                if rid not in edges:
                    edges[rid] = []
                edges[rid].append(pid)
    
    # DFS to detect cycle
    seen = set()
    stack = set()
    cycle_nodes = set()
    
    def dfs(node):
        if node in stack:
            cycle_nodes.add(node)
            return True
        if node in seen:
            return False
        
        seen.add(node)
        stack.add(node)
        
        for neighbor in edges.get(node, []):
            if dfs(neighbor):
                cycle_nodes.add(node)
                stack.remove(node)
                return True
        
        stack.remove(node)
        return False
    
    has_cycle = False
    for node in edges.keys():
        if node not in seen:
            if dfs(node):
                has_cycle = True
                break
    
    return {
        "hasCycle": has_cycle,
        "cycleNodes": list(cycle_nodes)
    }


def bankers_algorithm(processes, resources):
    """Banker's Algorithm safety check"""
    order = [r['id'] for r in resources]
    
    # Calculate available resources
    available = {}
    for rid in order:
        total = next(r['instances'] for r in resources if r['id'] == rid)
        allocated = sum(p.get('allocation', {}).get(rid, 0) for p in processes)
        available[rid] = total - allocated
    
    # Calculate need matrix
    need = []
    for p in processes:
        pid = p['id']
        need_dict = {}
        for rid in order:
            max_need = p.get('max', {}).get(rid, 0)
            allocated = p.get('allocation', {}).get(rid, 0)
            need_dict[rid] = max(0, max_need - allocated)
        need.append({"id": pid, "need": need_dict})
    
    # Safety algorithm
    finished = set()
    sequence = []
    progress = True
    
    while len(finished) < len(processes) and progress:
        progress = False
        for p in processes:
            pid = p['id']
            if pid in finished:
                continue
            
            # Check if need <= available
            can_run = True
            need_dict = next(n['need'] for n in need if n['id'] == pid)
            
            for rid in order:
                if need_dict[rid] > available[rid]:
                    can_run = False
                    break
            
            if can_run:
                # Execute process and release resources
                sequence.append(pid)
                finished.add(pid)
                for rid in order:
                    available[rid] += p.get('allocation', {}).get(rid, 0)
                progress = True
    
    safe = len(finished) == len(processes)
    return {
        "safe": safe,
        "sequence": sequence if safe else []
    }


def get_node_by_path(tree, path):
    """Get node in tree by path array"""
    node = tree
    for part in path:
        if node.get('type') != 'dir' or 'children' not in node:
            return None
        found = next((c for c in node['children'] if c['name'] == part), None)
        if not found:
            return None
        node = found
    return node


def get_parent_by_path(tree, path):
    """Get parent node of given path"""
    if len(path) == 0:
        return None
    parent_path = path[:-1]
    return get_node_by_path(tree, parent_path) if parent_path else tree


# API Endpoints

@app.route('/cpu', methods=['POST'])
def cpu_scheduling():
    data = request.json
    processes = data.get('processes', [])
    algorithm = data.get('algorithm', 'FCFS').upper()
    quantum = data.get('quantum', 4)
    
    if algorithm == 'FCFS':
        result = fcfs_scheduling(processes)
    elif algorithm == 'SJF':
        result = sjf_scheduling(processes)
    elif algorithm == 'SRTF':
        result = srtf_scheduling(processes)
    elif algorithm == 'PRIORITY':
        result = priority_scheduling(processes)
    elif algorithm == 'RR' or algorithm == 'ROUNDROBIN':
        result = round_robin(processes, quantum)
    else:
        return jsonify({"error": "Unknown algorithm"}), 400
    
    return jsonify(result)


@app.route('/memory', methods=['POST'])
def memory_allocation():
    data = request.json
    blocks = data.get('blocks', [])
    processes = data.get('processes', [])
    method = data.get('method', 'first').lower()
    
    if method == 'first':
        allocation = first_fit(blocks, processes)
    elif method == 'best':
        allocation = best_fit(blocks, processes)
    elif method == 'worst':
        allocation = worst_fit(blocks, processes)
    else:
        return jsonify({"error": "Unknown method"}), 400
    
    return jsonify({"allocation": allocation})


@app.route('/rag', methods=['POST'])
def rag_cycle_detection():
    data = request.json
    processes = data.get('processes', [])
    resources = data.get('resources', [])
    
    result = detect_rag_cycle(processes, resources)
    return jsonify(result)


@app.route('/banker', methods=['POST'])
def bankers():
    data = request.json
    processes = data.get('processes', [])
    resources = data.get('resources', [])
    
    result = bankers_algorithm(processes, resources)
    return jsonify(result)


@app.route('/filetree', methods=['GET', 'POST', 'DELETE'])
def filetree():
    global file_tree
    
    if request.method == 'GET':
        return jsonify(file_tree)
    
    elif request.method == 'POST':
        data = request.json
        action = data.get('action', 'create')
        
        if action == 'create':
            path = data.get('path', [])
            name = data.get('name', '')
            node_type = data.get('type', 'file')
            
            parent = get_node_by_path(file_tree, path) if path else file_tree
            if not parent or parent.get('type') != 'dir':
                return jsonify({"error": "Invalid parent directory"}), 400
            
            if 'children' not in parent:
                parent['children'] = []
            
            # Check if name already exists
            if any(c['name'] == name for c in parent['children']):
                return jsonify({"error": "Name already exists"}), 400
            
            new_node = {
                "type": node_type,
                "name": name
            }
            if node_type == 'dir':
                new_node['children'] = []
            
            parent['children'].append(new_node)
            return jsonify(file_tree)
        
        elif action == 'reset':
            file_tree = {
                "type": "dir",
                "name": "/",
                "children": [
                    {"type": "dir", "name": "home", "children": [{"type": "file", "name": "readme.txt"}]},
                    {"type": "dir", "name": "var", "children": []},
                    {"type": "file", "name": "boot.log"}
                ]
            }
            return jsonify(file_tree)
    
    elif request.method == 'DELETE':
        data = request.json
        path = data.get('path', [])
        
        if len(path) == 0:
            return jsonify({"error": "Cannot delete root"}), 400
        
        parent = get_parent_by_path(file_tree, path)
        if not parent or 'children' not in parent:
            return jsonify({"error": "Invalid path"}), 400
        
        name = path[-1]
        parent['children'] = [c for c in parent['children'] if c['name'] != name]
        return jsonify(file_tree)


# Serve HTML pages and static files (must be after API routes)
@app.route('/<path:filename>')
def serve_static(filename):
    # Don't interfere with POST requests to API routes
    if request.method == 'POST' and filename in ['cpu', 'memory', 'rag', 'banker', 'filetree']:
        return jsonify({"error": "Method not allowed"}), 405
    
    # Serve files from static directory
    if os.path.exists(os.path.join('static', filename)):
        return send_from_directory('static', filename)
    
    # Try serving HTML without extension (e.g., /cpu -> /cpu.html)
    if '.' not in filename:
        html_path = f"{filename}.html"
        if os.path.exists(os.path.join('static', html_path)):
            return send_from_directory('static', html_path)
    
    return jsonify({"error": "File not found"}), 404


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)

