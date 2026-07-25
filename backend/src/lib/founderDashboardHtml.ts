export const FOUNDER_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ONE MORE Founder Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #060a12; --surface: #0d1320; --card: #121a2b; --border: #1e2d45;
      --text: #eef2f8; --muted: #8b95a8; --accent: #1F6BFF; --cyan: #00E5FF;
      --good: #22c55e; --warn: #f59e0b; --bad: #ef4444;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
    header {
      position: sticky; top: 0; z-index: 100;
      padding: 16px 28px; border-bottom: 1px solid var(--border);
      background: rgba(6,10,18,.92); backdrop-filter: blur(12px);
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .brand h1 { margin: 0; font-size: 1.25rem; background: linear-gradient(90deg, var(--accent), var(--cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .brand p { margin: 4px 0 0; color: var(--muted); font-size: .85rem; }
    .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { padding: 9px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: .875rem; }
    button { background: linear-gradient(135deg, var(--accent), #1554cc); border: none; cursor: pointer; font-weight: 600; }
    button.secondary { background: var(--card); border: 1px solid var(--border); }
    main { padding: 24px 28px 48px; max-width: 1400px; margin: 0 auto; }
    .status { color: var(--muted); font-size: .875rem; margin-bottom: 20px; min-height: 1.25rem; }
    .exec { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .exec-card {
      background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px;
    }
    .exec-card .label { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .exec-card .answer { font-size: .95rem; font-weight: 600; margin-top: 6px; }
    .pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: .7rem; font-weight: 700; }
    .pill.yes { background: rgba(34,197,94,.15); color: var(--good); }
    .pill.no { background: rgba(239,68,68,.15); color: var(--bad); }
    section { margin-bottom: 36px; }
    section > h2 {
      font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--cyan);
      margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
    .card h3 { margin: 0 0 8px; font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .card .value { font-size: 1.6rem; font-weight: 700; }
    .card .sub { font-size: .75rem; color: var(--muted); margin-top: 4px; }
    .chart-card { min-height: 260px; }
    .chart-wrap { position: relative; height: 220px; }
    .insights { display: flex; flex-direction: column; gap: 10px; }
    .insight {
      background: linear-gradient(135deg, rgba(31,107,255,.08), rgba(0,229,255,.05));
      border: 1px solid rgba(31,107,255,.25); border-radius: 10px; padding: 14px 16px;
      font-size: .925rem; line-height: 1.5;
    }
    .insight .tag { font-size: .65rem; text-transform: uppercase; color: var(--cyan); font-weight: 700; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 600; font-size: .75rem; text-transform: uppercase; }
    .error { color: var(--bad); }
    .hidden { display: none; }
    @media (max-width: 640px) { main { padding: 16px; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>ONE MORE Founder Dashboard</h1>
      <p>Outcome intelligence — evidence, not opinions</p>
    </div>
    <div class="toolbar">
      <input type="password" id="adminKey" placeholder="Founder admin key" />
      <button id="loadBtn">Load</button>
      <button id="refreshBtn">Recompute</button>
    </div>
  </header>

  <main>
    <div id="status" class="status">Enter admin key and click Load.</div>
    <div id="dashboard" class="hidden">

      <div class="exec" id="executive"></div>

      <section>
        <h2>Founder Insight — Strategic Brain</h2>
        <div id="insights" class="insights"></div>
      </section>

      <section>
        <h2>Company Health</h2>
        <div class="grid" id="companyHealth"></div>
      </section>

      <section>
        <h2>Outcome Health</h2>
        <div class="grid" id="outcomeHealth"></div>
      </section>

      <section>
        <h2>Visualizations</h2>
        <div class="grid-2">
          <div class="card chart-card"><h3>Weight Trends (avg delta lbs)</h3><div class="chart-wrap"><canvas id="chartWeight"></canvas></div></div>
          <div class="card chart-card"><h3>Success Score Trend</h3><div class="chart-wrap"><canvas id="chartSuccessTrend"></canvas></div></div>
          <div class="card chart-card"><h3>Success Score Distribution</h3><div class="chart-wrap"><canvas id="chartScoreDist"></canvas></div></div>
          <div class="card chart-card"><h3>Goal Achievement Rates</h3><div class="chart-wrap"><canvas id="chartGoals"></canvas></div></div>
          <div class="card chart-card"><h3>Retention Cohorts</h3><div class="chart-wrap"><canvas id="chartRetention"></canvas></div></div>
          <div class="card chart-card"><h3>Adherence Trends</h3><div class="chart-wrap"><canvas id="chartAdherence"></canvas></div></div>
        </div>
      </section>

      <section>
        <h2>User Success</h2>
        <div class="grid-3">
          <div class="card chart-card"><h3>Goal Completion Distribution</h3><div class="chart-wrap"><canvas id="chartGoalDist"></canvas></div></div>
          <div class="card chart-card"><h3>Workout Adherence Distribution</h3><div class="chart-wrap"><canvas id="chartWorkoutDist"></canvas></div></div>
          <div class="card chart-card"><h3>Nutrition Adherence Distribution</h3><div class="chart-wrap"><canvas id="chartNutritionDist"></canvas></div></div>
        </div>
      </section>

      <section>
        <h2>Risk Dashboard</h2>
        <div class="grid" id="riskKpis"></div>
        <div class="grid-2" style="margin-top:16px">
          <div class="card"><h3>Top Risk Reasons</h3><div id="riskReasons"></div></div>
          <div class="card"><h3>Users Needing Intervention</h3><div style="overflow:auto;max-height:320px"><table id="interventionTable"><thead><tr><th>User</th><th>Score</th><th>Status</th><th>Risk</th></tr></thead><tbody></tbody></table></div></div>
        </div>
      </section>

      <section>
        <h2>Goal Analytics</h2>
        <div class="grid-2">
          <div class="card"><h3>Most Successful Goals</h3><div id="goalsSuccess"></div></div>
          <div class="card"><h3>Least Successful Goals</h3><div id="goalsFail"></div></div>
        </div>
      </section>

      <section>
        <h2>Behavior Analytics</h2>
        <div class="grid-2">
          <div class="card"><h3>Behaviors Correlated with Success</h3><div id="behSuccess"></div></div>
          <div class="card"><h3>Behaviors Correlated with Failure</h3><div id="behFail"></div></div>
        </div>
      </section>
    </div>
  </main>

  <script>
    const charts = {};
    const keyInput = document.getElementById('adminKey');
    if (sessionStorage.getItem('lf_founder_key')) keyInput.value = sessionStorage.getItem('lf_founder_key');

    // The page gate accepts ?key=…; strip it from the URL so the admin key is not kept in history.
    var urlKey = new URLSearchParams(location.search).get('key');
    if (urlKey) {
      keyInput.value = urlKey;
      sessionStorage.setItem('lf_founder_key', urlKey);
      history.replaceState(null, '', location.pathname);
    }

    function headers() {
      const key = keyInput.value.trim();
      sessionStorage.setItem('lf_founder_key', key);
      return { 'x-founder-admin-key': key, 'Content-Type': 'application/json' };
    }

    function fmt(n, suffix) {
      if (n == null || n === '') return '—';
      if (typeof n === 'number') return n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + (suffix || '');
      return String(n);
    }

    function kpiCards(el, items) {
      el.innerHTML = items.map(function(i) {
        return '<div class="card"><h3>' + i[0] + '</h3><div class="value">' + fmt(i[1], i[2] || '') + '</div>' +
          (i[3] ? '<div class="sub">' + i[3] + '</div>' : '') + '</div>';
      }).join('');
    }

    function destroyCharts() {
      Object.keys(charts).forEach(function(k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
    }

    function makeChart(id, type, labels, datasets, opts) {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(ctx, {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: Object.assign({
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#8b95a8', boxWidth: 12 } } },
          scales: type !== 'doughnut' && type !== 'pie' ? {
            x: { ticks: { color: '#8b95a8', maxRotation: 45 }, grid: { color: 'rgba(30,45,69,.5)' } },
            y: { ticks: { color: '#8b95a8' }, grid: { color: 'rgba(30,45,69,.5)' } }
          } : {}
        }, opts || {})
      });
    }

    function renderList(el, items, key) {
      if (!items || !items.length) { el.innerHTML = '<p class="sub">No data yet — run Recompute after migration 011.</p>'; return; }
      el.innerHTML = '<ul style="margin:0;padding-left:18px;line-height:1.7">' +
        items.map(function(i) { return '<li><strong>' + (i.type || i.factor || i.reason) + '</strong>: ' +
          (i.insight || i.successRate + '% success (' + i.completed + '/' + i.total + ')' || i.count + ' users') + '</li>'; }).join('') + '</ul>';
    }

    function renderDashboard(d) {
      document.getElementById('dashboard').classList.remove('hidden');
      const ex = d.executiveSummary || {};
      document.getElementById('executive').innerHTML = [
        ['Are users improving?', ex.areUsersImproving, '', 'pill'],
        ['Are users reaching goals?', ex.areUsersReachingGoals, '', 'pill'],
        ['Are users staying engaged?', ex.areUsersStayingEngaged, '', 'pill'],
        ['Top quit driver', (ex.topQuitDrivers || [])[0] || '—'],
        ['Top success behavior', (ex.topSuccessBehaviors || [])[0] || '—'],
      ].map(function(row) {
        if (row[3] === 'pill') {
          var cls = row[1] ? 'yes' : 'no';
          return '<div class="exec-card"><div class="label">' + row[0] + '</div><div class="answer"><span class="pill ' + cls + '">' + (row[1] ? 'YES' : 'NEEDS WORK') + '</span></div></div>';
        }
        return '<div class="exec-card"><div class="label">' + row[0] + '</div><div class="answer">' + (row[1] || '—') + '</div></div>';
      }).join('');

      document.getElementById('insights').innerHTML = (d.founderInsights || []).map(function(i) {
        return '<div class="insight"><div class="tag">' + (i.source === 'ai' ? 'AI + Data' : 'Evidence') + ' · ' + i.confidence + '</div>' + i.text + '</div>';
      }).join('') || '<p class="sub">Run Recompute to generate insights.</p>';

      var ch = d.companyHealth || {};
      kpiCards(document.getElementById('companyHealth'), [
        ['Total Users', ch.totalUsers], ['Active Users (30d)', ch.activeUsers], ['Paying Users', ch.payingUsers],
        ['Retention (30d)', ch.retention30d, '%'], ['Churn (30d)', ch.churnRate30d, '%', ch.churnedUsers + ' users churned'],
        ['Onboarded', ch.onboardedUsers],
      ]);

      var oh = d.outcomeHealth || {};
      kpiCards(document.getElementById('outcomeHealth'), [
        ['Lives Improved', oh.livesImproved], ['Goals Achieved', oh.goalsAchieved, '', oh.totalGoals + ' total goals'],
        ['Pounds Lost', oh.poundsLost, ' lbs'], ['Strength Gained', oh.strengthGainedPct, '% avg'],
        ['Recovery Improved', oh.recoveryImprovedUsers, ' users'], ['Avg Success Score', oh.avgSuccessScore],
      ]);

      var rd = d.riskDashboard || {};
      kpiCards(document.getElementById('riskKpis'), [
        ['Users At Risk', rd.usersAtRisk], ['Needing Intervention', rd.usersNeedingAttention],
      ]);
      document.getElementById('riskReasons').innerHTML = (rd.topRiskReasons || []).map(function(r) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>' + r.reason + '</span><strong>' + r.count + '</strong></div>';
      }).join('') || '<p class="sub">No active risk flags</p>';

      var tbody = document.querySelector('#interventionTable tbody');
      tbody.innerHTML = (rd.usersNeedingIntervention || []).map(function(u) {
        return '<tr><td>' + u.userId + '</td><td>' + fmt(u.overallScore) + '</td><td>' + u.category + '</td><td>' + u.topRisk + '</td></tr>';
      }).join('');

      var ga = d.goalAnalytics || {};
      renderList(document.getElementById('goalsSuccess'), ga.mostSuccessful);
      renderList(document.getElementById('goalsFail'), ga.leastSuccessful);
      if (ga.avgCompletionTimeDays != null) {
        document.getElementById('goalsSuccess').innerHTML += '<p class="sub">Avg completion time: ' + fmt(ga.avgCompletionTimeDays) + ' days</p>';
      }

      var ba = d.behaviorAnalytics || {};
      document.getElementById('behSuccess').innerHTML = (ba.successCorrelations || []).map(function(c) {
        return '<div class="insight" style="margin-bottom:8px"><strong>' + c.factor + '</strong><br>' + c.insight + '<br><span class="sub">' + c.evidence + '</span></div>';
      }).join('') || '<p class="sub">Insufficient data</p>';
      document.getElementById('behFail').innerHTML = (ba.failureCorrelations || []).map(function(c) {
        return '<div class="insight" style="margin-bottom:8px;border-color:rgba(239,68,68,.3)"><strong>' + c.factor + '</strong><br>' + c.insight + '</div>';
      }).join('') || '<p class="sub">Insufficient data</p>';

      destroyCharts();
      var chartsData = d.charts || {};

      var wt = chartsData.weightTrends || [];
      makeChart('chartWeight', 'line', wt.map(function(x) { return x.date; }), [{
        label: 'Avg Δ lbs', data: wt.map(function(x) { return x.avgDeltaLbs; }), borderColor: '#1F6BFF', backgroundColor: 'rgba(31,107,255,.1)', fill: true, tension: .3
      }]);

      var st = chartsData.successScoreTrend || [];
      makeChart('chartSuccessTrend', 'line', st.map(function(x) { return x.date; }), [{
        label: 'Avg Success Score', data: st.map(function(x) { return x.avgScore; }), borderColor: '#00E5FF', tension: .3
      }]);

      var sd = d.userSuccess?.successScoreDistribution || chartsData.successScoreDistribution || {};
      makeChart('chartScoreDist', 'doughnut', ['Exceptional', 'Good', 'Needs Attention', 'At Risk'], [{
        data: [sd.exceptional||0, sd.good||0, sd.needs_attention||0, sd.at_risk||0],
        backgroundColor: ['#22c55e', '#1F6BFF', '#f59e0b', '#ef4444']
      }]);

      var gr = chartsData.goalAchievementRates || [];
      makeChart('chartGoals', 'bar', gr.map(function(x) { return x.date; }), [{
        label: 'Avg Goal Completion %', data: gr.map(function(x) { return x.avgGoalCompletion; }), backgroundColor: 'rgba(31,107,255,.7)'
      }]);

      var rc = chartsData.retentionCohorts || [];
      makeChart('chartRetention', 'bar', rc.map(function(x) { return x.cohort; }), [{
        label: 'Retention %', data: rc.map(function(x) { return x.retentionRate; }), backgroundColor: 'rgba(0,229,255,.6)'
      }]);

      var at = chartsData.adherenceTrends || [];
      makeChart('chartAdherence', 'line', at.map(function(x) { return x.date; }), [
        { label: 'Workout %', data: at.map(function(x) { return x.workoutAdherence; }), borderColor: '#1F6BFF', tension: .3 },
        { label: 'Nutrition %', data: at.map(function(x) { return x.nutritionAdherence; }), borderColor: '#22c55e', tension: .3 }
      ]);

      var gcd = d.userSuccess?.goalCompletionDistribution || {};
      makeChart('chartGoalDist', 'bar', Object.keys(gcd), [{ label: 'Goals', data: Object.values(gcd), backgroundColor: '#1F6BFF' }]);

      var ad = d.userSuccess?.adherenceDistribution || {};
      makeChart('chartWorkoutDist', 'bar', Object.keys(ad.workout || {}), [{ data: Object.values(ad.workout || {}), backgroundColor: '#1F6BFF' }]);
      makeChart('chartNutritionDist', 'bar', Object.keys(ad.nutrition || {}), [{ data: Object.values(ad.nutrition || {}), backgroundColor: '#22c55e' }]);
    }

    async function loadDashboard() {
      document.getElementById('status').textContent = 'Loading…';
      try {
        var res = await fetch('/api/founder/dashboard', { headers: headers() });
        var data = await res.json();
        if (!res.ok) throw new Error(data.message || res.statusText);
        document.getElementById('status').textContent = 'As of ' + (data.asOf || '') + ' · Generated ' + new Date(data.generatedAt || Date.now()).toLocaleString();
        renderDashboard(data);
      } catch (e) {
        document.getElementById('status').innerHTML = '<span class="error">' + e.message + '</span>';
      }
    }

    async function refreshAll() {
      document.getElementById('status').textContent = 'Recomputing outcome intelligence…';
      try {
        var res = await fetch('/api/founder/refresh', { method: 'POST', headers: headers() });
        var data = await res.json();
        if (!res.ok) throw new Error(data.message || res.statusText);
        document.getElementById('status').textContent = 'Recomputed ' + data.compute.processed + ' users · ' + (data.compute.errors?.length || 0) + ' errors';
        renderDashboard(data.dashboard);
      } catch (e) {
        document.getElementById('status').innerHTML = '<span class="error">' + e.message + '</span>';
      }
    }

    document.getElementById('loadBtn').addEventListener('click', loadDashboard);
    document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  </script>
</body>
</html>`;
