# OS Visualizer – Operating System Lab Simulator

A web-based interactive simulator to visualize Operating System concepts such as **CPU Scheduling**, **Memory Management**, **Deadlock Handling**, and **File System Trees**.

This project uses:

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Python Flask  
- **Data Format:** JSON  
- **Architecture:** Simple client–server (browser ↔ Flask)

---

## 🚀 Features

### ✅ 1. CPU Scheduling Visualizer
Implements:
- FCFS  
- SJF (Non-Preemptive)  
- SRTF (Preemptive SJF)  
- Priority Scheduling  
- Round Robin  

Outputs:
- Gantt chart (start/end times)
- Waiting time
- Turnaround time
- CPU burst simulation

---

### ✅ 2. Memory Management Visualizer
Algorithms:
- **First Fit**  
- **Best Fit**  
- **Worst Fit**

Outputs:
- Allocation mapping  
- Internal fragmentation  
- Unallocated processes  

---

### ✅ 3. Deadlock Handling
Two modules:

#### 🔗 Resource Allocation Graph (RAG)
- Detects cycles (deadlock)

#### 🔐 Banker’s Algorithm
- Checks safe/unsafe state  
- Generates safe execution sequence  

---

### ✅ 4. File System Tree Visualizer
Supports:
- Create file/folder  
- Delete file/folder  
- View node details  
- Count files & directories recursively  


