// Global data
let unifiedData = null;
let eventTypeData = null;
let eventWeightsData = null;
let summaryStats = null;
let holdingPeriodData = null;
let modelAccuracyData = null;
let navTimeseriesData = null;
let eventTypeNavData = null;

// Global rendering state to handle race conditions
let activeNavRenderingId = 0;
let selectedEventType = null;
let selectedHoldingMetric = 'TR';

// Constants
const EVENT_TYPE_MAP = {
    '个人言行': 'Personal Behavior',
    '分红转送': 'Dividend',
    '股权变动': 'Equity Change',
    '融资': 'Financing',
    '行业': 'Industry',
    '评级调整': 'Rating Adjustment',
    '财务状况': 'Financial Status',
    '资产变动': 'Asset Change',
    '违法违规': 'Violation',
    '风险警示与消除': 'Risk Warning'
};

const modelColors = {
    'Janus-Q': '#f59e0b',
    'ChatTS-14B': '#3b82f6',
    'Claude-3-Haiku': '#8b5cf6',
    'DISC-FinLLM': '#10b981',
    'DeepSeek-v3.1-nex-n1': '#ef4444',
    'FinMA': '#ec4899',
    'GPT-4o-mini': '#06b6d4',
    'Gemini-2.5-flash': '#84cc16',
    'Grok3-mini-beta': '#f97316',
    'QwQ-32B': '#6366f1',
    'Qwen2.5-7B': '#14b8a6',
    'Stock-Chain': '#f43f5e',
    'Time-MQA': '#a855f7',
    'TimeMaster': '#22c55e',
    'CSI 300': '#6b7280',
    'CSI 500': '#9ca3af',
    'CSI 1000': '#d1d5db',
};

const chartColors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
    '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting data load...');
    loadAllData();
});

// Parallel Data Loading
async function loadAllData() {
    try {
        console.log('Loading all data files in parallel...');
        const endpoints = {
            stats: './data/summary_stats.json',
            unified: './data/unified_backtest.json',
            eventType: './data/event_type_backtest.json',
            weights: './data/event_weights.json',
            holding: './data/holding_period_data.json',
            accuracy: './data/model_accuracy.json',
            navTs: './data/nav_timeseries.json',
            eventNavTs: './data/event_type_nav_timeseries.json'
        };

        const fetchResults = await Promise.all(
            Object.values(endpoints).map(url => fetch(url).then(r => r.ok ? r.json() : null))
        );

        [summaryStats, unifiedData, eventTypeData, eventWeightsData, 
         holdingPeriodData, modelAccuracyData, navTimeseriesData, eventTypeNavData] = fetchResults;

        console.log('✅ All data loaded successfully');
        
        updateTicker();
        updateHomePage();
        renderEventTypeButtons();
        
    } catch (error) {
        console.error('❌ Failed to load data:', error);
    }
}

// ------------------- Home Page Logic -------------------

function updateHomePage() {
    if (!summaryStats || !unifiedData) return;
    
    document.getElementById('total-models').textContent = summaryStats.totalModels || 0;
    document.getElementById('event-types').textContent = summaryStats.eventTypesWithData || 0;
    
    const validData = unifiedData.filter(d => d.metrics && d.metrics.arr !== undefined);
    if (validData.length > 0) {
        const bestArr = Math.max(...validData.map(d => d.metrics.arr));
        const bestSr = Math.max(...validData.map(d => d.metrics.sr));
        document.getElementById('best-arr').textContent = `${(bestArr * 100).toFixed(1)}%`;
        document.getElementById('best-sr').textContent = bestSr.toFixed(2);
    }

    renderNavChart();
    renderHomeChart();
    renderHomeRankingsTable();
    renderHomeRadarChart();
    renderHoldingPeriodChart();
}

function renderNavChart() {
    const chartDiv = document.getElementById('nav-chart');
    if (!chartDiv || !navTimeseriesData) return;
    
    const chart = echarts.init(chartDiv);
    const series = [];
    
    for (let model in navTimeseriesData.series) {
        const isJanus = model.toLowerCase().includes('janus');
        const isIndex = model.startsWith('CSI');
        series.push({
            name: model,
            type: 'line',
            data: navTimeseriesData.series[model],
            smooth: false,
            showSymbol: false,
            lineStyle: { 
                width: isJanus ? 4 : 2, 
                type: isIndex ? 'dashed' : 'solid',
                color: modelColors[model] || null
            },
            zIndex: isJanus ? 100 : (isIndex ? 1 : 10)
        });
    }

    chart.setOption({
        title: { text: 'Net Asset Value (NAV) History', left: 'center' },
        tooltip: { trigger: 'axis', confine: true },
        legend: { type: 'scroll', bottom: 10 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: navTimeseriesData.dates, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value', scale: true },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series: series
    });
}

function renderHomeChart() {
    const chartDiv = document.getElementById('home-chart');
    if (!chartDiv || !unifiedData) return;
    const chart = echarts.init(chartDiv);
    chart.setOption({
        title: { text: 'Annual Return Rate (ARR) Comparison', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: unifiedData.map(d => d.name), axisLabel: { rotate: 45 } },
        yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
        series: [{
            type: 'bar',
            data: unifiedData.map((d, i) => ({
                value: (d.metrics.arr * 100).toFixed(2),
                itemStyle: { color: modelColors[d.name] || chartColors[i % chartColors.length] }
            }))
        }]
    });
}

function renderHomeRankingsTable() {
    const tbody = document.getElementById('home-rankings-body');
    if (!tbody || !unifiedData) return;
    const sorted = [...unifiedData].sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn);
    tbody.innerHTML = sorted.map((item, idx) => {
        const isJanus = item.name.toLowerCase().includes('janus');
        return `
            <tr style="${isJanus ? 'background: rgba(245, 158, 11, 0.1); font-weight: bold;' : ''}">
                <td style="text-align:center;">${idx + 1 <= 3 ? ['🥇','🥈','🥉'][idx] : idx+1}</td>
                <td style="color:${isJanus ? '#f59e0b' : '#000'}">${item.name}</td>
                <td>${item.strategy}</td>
                <td style="text-align:right;">${(item.metrics.arr * 100).toFixed(2)}%</td>
                <td style="text-align:right;">${item.metrics.sr.toFixed(4)}</td>
                <td style="text-align:right;">${(item.metrics.mdd * 100).toFixed(2)}%</td>
                <td style="text-align:right;">${item.metrics.cr.toFixed(4)}</td>
                <td style="text-align:right; color:${item.metrics.totalReturn >= 0 ? '#ef4444' : '#10b981'};">
                    ${(item.metrics.totalReturn * 100).toFixed(2)}%
                </td>
                <td style="text-align:right; color:#666;">${item.metrics.days}</td>
            </tr>
        `;
    }).join('');
}

function renderHomeRadarChart() {
    const chartDiv = document.getElementById('home-radar-chart');
    if (!chartDiv || !unifiedData) return;
    const chart = echarts.init(chartDiv);
    const topModels = [...unifiedData].filter(m => !m.name.startsWith('CSI')).sort((a,b) => b.metrics.arr - a.metrics.arr).slice(0, 5);
    
    chart.setOption({
        title: { text: 'Top 5 Models Performance Radar', left: 'center' },
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, data: topModels.map(m => m.name) },
        radar: {
            indicator: [
                { name: 'TR (%)', max: 100 }, { name: 'SR', max: 5 }, 
                { name: 'DA (%)', max: 1 }, { name: 'ETA (%)', max: 1 }, 
                { name: 'Low MDD (%)', max: 50 }
            ]
        },
        series: [{
            type: 'radar',
            data: topModels.map(m => ({
                name: m.name,
                value: [m.metrics.totalReturn*100, m.metrics.sr, m.metrics.da||0, m.metrics.eta||0, 50-(m.metrics.mdd*100)]
            }))
        }]
    });
}

function renderHoldingPeriodChart() {
    const chartDiv = document.getElementById('holding-period-chart');
    if (!chartDiv || !holdingPeriodData) return;
    const chart = echarts.init(chartDiv);
    const metric = selectedHoldingMetric;
    const series = holdingPeriodData.models.map(m => ({
        name: m, type: 'line', data: holdingPeriodData.data[m][metric],
        symbolSize: 8, lineStyle: { width: 3 },
        itemStyle: { color: modelColors[m] || null }
    }));
    chart.setOption({
        title: { text: `Metric: ${metric} vs Holding Period`, left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0 },
        xAxis: { type: 'category', data: holdingPeriodData.holding_periods, name: 'Days' },
        yAxis: { type: 'value', scale: true },
        series: series
    });
}

// ------------------- Event Analysis Logic -------------------

function renderEventTypeButtons() {
    const container = document.getElementById('event-type-buttons');
    if (!container || !eventTypeData) return;
    const types = Object.keys(eventTypeData);
    container.innerHTML = types.map(t => `
        <button onclick="selectEventType('${t}')" 
                style="padding:0.75rem 1.5rem; border-radius:8px; border:2px solid #667eea; 
                background:${selectedEventType === t ? '#667eea' : 'white'}; 
                color:${selectedEventType === t ? 'white' : '#667eea'}; 
                font-weight:bold; cursor:pointer; transition:all 0.2s;">
            ${EVENT_TYPE_MAP[t] || t}
        </button>
    `).join('');
    if (types.length > 0 && !selectedEventType) selectEventType(types[0]);
}

function selectEventType(type) {
    selectedEventType = type;
    renderEventTypeButtons();
    renderEventTypeAnalysis();
}

function renderEventTypeAnalysis() {
    if (!eventTypeData || !selectedEventType) return;
    
    const englishName = EVENT_TYPE_MAP[selectedEventType] || selectedEventType;
    const currentTaskId = ++activeNavRenderingId; 

    const content = document.getElementById('event-content');
    if (content) {
        content.style.display = 'block';
        content.classList.remove('hidden');
    }

    document.getElementById('event-nav-title').textContent = `${englishName} - Net Asset Value (NAV) Results`;
    document.getElementById('event-title').textContent = `${englishName} - Detailed Metrics`;

    const eventData = eventTypeData[selectedEventType];
    const tableBody = document.getElementById('event-table-body');
    if (tableBody) {
        tableBody.innerHTML = eventData.map(item => `
            <tr>
                <td style="font-weight:bold;">${item.modelName}</td>
                <td style="text-align:right;">${(item.metrics.arr * 100).toFixed(2)}%</td>
                <td style="text-align:right;">${item.metrics.sr.toFixed(4)}</td>
                <td style="text-align:right;">${(item.metrics.mdd * 100).toFixed(2)}%</td>
                <td style="text-align:right;">${item.metrics.cr.toFixed(4)}</td>
                <td style="text-align:right; font-weight:bold; color:${item.metrics.totalReturn >= 0 ? '#ef4444' : '#10b981'};">
                    ${(item.metrics.totalReturn * 100).toFixed(2)}%
                </td>
                <td style="text-align:right; color:#666;">${item.metrics.days}</td>
            </tr>
        `).join('');
    }

    if (eventTypeNavData && eventTypeNavData[englishName]) {
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (currentTaskId === activeNavRenderingId) {
                    renderEventTypeNavChart(englishName, currentTaskId);
                }
            }, 100);
        });
    } else {
        document.getElementById('event-nav-chart').innerHTML = '<div style="padding:5rem; text-align:center; color:#667eea;">⏳ Loading data...</div>';
    }

    setTimeout(() => {
        if (currentTaskId === activeNavRenderingId) renderModelRankingOverview();
    }, 500);
}

function renderEventTypeNavChart(name, taskId) {
    const chartEl = document.getElementById('event-nav-chart');
    if (!chartEl) return;

    echarts.getInstanceByDom(chartEl)?.dispose();
    chartEl.innerHTML = '';

    const data = eventTypeNavData[name];
    if (!data) return;

    const chart = echarts.init(chartEl);
    const series = [];
    const indices = ['CSI 300', 'CSI 500', 'CSI 1000'];
    
    for (const [mName, values] of Object.entries(data.series)) {
        const isIndex = indices.includes(mName);
        const isJanus = mName.toLowerCase().includes('janus');
        series.push({
            name: mName, type: 'line', data: values, smooth: true, showSymbol: false,
            lineStyle: { 
                width: isJanus ? 4 : 2, 
                type: isIndex ? 'dashed' : 'solid', 
                opacity: isIndex ? 0.6 : 1,
                color: modelColors[mName] || null
            },
            zIndex: isJanus ? 100 : (isIndex ? 1 : 10)
        });
    }

    chart.setOption({
        tooltip: { trigger: 'axis', confine: true },
        legend: { type: 'scroll', bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: data.dates, axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', scale: true },
        series: series
    }, true);

    setTimeout(() => {
        if (taskId === activeNavRenderingId) chart.resize();
    }, 200);
}

// ------------------- Ranking & Weights Logic -------------------

function renderModelRankingOverview() {
    if (!eventTypeData) return;
    const modelRankings = {};
    const champions = [];
    const eventTypeKeys = Object.keys(EVENT_TYPE_MAP);

    eventTypeKeys.forEach(cnName => {
        const enName = EVENT_TYPE_MAP[cnName];
        const data = eventTypeData[cnName];
        if (!data || data.length === 0) return;
        
        const sorted = [...data].sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn);
        sorted.slice(0, 3).forEach((m, idx) => {
            if (!modelRankings[m.modelName]) modelRankings[m.modelName] = { gold: 0, silver: 0, bronze: 0 };
            if (idx === 0) {
                modelRankings[m.modelName].gold++;
                champions.push({ eventType: enName, champion: m.modelName, totalReturn: m.metrics.totalReturn });
            } else if (idx === 1) modelRankings[m.modelName].silver++;
            else if (idx === 2) modelRankings[m.modelName].bronze++;
        });
    });

    renderMedalsChart(modelRankings);
    renderChampionsChart(champions);
}

function renderMedalsChart(rankings) {
    const chartDiv = document.getElementById('ranking-medals-chart');
    if (!chartDiv) return;
    echarts.getInstanceByDom(chartDiv)?.dispose();
    const chart = echarts.init(chartDiv);
    const models = Object.keys(rankings).sort((a, b) => (rankings[b].gold*3+rankings[b].silver*2+rankings[b].bronze) - (rankings[a].gold*3+rankings[a].silver*2+rankings[a].bronze));
    chart.setOption({
        title: { text: 'Model Medal Count', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { data: models, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value' },
        legend: { data: ['Gold', 'Silver', 'Bronze'], top: 30 },
        series: [
            { name: 'Gold', type: 'bar', stack: 'm', data: models.map(m => rankings[m].gold), itemStyle: { color: '#FFD700' } },
            { name: 'Silver', type: 'bar', stack: 'm', data: models.map(m => rankings[m].silver), itemStyle: { color: '#C0C0C0' } },
            { name: 'Bronze', type: 'bar', stack: 'm', data: models.map(m => rankings[m].bronze), itemStyle: { color: '#CD7F32' } }
        ]
    });
}

function renderChampionsChart(champions) {
    const chartDiv = document.getElementById('ranking-champions-chart');
    if (!chartDiv) return;
    echarts.getInstanceByDom(chartDiv)?.dispose();
    const chart = echarts.init(chartDiv);
    chart.setOption({
        title: { text: 'Champion by Category', left: 'center' },
        tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>${p[0].marker} ${p[0].data.champion}: ${p[0].value}%` },
        xAxis: { data: champions.map(c => c.eventType), axisLabel: { rotate: 45 } },
        yAxis: { name: 'Return (%)' },
        series: [{ 
            type: 'bar', 
            data: champions.map(c => ({
                value: (c.totalReturn * 100).toFixed(2),
                champion: c.champion,
                itemStyle: { color: modelColors[c.champion] || chartColors[0] },
                label: { show: true, position: 'top', formatter: c.champion, fontSize: 10 }
            })) 
        }]
    });
}

function renderEventWeights() {
    if (!eventWeightsData) return;
    
    // Pie Chart
    const pieChart = echarts.init(document.getElementById('weights-pie-chart'));
    pieChart.setOption({ 
        title: { text: 'Historical Event Weights (Pie)', left: 'center' }, 
        tooltip: { trigger: 'item' },
        series: [{ 
            type: 'pie', 
            radius: ['40%', '70%'],
            data: eventWeightsData.map((d, i) => ({ 
                name: EVENT_TYPE_MAP[d.eventType] || d.eventType, 
                value: d.percentage,
                itemStyle: { color: chartColors[i % chartColors.length] }
            })) 
        }] 
    });

    // Bar Chart (Fixing the missing chart from Figure 1)
    const barChartDiv = document.getElementById('weights-bar-chart');
    if (barChartDiv) {
        const barChart = echarts.init(barChartDiv);
        barChart.setOption({
            title: { text: 'Event Weight Comparison (Bar)', left: 'center' },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: eventWeightsData.map(d => EVENT_TYPE_MAP[d.eventType] || d.eventType), axisLabel: { rotate: 45 } },
            yAxis: { type: 'value', name: 'Weight' },
            series: [{
                type: 'bar',
                data: eventWeightsData.map((d, i) => ({
                    value: d.weight.toFixed(4),
                    itemStyle: { color: chartColors[i % chartColors.length] }
                }))
            }]
        });
    }
    
    document.getElementById('weights-table-body').innerHTML = eventWeightsData.map(d => `
        <tr>
            <td>${EVENT_TYPE_MAP[d.eventType] || d.eventType}</td>
            <td style="text-align:right;">${d.weight.toFixed(4)}</td>
            <td style="text-align:right;">${d.normalizedWeight.toFixed(4)}</td>
            <td style="text-align:right;">${d.percentage.toFixed(2)}%</td>
        </tr>
    `).join('');
}

function updateTicker() {
    const ticker = document.getElementById('ticker-content');
    if (!ticker || !unifiedData) return;
    const content = unifiedData.map(m => `
        <span class="ticker-item">
            <strong>${m.name}:</strong> 
            <span style="color:${m.metrics.arr>=0?'#ef4444':'#10b981'}">${(m.metrics.arr*100).toFixed(2)}%</span>
        </span>
    `).join('');
    ticker.innerHTML = content + content;
}

function showPage(pageName) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${pageName}`).style.display = 'block';
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    event.target.closest('.menu-item')?.classList.add('active');
    
    if (pageName === 'home') updateHomePage();
    if (pageName === 'events') renderEventTypeAnalysis();
    if (pageName === 'weights') renderEventWeights();
}

function selectHoldingMetric(metric) {
    selectedHoldingMetric = metric;
    ['TR', 'SR', 'MDD'].forEach(m => {
        const btn = document.getElementById(`holding-${m}-btn`);
        if (btn) {
            btn.style.background = m === metric ? '#667eea' : 'white';
            btn.style.color = m === metric ? 'white' : '#667eea';
        }
    });
    renderHoldingPeriodChart();
}
