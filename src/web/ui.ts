export const WEB_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Database Server - Connection Manager</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --success: #16a34a;
      --warning: #d97706;
      --bg: #f1f5f9;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
      --radius: 8px;
      --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    header { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow); }
    header h1 { font-size: 18px; font-weight: 600; }
    header h1 span { color: var(--text-muted); font-weight: 400; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-danger:hover { background: var(--danger-hover); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { background: var(--bg); }
    .btn-success { background: var(--success); color: #fff; }
    .btn-sm { padding: 5px 10px; font-size: 13px; }
    main { max-width: 960px; margin: 24px auto; padding: 0 24px; }
    .empty-state { text-align: center; padding: 48px; color: var(--text-muted); }
    .empty-state p { margin-top: 8px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 12px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
    .card-info { flex: 1; }
    .card-info h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .card-info .meta { font-size: 13px; color: var(--text-muted); display: flex; gap: 16px; flex-wrap: wrap; }
    .card-actions { display: flex; gap: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-sqlite { background: #dbeafe; color: #1e40af; }
    .badge-postgresql { background: #e0e7ff; color: #3730a3; }
    .badge-mysql { background: #fef3c7; color: #92400e; }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal { background: var(--card); border-radius: 12px; width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { padding: 20px 24px 0; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h2 { font-size: 18px; }
    .modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted); padding: 4px; }
    .modal-body { padding: 16px 24px 24px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: var(--text); }
    .form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; color: var(--text); background: #fff; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .alert { padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 14px; }
    .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>MCP Database Server <span>/ Connections</span></h1>
    <button class="btn btn-primary" onclick="openModal()">+ Add Connection</button>
  </header>
  <main>
    <div id="connection-list"></div>
  </main>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modal-title">Add Connection</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="form-alert"></div>
        <form id="connection-form" onsubmit="handleSubmit(event)">
          <input type="hidden" id="edit-original-name" />
          <div class="form-row">
            <div class="form-group">
              <label for="conn-name">Connection Name</label>
              <input type="text" id="conn-name" required placeholder="my-database" />
            </div>
            <div class="form-group">
              <label for="conn-type">Database Type</label>
              <select id="conn-type" onchange="toggleFields()">
                <option value="sqlite">SQLite</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
          </div>

          <!-- SQLite fields -->
          <div id="sqlite-fields">
            <div class="form-group">
              <label for="conn-path">Database File Path</label>
              <input type="text" id="conn-path" placeholder="/path/to/database.db" />
            </div>
          </div>

          <!-- Network DB fields -->
          <div id="network-fields" class="hidden">
            <div class="form-row">
              <div class="form-group">
                <label for="conn-host">Host</label>
                <input type="text" id="conn-host" placeholder="localhost" />
              </div>
              <div class="form-group">
                <label for="conn-port">Port</label>
                <input type="number" id="conn-port" />
              </div>
            </div>
            <div class="form-group">
              <label for="conn-database">Database Name</label>
              <input type="text" id="conn-database" placeholder="myapp" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="conn-username">Username</label>
                <input type="text" id="conn-username" />
              </div>
              <div class="form-group">
                <label for="conn-password">Password</label>
                <input type="password" id="conn-password" />
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="conn-max">Max Connections</label>
              <input type="number" id="conn-max" value="10" min="1" />
            </div>
            <div class="form-group">
              <label for="conn-timeout">Timeout (ms)</label>
              <input type="number" id="conn-timeout" value="30000" min="1000" step="1000" />
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="testConnection()">Test Connection</button>
            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="save-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    const API = '/api/connections';
    let editMode = false;

    async function loadConnections() {
      try {
        const res = await fetch(API);
        const data = await res.json();
        render(data.connections || []);
      } catch (e) {
        document.getElementById('connection-list').innerHTML =
          '<div class="alert alert-error">Failed to load connections.</div>';
      }
    }

    function render(connections) {
      const el = document.getElementById('connection-list');
      if (!connections.length) {
        el.innerHTML = '<div class="empty-state"><h3>No connections configured</h3><p>Click "Add Connection" to get started.</p></div>';
        return;
      }
      el.innerHTML = connections.map(c => {
        const details = c.type === 'sqlite'
          ? c.path || ''
          : [c.host, c.port, c.database].filter(Boolean).join(':');
        return '<div class="card">'
          + '<div class="card-info">'
          + '<h3>' + esc(c.name) + ' <span class="badge badge-' + c.type + '">' + c.type + '</span></h3>'
          + '<div class="meta"><span>' + esc(details) + '</span></div>'
          + '</div>'
          + '<div class="card-actions">'
          + '<button class="btn btn-outline btn-sm" onclick="testSaved(\\'' + esc(c.name) + '\\')">Test</button>'
          + '<button class="btn btn-outline btn-sm" onclick="editConnection(\\'' + esc(c.name) + '\\')">Edit</button>'
          + '<button class="btn btn-danger btn-sm" onclick="deleteConnection(\\'' + esc(c.name) + '\\')">Delete</button>'
          + '</div></div>';
      }).join('');
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function toggleFields() {
      const type = document.getElementById('conn-type').value;
      document.getElementById('sqlite-fields').classList.toggle('hidden', type !== 'sqlite');
      document.getElementById('network-fields').classList.toggle('hidden', type === 'sqlite');
      if (type === 'postgresql') document.getElementById('conn-port').placeholder = '5432';
      else if (type === 'mysql') document.getElementById('conn-port').placeholder = '3306';
    }

    function openModal(data) {
      editMode = !!data;
      document.getElementById('modal-title').textContent = editMode ? 'Edit Connection' : 'Add Connection';
      document.getElementById('save-btn').textContent = editMode ? 'Update' : 'Save';
      document.getElementById('form-alert').innerHTML = '';
      const form = document.getElementById('connection-form');
      form.reset();

      if (data) {
        document.getElementById('edit-original-name').value = data.name;
        document.getElementById('conn-name').value = data.name;
        document.getElementById('conn-type').value = data.type;
        document.getElementById('conn-path').value = data.path || '';
        document.getElementById('conn-host').value = data.host || '';
        document.getElementById('conn-port').value = data.port || '';
        document.getElementById('conn-database').value = data.database || '';
        document.getElementById('conn-username').value = data.username || '';
        document.getElementById('conn-password').value = data.password || '';
        document.getElementById('conn-max').value = data.maxConnections || 10;
        document.getElementById('conn-timeout').value = data.timeout || 30000;
      }
      toggleFields();
      document.getElementById('modal-overlay').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
    }

    function getFormData() {
      const type = document.getElementById('conn-type').value;
      const data = {
        name: document.getElementById('conn-name').value.trim(),
        type: type,
        maxConnections: parseInt(document.getElementById('conn-max').value) || 10,
        timeout: parseInt(document.getElementById('conn-timeout').value) || 30000,
      };
      if (type === 'sqlite') {
        data.path = document.getElementById('conn-path').value.trim();
      } else {
        data.host = document.getElementById('conn-host').value.trim();
        const port = document.getElementById('conn-port').value;
        if (port) data.port = parseInt(port);
        data.database = document.getElementById('conn-database').value.trim();
        data.username = document.getElementById('conn-username').value.trim();
        const pw = document.getElementById('conn-password').value;
        if (pw) data.password = pw;
      }
      return data;
    }

    function showAlert(msg, type) {
      document.getElementById('form-alert').innerHTML =
        '<div class="alert alert-' + type + '">' + esc(msg) + '</div>';
    }

    async function handleSubmit(e) {
      e.preventDefault();
      const data = getFormData();
      const originalName = document.getElementById('edit-original-name').value;
      try {
        let res;
        if (editMode && originalName) {
          res = await fetch(API + '/' + encodeURIComponent(originalName), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }
        const result = await res.json();
        if (!res.ok || !result.success) {
          showAlert(result.error || 'Failed to save', 'error');
          return;
        }
        closeModal();
        loadConnections();
      } catch (err) {
        showAlert('Request failed: ' + err.message, 'error');
      }
    }

    async function editConnection(name) {
      try {
        const res = await fetch(API + '/' + encodeURIComponent(name));
        const data = await res.json();
        if (data.connection) openModal(data.connection);
      } catch (e) {
        alert('Failed to load connection details.');
      }
    }

    async function deleteConnection(name) {
      if (!confirm('Delete connection "' + name + '"?')) return;
      try {
        const res = await fetch(API + '/' + encodeURIComponent(name), { method: 'DELETE' });
        const data = await res.json();
        if (!data.success) { alert(data.error || 'Delete failed'); return; }
        loadConnections();
      } catch (e) {
        alert('Delete failed.');
      }
    }

    async function testConnection() {
      const data = getFormData();
      showAlert('Testing connection...', 'success');
      try {
        const res = await fetch(API + '/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          showAlert('Connection successful!', 'success');
        } else {
          showAlert('Connection failed: ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showAlert('Test request failed: ' + e.message, 'error');
      }
    }

    async function testSaved(name) {
      try {
        const res = await fetch(API + '/' + encodeURIComponent(name) + '/test', { method: 'POST' });
        const result = await res.json();
        alert(result.success ? 'Connection successful!' : 'Connection failed: ' + (result.error || 'Unknown error'));
      } catch (e) {
        alert('Test failed.');
      }
    }

    // Close modal on overlay click
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

    loadConnections();
  </script>
</body>
</html>`;
