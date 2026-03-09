import {
  getCommandLogs,
  getCommandStats,
  getCommandStatsByUser,
  getDashboardStats
} from '../db/models/commandLog.js';

const ANALYTICS_KEY = process.env.ANALYTICS_KEY || null;

function isAnalyticsAccessAllowed(key) {
  if (!ANALYTICS_KEY) return true; // Если ключ не установлен, разрешить всем
  return key === ANALYTICS_KEY;
}

export async function setupAnalyticsRoutes(server) {
  // Получить статистику по команде
  server.get('/api/analytics/stats', async (req, reply) => {
    const { key } = req.query;
    if (!isAnalyticsAccessAllowed(key)) {
      return reply.code(403).send({ error: 'Invalid access key' });
    }
    const stats = await getDashboardStats();
    const commandStats = await getCommandStats();
    return { stats, commandStats };
  });

  // Получить логи команд с фильтрами
  server.get('/api/analytics/logs', async (req, reply) => {
    const { telegramUserId, command, status, fromDate, toDate, key } = req.query;
    if (!isAnalyticsAccessAllowed(key)) {
      return reply.code(403).send({ error: 'Invalid access key' });
    }
    const logs = await getCommandLogs({
      telegramUserId: telegramUserId ? BigInt(telegramUserId) : null,
      command,
      status,
      fromDate,
      toDate
    });
    return { logs };
  });

  // Получить статистику по пользователю
  server.get('/api/analytics/user/:telegramUserId', async (req, reply) => {
    const { telegramUserId } = req.params;
    const { key } = req.query;
    if (!isAnalyticsAccessAllowed(key)) {
      return reply.code(403).send({ error: 'Invalid access key' });
    }
    const stats = await getCommandStatsByUser(BigInt(telegramUserId));
    return { stats };
  });

  // HTML страница дашборда
  server.get('/analytics', async (req, reply) => {
    const { key } = req.query;

    // Если ключ требуется, но не предоставлен - показать форму
    if (ANALYTICS_KEY && !isAnalyticsAccessAllowed(key)) {
      reply.type('text/html');
      return getAuthPage();
    }

    reply.type('text/html');
    return getAnalyticsDashboard(key);
  });
}

function getAuthPage() {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics - Access</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .auth-card {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
        }

        .auth-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
            text-align: center;
        }

        .auth-subtitle {
            color: #888;
            text-align: center;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .auth-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
            font-weight: 600;
            color: #333;
            font-size: 14px;
        }

        .form-group input {
            padding: 12px 15px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .auth-button {
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            font-size: 14px;
        }

        .auth-button:hover {
            transform: translateY(-2px);
        }

        .auth-button:active {
            transform: translateY(0);
        }

        .error-message {
            color: #d32f2f;
            font-size: 13px;
            padding: 10px;
            background: #ffebee;
            border-radius: 4px;
            display: none;
        }

        .error-message.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="auth-card">
        <h1 class="auth-title">🔐 Analytics</h1>
        <p class="auth-subtitle">Enter access key to continue</p>

        <div class="error-message" id="errorMsg">Invalid key</div>

        <form class="auth-form" onsubmit="handleSubmit(event)">
            <div class="form-group">
                <label for="key">Access Key</label>
                <input type="password" id="key" name="key" placeholder="Enter your access key" autofocus required>
            </div>
            <button type="submit" class="auth-button">Access Dashboard</button>
        </form>
    </div>

    <script>
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            document.getElementById('errorMsg').classList.add('show');
        }

        function handleSubmit(e) {
            e.preventDefault();
            const key = document.getElementById('key').value;
            if (key) {
                window.location.href = '/analytics?key=' + encodeURIComponent(key);
            }
        }
    </script>
</body>
</html>
  `;
}

function getAnalyticsDashboard(key = '') {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            color: white;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
        }

        .stat-label {
            color: #888;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }

        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
        }

        .stat-subtext {
            color: #ccc;
            font-size: 12px;
            margin-top: 8px;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .chart-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .chart-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
        }

        .logs-section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .logs-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #333;
        }

        .filters {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .filter-input {
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        .filter-input:focus {
            outline: none;
            border-color: #667eea;
        }

        .btn {
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.3s;
        }

        .btn:hover {
            background: #764ba2;
        }

        .logs-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .logs-table thead {
            background: #f5f5f5;
            border-bottom: 2px solid #ddd;
        }

        .logs-table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333;
        }

        .logs-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }

        .logs-table tr:hover {
            background: #f9f9f9;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-success {
            background: #d4edda;
            color: #155724;
        }

        .status-error {
            background: #f8d7da;
            color: #721c24;
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: #888;
        }

        .refresh-btn {
            margin-left: auto;
        }

        @media (max-width: 768px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }

            .filters {
                flex-direction: column;
            }

            .filter-input {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Analytics Dashboard</h1>
            <p>Мониторинг команд и активности пользователей</p>
        </div>

        <div class="stats-grid" id="statsGrid">
            <div class="loading">Загрузка статистики...</div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-title">Команды (последние 24 часа)</div>
                <canvas id="commandsChart"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-title">Статус команд</div>
                <canvas id="statusChart"></canvas>
            </div>
        </div>

        <div class="logs-section">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <div class="logs-title">Последние логи</div>
                <button class="btn refresh-btn" onclick="loadLogs()">🔄 Обновить</button>
            </div>

            <div class="filters">
                <input type="text" class="filter-input" id="filterCommand" placeholder="Фильтр по команде">
                <select class="filter-input" id="filterStatus">
                    <option value="">Все статусы</option>
                    <option value="success">Успех</option>
                    <option value="error">Ошибка</option>
                </select>
                <input type="number" class="filter-input" id="filterUserId" placeholder="ID пользователя Telegram">
                <button class="btn" onclick="loadLogs()">Поиск</button>
            </div>

            <div id="logsContainer">
                <div class="loading">Загрузка логов...</div>
            </div>
        </div>
    </div>

    <script>
        let commandsChart, statusChart;
        const params = new URLSearchParams(window.location.search);
        const accessKey = params.get('key') || '';

        function getApiUrl(endpoint) {
            const separator = endpoint.includes('?') ? '&' : '?';
            return endpoint + (accessKey ? separator + 'key=' + encodeURIComponent(accessKey) : '');
        }

        async function loadStats() {
            try {
                const response = await fetch(getApiUrl('/api/analytics/stats'));
                const data = await response.json();
                renderStats(data.stats, data.commandStats);
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        function renderStats(stats, commandStats) {
            const grid = document.getElementById('statsGrid');
            grid.innerHTML = \`
                <div class="stat-card">
                    <div class="stat-label">Всего команд</div>
                    <div class="stat-value">\${stats.total_commands}</div>
                    <div class="stat-subtext">за все время</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Команд (24ч)</div>
                    <div class="stat-value">\${stats.commands_24h}</div>
                    <div class="stat-subtext">за последние сутки</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Ошибок</div>
                    <div class="stat-value">\${stats.errors_total}</div>
                    <div class="stat-subtext">\${stats.errors_24h} за 24ч</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Уникальные пользователи</div>
                    <div class="stat-value">\${stats.unique_users}</div>
                    <div class="stat-subtext">всего использовали</div>
                </div>
            \`;

            updateCharts(commandStats);
        }

        function updateCharts(commandStats) {
            const commands = commandStats.map(s => s.command);
            const counts24h = commandStats.map(s => s.count_24h);
            const successCounts = commandStats.map(s => s.count - (commandStats.find(c => c.command === s.command && c.status === 'error')?.count || 0));
            const errorCounts = commandStats.map(s => commandStats.find(c => c.command === s.command && c.status === 'error')?.count || 0);

            // Commands chart
            if (commandsChart) commandsChart.destroy();
            commandsChart = new Chart(document.getElementById('commandsChart'), {
                type: 'bar',
                data: {
                    labels: commands,
                    datasets: [{
                        label: 'Команды',
                        data: counts24h,
                        backgroundColor: '#667eea',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });

            // Status chart
            if (statusChart) statusChart.destroy();
            const totalSuccess = commandStats.filter(s => s.status === 'success').reduce((sum, s) => sum + s.count, 0);
            const totalError = commandStats.filter(s => s.status === 'error').reduce((sum, s) => sum + s.count, 0);

            statusChart = new Chart(document.getElementById('statusChart'), {
                type: 'doughnut',
                data: {
                    labels: ['Успех', 'Ошибка'],
                    datasets: [{
                        data: [totalSuccess, totalError],
                        backgroundColor: ['#4caf50', '#f44336'],
                        borderColor: 'white',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        async function loadLogs() {
            const command = document.getElementById('filterCommand').value;
            const status = document.getElementById('filterStatus').value;
            const userId = document.getElementById('filterUserId').value;

            let url = '/api/analytics/logs?';
            if (command) url += \`command=\${command}&\`;
            if (status) url += \`status=\${status}&\`;
            if (userId) url += \`telegramUserId=\${userId}&\`;
            if (accessKey) url += \`key=\${encodeURIComponent(accessKey)}&\`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                renderLogs(data.logs);
            } catch (error) {
                console.error('Error loading logs:', error);
            }
        }

        function renderLogs(logs) {
            const container = document.getElementById('logsContainer');

            if (logs.length === 0) {
                container.innerHTML = '<div class="loading">Нет логов</div>';
                return;
            }

            const html = \`
                <table class="logs-table">
                    <thead>
                        <tr>
                            <th>Время</th>
                            <th>Команда</th>
                            <th>Пользователь</th>
                            <th>Статус</th>
                            <th>Сообщение</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${logs.map(log => \`
                            <tr>
                                <td>\${new Date(log.created_at).toLocaleString('ru-RU')}</td>
                                <td><code>\${log.command}</code></td>
                                <td>\${log.username || log.telegram_user_id}</td>
                                <td><span class="status-badge status-\${log.status}">\${log.status === 'success' ? '✓ Успех' : '✗ Ошибка'}</span></td>
                                <td>\${log.error_message || '-'}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;

            container.innerHTML = html;
        }

        // Загрузить данные при загрузке страницы
        loadStats();
        loadLogs();

        // Обновлять каждые 30 секунд
        setInterval(() => {
            loadStats();
            loadLogs();
        }, 30000);
    </script>
</body>
</html>
  `;
}
