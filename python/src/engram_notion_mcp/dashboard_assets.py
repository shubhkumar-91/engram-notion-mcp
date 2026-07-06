DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engram Notion MCP - Memory Dashboard</title>
  <!-- Google Font Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <!-- D3.js -->
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    :root {
      --bg-color: #0c0914;
      --panel-bg: rgba(22, 17, 39, 0.7);
      --panel-border: rgba(97, 78, 172, 0.2);
      --panel-border-hover: rgba(147, 128, 222, 0.4);
      --text-main: #f0ecfa;
      --text-muted: #9f9aad;
      --primary: #9d4edd;
      --primary-glow: rgba(157, 78, 221, 0.4);
      --accent-blue: #3a86c8;
      --accent-green: #38b000;
      --accent-red: #d90429;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', sans-serif;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Grid Background */
    body::before {
      content: "";
      position: absolute;
      width: 100%;
      height: 100%;
      background-image: 
        linear-gradient(rgba(157, 78, 221, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(157, 78, 221, 0.03) 1px, transparent 1px);
      background-size: 30px 30px;
      z-index: -1;
    }

    /* Header styling */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 30px;
      background: rgba(15, 11, 28, 0.8);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--panel-border);
      height: 70px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #c77dff, #3c096c);
      border-radius: 8px;
      box-shadow: 0 0 15px var(--primary-glow);
    }

    .logo-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(90deg, #f0ecfa, #c77dff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-tabs {
      display: flex;
      gap: 8px;
    }

    .tab-button {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .tab-button:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-button.active {
      color: var(--text-main);
      background: rgba(157, 78, 221, 0.15);
      border-color: var(--panel-border);
      box-shadow: 0 0 10px rgba(157, 78, 221, 0.1);
    }

    /* Main layout */
    main {
      display: flex;
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .tab-content {
      display: none;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    .tab-content.active {
      display: flex;
    }

    /* Column Split Layout */
    .left-panel {
      width: 400px;
      border-right: 1px solid var(--panel-border);
      background: var(--panel-bg);
      backdrop-filter: blur(15px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
    }

    .right-panel {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    /* Metrics Summary Cards */
    .metrics-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      padding: 20px;
      background: rgba(10, 8, 20, 0.5);
      border-bottom: 1px solid var(--panel-border);
    }

    .metric-card {
      background: rgba(22, 17, 39, 0.4);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .metric-card:hover {
      border-color: var(--panel-border-hover);
      transform: translateY(-2px);
    }

    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #c77dff;
      margin-bottom: 4px;
      text-shadow: 0 0 10px rgba(199, 125, 255, 0.2);
    }

    .metric-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Search & Timeline view */
    .search-section {
      padding: 20px;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      width: 100%;
    }

    .search-input {
      width: 100%;
      background: rgba(10, 8, 20, 0.8);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 10px 15px;
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      transition: all 0.3s ease;
    }

    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 8px rgba(157, 78, 221, 0.25);
    }

    .timeline-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .timeline-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 15px;
      position: relative;
      transition: all 0.3s ease;
    }

    .timeline-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--panel-border-hover);
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .timeline-tag {
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }

    .tag-fact { background: rgba(157, 78, 221, 0.15); color: #c77dff; border: 1px solid rgba(199, 125, 255, 0.3); }
    .tag-notion { background: rgba(58, 134, 200, 0.15); color: #61a5ff; border: 1px solid rgba(97, 165, 255, 0.3); }

    .timeline-time {
      color: var(--text-muted);
    }

    .timeline-content {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-main);
      white-space: pre-wrap;
    }

    .timeline-meta {
      margin-top: 10px;
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 8px;
    }

    /* Graph panel styling */
    .graph-container {
      width: 100%;
      height: 100%;
      background: #08060f;
      cursor: grab;
    }

    .graph-container:active {
      cursor: grabbing;
    }

    /* Node & Link SVG Styling */
    .node {
      stroke: #08060f;
      stroke-width: 1.5px;
      cursor: pointer;
      transition: r 0.2s ease, stroke-width 0.2s ease;
    }

    .node:hover {
      stroke: #fff;
      stroke-width: 2px;
    }

    .link {
      stroke: rgba(157, 78, 221, 0.25);
      stroke-opacity: 0.6;
      stroke-width: 1.5px;
      fill: none;
      transition: stroke-opacity 0.2s ease;
    }

    .link-label {
      fill: var(--text-muted);
      font-size: 8px;
      pointer-events: none;
      text-anchor: middle;
    }

    .node-text {
      fill: var(--text-main);
      font-size: 10px;
      pointer-events: none;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      font-weight: 500;
    }

    /* Floating Inspector Panel */
    .inspector-panel {
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 320px;
      max-height: 380px;
      background: var(--panel-bg);
      backdrop-filter: blur(15px);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 100;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      transition: all 0.3s ease;
      overflow-y: auto;
    }

    .inspector-header {
      font-weight: 700;
      font-size: 15px;
      color: #c77dff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
    }

    .inspector-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .inspector-label {
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    .inspector-value {
      color: var(--text-main);
    }

    /* Dream-Correction Interface */
    .dream-container {
      width: 100%;
      height: 100%;
      display: flex;
      padding: 30px;
      gap: 30px;
      overflow: hidden;
    }

    .dream-main {
      flex: 1;
      background: var(--panel-bg);
      backdrop-filter: blur(15px);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dream-sidebar {
      width: 360px;
      background: var(--panel-bg);
      backdrop-filter: blur(15px);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 25px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
    }

    .dream-title {
      font-size: 18px;
      font-weight: 700;
      color: #c77dff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    .dream-mem-list {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .dream-mem-card {
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.3s ease;
    }

    .dream-mem-card:hover {
      border-color: var(--panel-border-hover);
    }

    .dream-mem-editor {
      width: 100%;
      background: rgba(10, 8, 20, 0.8);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 10px;
      color: var(--text-main);
      font-size: 13px;
      min-height: 80px;
      resize: vertical;
      outline: none;
      transition: all 0.3s ease;
    }

    .dream-mem-editor:focus {
      border-color: var(--primary);
    }

    .dream-btn-group {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid transparent;
      outline: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #fff;
    }

    .btn-primary:hover {
      background: #b57cff;
      box-shadow: 0 0 10px rgba(157, 78, 221, 0.3);
    }

    .btn-danger {
      background: transparent;
      color: var(--accent-red);
      border-color: rgba(217, 4, 41, 0.3);
    }

    .btn-danger:hover {
      background: rgba(217, 4, 41, 0.15);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      border-color: var(--panel-border);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .compaction-card {
      background: rgba(157, 78, 221, 0.05);
      border: 1px solid rgba(157, 78, 221, 0.2);
      border-radius: 8px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .compaction-text {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(157, 78, 221, 0.2);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(157, 78, 221, 0.4);
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-container">
      <div class="logo-icon"></div>
      <div class="logo-title">Engram Notion MCP</div>
    </div>
    <div class="nav-tabs">
      <button class="tab-button active" onclick="switchTab('graph')">Knowledge Graph</button>
      <button class="tab-button" onclick="switchTab('memories')">Memories Timeline</button>
      <button class="tab-button" onclick="switchTab('dream')">Dream-Correction</button>
    </div>
  </header>

  <main>
    <!-- TAB 1: KNOWLEDGE GRAPH -->
    <div id="content-graph" class="tab-content active">
      <div class="left-panel">
        <div class="search-section">
          <div class="search-input-wrapper">
            <input type="text" class="search-input" id="graph-search" placeholder="Search knowledge graph..." oninput="filterGraph()">
          </div>
        </div>
        <div class="timeline-container" id="graph-sidebar-info">
          <!-- Sidebar context -->
          <div style="padding: 10px; color: var(--text-muted); font-size: 13px;">
            Hover over nodes in the graph to see details, or use the search bar above to highlight entities.
          </div>
        </div>
      </div>
      <div class="right-panel">
        <div class="graph-container" id="graph"></div>
        <div class="inspector-panel" id="inspector" style="display: none;">
          <div class="inspector-header" id="inspect-label">Entity Details</div>
          <div class="inspector-row">
            <span class="inspector-label">Type</span>
            <span class="inspector-value" id="inspect-type">-</span>
          </div>
          <div class="inspector-row">
            <span class="inspector-label">Name</span>
            <span class="inspector-value" id="inspect-name">-</span>
          </div>
          <div class="inspector-row" id="inspect-connections-row">
            <span class="inspector-label">Connected to</span>
            <span class="inspector-value" id="inspect-connections">-</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: MEMORIES TIMELINE -->
    <div id="content-memories" class="tab-content">
      <div style="width: 100%; display: flex; flex-direction: column; overflow: hidden;">
        <div class="metrics-container" id="metrics-bar">
          <div class="metric-card">
            <div class="metric-value" id="metric-memories">0</div>
            <div class="metric-label">Total Memories</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="metric-nodes">0</div>
            <div class="metric-label">Entity Nodes</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="metric-edges">0</div>
            <div class="metric-label">Relationships</div>
          </div>
          <div class="metric-card">
            <div class="metric-value" id="metric-sessions">0</div>
            <div class="metric-label">Sessions Logged</div>
          </div>
        </div>
        <div style="flex: 1; display: flex; overflow: hidden; background: rgba(10, 8, 20, 0.2);">
          <div style="width: 400px; border-right: 1px solid var(--panel-border); padding: 20px; display: flex; flex-direction: column; gap: 15px;">
            <h3 class="dream-title" style="margin-bottom: 0;">Search Filter</h3>
            <input type="text" class="search-input" id="timeline-search" placeholder="Type query to filter timeline..." oninput="loadTimeline()">
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 30px;" id="timeline-list">
            <!-- Timeline elements load here -->
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: DREAM CORRECTION -->
    <div id="content-dream" class="tab-content">
      <div class="dream-container">
        <div class="dream-main">
          <h3 class="dream-title" style="padding: 20px; border-bottom: 1px solid var(--panel-border);">Memory Registry</h3>
          <div class="dream-mem-list" id="dream-list">
            <!-- Editable cards go here -->
          </div>
        </div>
        <div class="dream-sidebar">
          <h3 class="dream-title">Dream Engine</h3>
          <div class="compaction-card">
            <strong style="font-size: 13px; color: #c77dff;">Weekly Dream Check</strong>
            <p class="compaction-text">Re-evaluating stored data helps consolidate redundant memories, build structural graph schemas, and reduce AI hallucinations.</p>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
              <input type="checkbox" id="reminder-toggle" onchange="toggleReminder()">
              <label for="reminder-toggle" style="font-size: 12px; color: var(--text-main); cursor: pointer;">Enable weekly reminders</label>
            </div>
          </div>
          <div class="compaction-card" style="background: rgba(58, 134, 200, 0.05); border-color: rgba(58, 134, 200, 0.2);">
            <strong style="font-size: 13px; color: #61a5ff;">Trigger Dream Compaction</strong>
            <p class="compaction-text">This will automatically analyze facts and merge semantic duplicates inside the local SQLite database.</p>
            <button class="btn btn-primary" onclick="runCompaction()" style="margin-top: 10px; width: 100%;">De-duplicate & Compact</button>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    let currentTab = 'graph';
    let graphData = { nodes: [], links: [] };
    let d3Elements = null;

    function switchTab(tabId) {
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      const targetBtn = Array.from(document.querySelectorAll('.tab-button')).find(btn => btn.innerText.toLowerCase().includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');
      
      const targetContent = document.getElementById('content-' + tabId);
      if (targetContent) targetContent.classList.add('active');
      
      currentTab = tabId;
      
      if (tabId === 'graph') {
        loadGraph();
      } else if (tabId === 'memories') {
        loadTimeline();
        loadMetrics();
      } else if (tabId === 'dream') {
        loadDreamCorrection();
      }
    }

    // Load Metrics
    async function loadMetrics() {
      try {
        const res = await fetch('/api/metrics');
        const metrics = await res.json();
        document.getElementById('metric-memories').innerText = metrics.total_memories;
        document.getElementById('metric-nodes').innerText = metrics.total_nodes;
        document.getElementById('metric-edges').innerText = metrics.total_edges;
        document.getElementById('metric-sessions').innerText = metrics.active_sessions;
      } catch (err) {
        console.error('Error fetching metrics', err);
      }
    }

    // Load Timeline
    async function loadTimeline() {
      const searchVal = document.getElementById('timeline-search').value;
      const url = '/api/memories' + (searchVal ? '?q=' + encodeURIComponent(searchVal) : '');
      
      try {
        const res = await fetch(url);
        const memories = await res.json();
        
        const list = document.getElementById('timeline-list');
        list.innerHTML = '';
        
        if (memories.length === 0) {
          list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px;">No memories found.</div>';
          return;
        }

        memories.forEach(mem => {
          const card = document.createElement('div');
          card.className = 'timeline-card';
          
          const isNotion = mem.hall && mem.hall.toLowerCase() === 'notion_sync';
          const typeTag = isNotion ? '<span class="timeline-tag tag-notion">Notion</span>' : '<span class="timeline-tag tag-fact">Fact</span>';
          const date = new Date(mem.created_at).toLocaleString();
          
          let sessionInfo = '';
          if (mem.agent_name || mem.harness_name) {
            sessionInfo = \`via \${mem.agent_name || 'Agent'} (\${mem.harness_name || 'Unknown'}) \`;
          }
          
          card.innerHTML = \`
            <div class="timeline-header">
              \${typeTag}
              <span class="timeline-time">\${date}</span>
            </div>
            <div class="timeline-content">\${mem.content}</div>
            <div class="timeline-meta">
              <span>\${sessionInfo}</span>
              <span>Wing: \${mem.wing || 'default'} | Room: \${mem.room || 'general'}</span>
            </div>
          \`;
          list.appendChild(card);
        });
      } catch (err) {
        console.error('Error loading timeline', err);
      }
    }

    // Load Graph
    async function loadGraph() {
      try {
        const res = await fetch('/api/graph');
        graphData = await res.json();
        renderGraph();
      } catch (err) {
        console.error('Error loading graph data', err);
      }
    }

    function renderGraph() {
      const container = document.getElementById('graph');
      container.innerHTML = '';
      
      const width = container.clientWidth;
      const height = container.clientHeight;

      const svg = d3.select("#graph")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .call(d3.zoom().on("zoom", (event) => {
          g.attr("transform", event.transform);
        }));

      const g = svg.append("g");

      const simulation = d3.forceSimulation(graphData.nodes)
        .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(40));

      const link = g.append("g")
        .selectAll("line")
        .data(graphData.links)
        .enter().append("line")
        .attr("class", "link");

      const node = g.append("g")
        .selectAll("circle")
        .data(graphData.nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", d => d.type === 'concept' ? 12 : 8)
        .attr("fill", d => {
          if (d.type === 'concept') return '#c77dff';
          if (d.type === 'page') return '#3a86c8';
          return '#9d4edd';
        })
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
        .on("click", (event, d) => inspectNode(d));

      const text = g.append("g")
        .selectAll("text")
        .data(graphData.nodes)
        .enter().append("text")
        .attr("class", "node-text")
        .attr("dx", 15)
        .attr("dy", ".35em")
        .text(d => d.label);

      simulation.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        node
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);

        text
          .attr("x", d => d.x)
          .attr("y", d => d.y);
      });

      d3Elements = { node, link, text, simulation };

      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    }

    function inspectNode(node) {
      document.getElementById('inspect-label').innerText = node.label;
      document.getElementById('inspect-name').innerText = node.id;
      document.getElementById('inspect-type').innerText = node.type || 'Entity';
      
      const connections = graphData.links
        .filter(l => l.source.id === node.id || l.target.id === node.id)
        .map(l => {
          const other = l.source.id === node.id ? l.target.label : l.source.label;
          return \`\${other} (\${l.relation_type})\`;
        })
        .join(', ');
        
      document.getElementById('inspect-connections').innerText = connections || 'None';
      document.getElementById('inspector').style.display = 'flex';
    }

    function filterGraph() {
      if (!d3Elements) return;
      const searchVal = document.getElementById('graph-search').value.toLowerCase();
      
      d3Elements.node.style("opacity", d => {
        if (!searchVal) return 1;
        return d.label.toLowerCase().includes(searchVal) ? 1 : 0.15;
      });

      d3Elements.text.style("opacity", d => {
        if (!searchVal) return 1;
        return d.label.toLowerCase().includes(searchVal) ? 1 : 0.15;
      });

      d3Elements.link.style("opacity", d => {
        if (!searchVal) return 1;
        const sourceMatch = d.source.label.toLowerCase().includes(searchVal);
        const targetMatch = d.target.label.toLowerCase().includes(searchVal);
        return (sourceMatch && targetMatch) ? 1 : 0.05;
      });
    }

    // Load Dream Correction
    async function loadDreamCorrection() {
      try {
        const res = await fetch('/api/memories');
        const memories = await res.json();
        
        const list = document.getElementById('dream-list');
        list.innerHTML = '';

        if (memories.length === 0) {
          list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px;">No memory entries found to correct.</div>';
          return;
        }

        memories.forEach(mem => {
          const card = document.createElement('div');
          card.className = 'dream-mem-card';
          card.id = 'dream-card-' + mem.id;
          
          card.innerHTML = \`
            <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>Memory ID: \${mem.id}</span>
              <span>\${new Date(mem.created_at).toLocaleString()}</span>
            </div>
            <textarea class="dream-mem-editor" id="editor-\${mem.id}">\${mem.content}</textarea>
            <div class="dream-btn-group">
              <button class="btn btn-danger" onclick="deleteMemory('\${mem.id}')">Prune</button>
              <button class="btn btn-primary" onclick="saveCorrection('\${mem.id}')">Save Changes</button>
            </div>
          \`;
          list.appendChild(card);
        });
      } catch (err) {
        console.error('Error fetching dream correction list', err);
      }
    }

    async function saveCorrection(id) {
      const editor = document.getElementById('editor-' + id);
      const newContent = editor.value;

      try {
        const res = await fetch('/api/memories/correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', id, content: newContent })
        });
        
        if (res.ok) {
          alert('Memory corrected successfully.');
          loadDreamCorrection();
        } else {
          alert('Failed to save correction.');
        }
      } catch (err) {
        console.error('Error correcting memory', err);
      }
    }

    async function deleteMemory(id) {
      if (!confirm('Are you sure you want to prune/delete this memory?')) return;
      
      try {
        const res = await fetch('/api/memories/correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id })
        });
        
        if (res.ok) {
          document.getElementById('dream-card-' + id).remove();
        } else {
          alert('Failed to prune memory.');
        }
      } catch (err) {
        console.error('Error deleting memory', err);
      }
    }

    async function runCompaction() {
      try {
        const res = await fetch('/api/compaction', { method: 'POST' });
        if (res.ok) {
          alert('Dream compaction complete. Duplicate facts consolidated!');
          loadDreamCorrection();
        } else {
          alert('Failed to trigger compaction.');
        }
      } catch (err) {
        console.error('Error in compaction', err);
      }
    }

    // Weekly Reminder Scheduler
    function toggleReminder() {
      const checked = document.getElementById('reminder-toggle').checked;
      localStorage.setItem('dream-weekly-reminder', checked ? 'true' : 'false');
      if (checked) {
        alert('Weekly Dream-Correction Reminder enabled! The dashboard will alert you weekly to review and consolidate your graph memories.');
      }
    }

    window.onload = () => {
      switchTab('graph');
      const reminderEnabled = localStorage.getItem('dream-weekly-reminder') === 'true';
      document.getElementById('reminder-toggle').checked = reminderEnabled;
    };
  </script>
</body>
</html>
"""
