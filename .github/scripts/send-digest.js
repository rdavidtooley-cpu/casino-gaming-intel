#!/usr/bin/env node
/**
 * Casino Gaming Intel — Email Digest Sender
 * Builds styled HTML emails from dashboard data and sends via Resend.
 * Usage: node send-digest.js [daily|weekly]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://casino-gaming-intel.pages.dev';
const API_SECRET = process.env.API_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Casino Gaming Intel <casino@sector-intel.com>';
const FREQUENCY = process.argv[2] || 'daily';

if (!API_SECRET || !RESEND_API_KEY) {
    console.error('Missing API_SECRET or RESEND_API_KEY');
    process.exit(1);
}

// ─── Ticker Universe ───
const SECTORS = {
    'Integrated Resorts': { color: '#ffd700', tickers: ['MGM', 'CZR', 'WYNN', 'LVS', 'MLCO'] },
    'Regional Operators': { color: '#4fc3f7', tickers: ['PENN', 'BYD', 'RRR', 'CHDN', 'MCRI', 'GDEN', 'FLL', 'BALY'] },
    'Online & iGaming':   { color: '#81c784', tickers: ['DKNG', 'FLUT', 'RSI', 'SRAD', 'SGHC', 'GENI', 'BRSL'] },
    'Gaming Equipment':   { color: '#ba68c8', tickers: ['LNW', 'ACEL', 'INSE', 'ARLUF', 'KNAMF'] }
};
const ALL_TICKERS = Object.values(SECTORS).flatMap(s => s.tickers);

// ─── Fetch helpers ───
function fetchJSON(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = { hostname: u.hostname, path: u.pathname + u.search, headers };
        https.get(opts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error(`Invalid JSON from ${url}`)); }
            });
        }).on('error', reject);
    });
}

function sendEmail(to, subject, html) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html });
        const opts = {
            hostname: 'api.resend.com', path: '/emails', method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(opts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Shared styles & helpers ───
const CARD = 'background:#1a1d29;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:20px;margin-bottom:16px;';
const SECTION_TITLE = 'font-size:14px;font-weight:600;color:#e8eaed;margin-bottom:12px;';
const LABEL = 'padding:8px 0;color:#9aa0a6;font-size:12px;';
const VALUE = 'padding:8px 0;text-align:right;color:#e8eaed;font-weight:600;';
const TH = 'padding:8px 12px;text-align:left;color:#9aa0a6;font-size:11px;text-transform:uppercase;';
const TD = 'padding:8px 12px;border-bottom:1px solid #2a2d3a;';

function fmtNum(n) {
    if (n == null || isNaN(n)) return '\u2014';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function chgColor(v) {
    if (v > 0) return '#4caf50';
    if (v < 0) return '#f44336';
    return '#9e9e9e';
}

function fmtChg(v, decimals = 2) {
    if (v == null || isNaN(v)) return '\u2014';
    return (v > 0 ? '+' : '') + Number(v).toFixed(decimals) + '%';
}

function fmtPrice(val) {
    if (val == null) return 'N/A';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSectorForTicker(ticker) {
    for (const [name, info] of Object.entries(SECTORS)) {
        if (info.tickers.includes(ticker)) return { name, color: info.color };
    }
    return { name: 'Other', color: '#9aa0a6' };
}

function header(title, subtitle) {
    return `<div style="background:linear-gradient(135deg,#5c4a00,#8b7000,#ffd700);border-radius:10px;padding:20px 24px;margin-bottom:20px;">
    <div style="font-size:20px;font-weight:700;color:#fff;">Casino Gaming Intel</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">${title} \u2014 ${subtitle}</div>
</div>`;
}

function footer() {
    return `<div style="text-align:center;padding:16px 0;">
    <a href="${SITE_URL}" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#5c4a00,#8b7000,#ffd700);color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Full Dashboard</a>
</div>
<div style="text-align:center;padding:20px 0;color:#666;font-size:11px;">
    <p>Casino Gaming Intel \u2014 Gaming Sector Intelligence</p>
    <p><a href="${SITE_URL}/api/unsubscribe?email={{EMAIL}}" style="color:#888;text-decoration:underline;">Unsubscribe</a></p>
</div>`;
}

function wrap(content) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
${content}
</div></body></html>`;
}

// ─── Daily Email ───
function buildDailyEmail(companies, indexData) {
    const totalMcap = companies.reduce((s, c) => s + (c.market_cap || 0), 0);
    const avgChange = companies.reduce((s, c) => s + (c.daily_change || 0), 0) / companies.length;
    const advancing = companies.filter(c => (c.daily_change || 0) > 0).length;
    const declining = companies.filter(c => (c.daily_change || 0) < 0).length;
    const movers = [...companies].sort((a, b) => Math.abs(b.daily_change || 0) - Math.abs(a.daily_change || 0)).slice(0, 10);

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Gaming-25 Index section
    let indexSection = '';
    if (indexData && indexData.current_value != null) {
        const idxVal = indexData.current_value;
        const idxChg = indexData.daily_change || 0;
        indexSection = `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Gaming-25 Index</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${LABEL}">Index Value</td><td style="${VALUE}color:#ffd700;font-size:18px;">${Number(idxVal).toFixed(2)}</td></tr>
        <tr><td style="${LABEL}">Daily Change</td><td style="${VALUE}color:${chgColor(idxChg)};">${fmtChg(idxChg)}</td></tr>
    </table>
</div>`;
    }

    // Sector performance
    let sectorRows = '';
    for (const [sectorName, sectorInfo] of Object.entries(SECTORS)) {
        const sectorCompanies = companies.filter(c => sectorInfo.tickers.includes(c.ticker));
        if (!sectorCompanies.length) continue;
        const sectorAvg = sectorCompanies.reduce((s, c) => s + (c.daily_change || 0), 0) / sectorCompanies.length;
        sectorRows += `<tr>
            <td style="${TD}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sectorInfo.color};margin-right:6px;"></span>${sectorName}</td>
            <td style="${TD}text-align:center;color:#9aa0a6;">${sectorCompanies.length}</td>
            <td style="${TD}text-align:right;color:${chgColor(sectorAvg)};font-weight:600;">${fmtChg(sectorAvg)}</td>
        </tr>`;
    }

    const sectorSection = sectorRows ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Sector Performance</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Sector</th><th style="${TH}text-align:center;">Companies</th><th style="${TH}text-align:right;">Avg Change</th>
        </tr>
        ${sectorRows}
    </table>
</div>` : '';

    const moverRows = movers.map(c => {
        const sector = getSectorForTicker(c.ticker);
        return `<tr>
        <td style="${TD}font-weight:700;color:${sector.color};">${c.ticker}</td>
        <td style="${TD}color:#9aa0a6;font-size:12px;">${(c.company || c.name || '').substring(0, 30)}</td>
        <td style="${TD}text-align:right;">${fmtPrice(c.price)}</td>
        <td style="${TD}text-align:right;color:${chgColor(c.daily_change)};font-weight:600;">${fmtChg(c.daily_change)}</td>
    </tr>`;
    }).join('');

    return wrap(`
${header('Daily Market Digest', dateStr)}
${indexSection}
<div style="${CARD}">
    <div style="${SECTION_TITLE}">Sector Pulse</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${LABEL}">Total Market Cap</td><td style="${VALUE}">$${fmtNum(totalMcap)}</td></tr>
        <tr><td style="${LABEL}">Avg Daily Change</td><td style="${VALUE}color:${chgColor(avgChange)};">${fmtChg(avgChange)}</td></tr>
        <tr><td style="${LABEL}">Advancing / Declining</td><td style="${VALUE}">${advancing} / ${declining}</td></tr>
        <tr><td style="${LABEL}">Companies Tracked</td><td style="${VALUE}">${companies.length}</td></tr>
    </table>
</div>
${sectorSection}
<div style="${CARD}">
    <div style="${SECTION_TITLE}">Top Movers</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Ticker</th><th style="${TH}">Company</th>
            <th style="${TH}text-align:right;">Price</th><th style="${TH}text-align:right;">Change</th>
        </tr>
        ${moverRows}
    </table>
</div>
${footer()}
    `);
}

// ─── Weekly Email ───
function buildWeeklyEmail(companies, digest) {
    const totalMcap = companies.reduce((s, c) => s + (c.market_cap || 0), 0);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // ── Section 1: Weekly Market Overview ──
    const with5d = companies.filter(c => c.change_5d != null);
    const avg5d = with5d.length ? with5d.reduce((s, c) => s + c.change_5d, 0) / with5d.length : 0;
    const weekAdv = with5d.filter(c => c.change_5d > 0).length;
    const weekDec = with5d.filter(c => c.change_5d < 0).length;

    const overviewSection = `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Weekly Market Overview</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${LABEL}">Total Sector Market Cap</td><td style="${VALUE}">$${fmtNum(totalMcap)}</td></tr>
        <tr><td style="${LABEL}">Avg Weekly Change</td><td style="${VALUE}color:${chgColor(avg5d)};">${fmtChg(avg5d)}</td></tr>
        <tr><td style="${LABEL}">Weekly Advancing / Declining</td><td style="${VALUE}">${weekAdv} / ${weekDec}</td></tr>
        <tr><td style="${LABEL}">Companies Tracked</td><td style="${VALUE}">${companies.length}</td></tr>
    </table>
</div>`;

    // ── Section 2: Gaming-25 Index Weekly ──
    let indexSection = '';
    const idxData = digest.index_data || {};
    if (idxData.current_value != null) {
        indexSection = `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Gaming-25 Index</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${LABEL}">Current Value</td><td style="${VALUE}color:#ffd700;font-size:18px;">${Number(idxData.current_value).toFixed(2)}</td></tr>
        <tr><td style="${LABEL}">Weekly Change</td><td style="${VALUE}color:${chgColor(idxData.weekly_change)};">${fmtChg(idxData.weekly_change)}</td></tr>
        <tr><td style="${LABEL}">YTD Change</td><td style="${VALUE}color:${chgColor(idxData.ytd_change)};">${fmtChg(idxData.ytd_change)}</td></tr>
    </table>
</div>`;
    }

    // ── Section 3: Sector Performance ──
    let sectorRows = '';
    for (const [sectorName, sectorInfo] of Object.entries(SECTORS)) {
        const sectorCompanies = companies.filter(c => sectorInfo.tickers.includes(c.ticker));
        if (!sectorCompanies.length) continue;
        const with5dSector = sectorCompanies.filter(c => c.change_5d != null);
        const sectorAvg5d = with5dSector.length ? with5dSector.reduce((s, c) => s + c.change_5d, 0) / with5dSector.length : 0;
        sectorRows += `<tr>
            <td style="${TD}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sectorInfo.color};margin-right:6px;"></span>${sectorName}</td>
            <td style="${TD}text-align:center;color:#9aa0a6;">${sectorCompanies.length}</td>
            <td style="${TD}text-align:right;color:${chgColor(sectorAvg5d)};font-weight:600;">${fmtChg(sectorAvg5d)}</td>
        </tr>`;
    }

    const sectorSection = sectorRows ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Sector Performance</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Sector</th><th style="${TH}text-align:center;">Companies</th><th style="${TH}text-align:right;">Avg Weekly</th>
        </tr>
        ${sectorRows}
    </table>
</div>` : '';

    // ── Section 4: Weekly Top Gainers ──
    const gainers = (digest.weekly_gainers || []).slice(0, 5);
    const gainerRows = gainers.map(c => {
        const sector = getSectorForTicker(c.ticker);
        return `<tr>
        <td style="${TD}font-weight:700;color:${sector.color};">${c.ticker}</td>
        <td style="${TD}color:#9aa0a6;font-size:12px;">${(c.company || c.name || '').substring(0, 25)}</td>
        <td style="${TD}text-align:right;">${fmtPrice(c.price)}</td>
        <td style="${TD}text-align:right;color:#4caf50;font-weight:600;">${fmtChg(c.change_5d)}</td>
    </tr>`;
    }).join('');

    // ── Section 5: Weekly Top Losers ──
    const losers = (digest.weekly_losers || []).slice(0, 5);
    const loserRows = losers.map(c => {
        const sector = getSectorForTicker(c.ticker);
        return `<tr>
        <td style="${TD}font-weight:700;color:${sector.color};">${c.ticker}</td>
        <td style="${TD}color:#9aa0a6;font-size:12px;">${(c.company || c.name || '').substring(0, 25)}</td>
        <td style="${TD}text-align:right;">${fmtPrice(c.price)}</td>
        <td style="${TD}text-align:right;color:#f44336;font-weight:600;">${fmtChg(c.change_5d)}</td>
    </tr>`;
    }).join('');

    const moversSection = (gainerRows || loserRows) ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Weekly Top Gainers</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Ticker</th><th style="${TH}">Company</th>
            <th style="${TH}text-align:right;">Price</th><th style="${TH}text-align:right;">5D Chg</th>
        </tr>
        ${gainerRows}
    </table>
</div>
<div style="${CARD}">
    <div style="${SECTION_TITLE}">Weekly Top Losers</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Ticker</th><th style="${TH}">Company</th>
            <th style="${TH}text-align:right;">Price</th><th style="${TH}text-align:right;">5D Chg</th>
        </tr>
        ${loserRows}
    </table>
</div>` : '';

    // ── Section 6: Industry Indicators ──
    const indicators = digest.industry_indicators || {};
    let indicatorRows = '';
    const indicatorItems = [
        { label: 'US Gaming Revenue (monthly)', key: 'us_gaming_revenue' },
        { label: 'Las Vegas Strip RevPAR', key: 'lvs_revpar' },
        { label: 'Online GGR Growth', key: 'online_ggr_growth' },
        { label: 'Sports Betting Handle', key: 'sports_betting_handle' }
    ];
    for (const item of indicatorItems) {
        const val = indicators[item.key];
        if (!val) continue;
        indicatorRows += `<tr>
            <td style="${TD}color:#e8eaed;">${item.label}</td>
            <td style="${TD}text-align:right;color:#e8eaed;font-weight:600;">${val.display || val.value || '\u2014'}</td>
            <td style="${TD}text-align:right;color:${chgColor(val.change)};font-size:12px;">${val.change != null ? fmtChg(val.change) : '\u2014'}</td>
        </tr>`;
    }

    const indicatorSection = indicatorRows ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Industry Indicators</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Indicator</th><th style="${TH}text-align:right;">Value</th><th style="${TH}text-align:right;">Change</th>
        </tr>
        ${indicatorRows}
    </table>
</div>` : '';

    // ── Section 7: Analyst Activity ──
    const aa = digest.analyst_summary || {};
    const analystSection = aa.total ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Analyst Activity (30D)</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr>
            <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#4caf50;">${aa.upgrades}</div><div style="font-size:11px;color:#9aa0a6;margin-top:2px;">Upgrades</div></td>
            <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#f44336;">${aa.downgrades}</div><div style="font-size:11px;color:#9aa0a6;margin-top:2px;">Downgrades</div></td>
            <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#63b3ed;">${aa.initiations}</div><div style="font-size:11px;color:#9aa0a6;margin-top:2px;">Initiations</div></td>
            <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#e8eaed;">${aa.total}</div><div style="font-size:11px;color:#9aa0a6;margin-top:2px;">Total</div></td>
        </tr>
    </table>
</div>` : '';

    // ── Section 8: Top Headlines ──
    const headlines = (digest.top_headlines || []).slice(0, 5);
    const headlineItems = headlines.map(h => {
        const dateShort = h.date ? new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const tickers = (h.tickers || []).slice(0, 3).join(', ');
        return `<div style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
            <div style="font-size:13px;color:#e8eaed;font-weight:500;">${(h.title || '').substring(0, 80)}</div>
            <div style="font-size:11px;color:#9aa0a6;margin-top:4px;">${h.source || ''} \u00B7 ${dateShort}${tickers ? ' \u00B7 ' + tickers : ''}</div>
        </div>`;
    }).join('');

    const headlinesSection = headlineItems ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Top Headlines</div>
    ${headlineItems}
</div>` : '';

    // ── Section 9: Upcoming Earnings ──
    const upcoming = (digest.upcoming_earnings || []).slice(0, 8);
    const earningsItems = upcoming.map(e => {
        const dt = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const sector = getSectorForTicker(e.ticker);
        return `<tr>
            <td style="${TD}font-weight:700;color:${sector.color};">${e.ticker}</td>
            <td style="${TD}color:#9aa0a6;font-size:12px;">${(e.company || '').substring(0, 30)}</td>
            <td style="${TD}text-align:right;color:#63b3ed;">${dt}</td>
        </tr>`;
    }).join('');

    const earningsSection = earningsItems ? `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Upcoming Earnings This Week</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e8eaed;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="${TH}">Ticker</th><th style="${TH}">Company</th><th style="${TH}text-align:right;">Date</th>
        </tr>
        ${earningsItems}
    </table>
</div>` : '';

    // ── Section 10: Valuation Snapshot ──
    const pes = companies.map(c => c.pe_ratio).filter(v => v && v > 0 && v < 200);
    const evs = companies.map(c => c.ev_ebitda).filter(v => v && v > 0 && v < 100);
    const divs = companies.map(c => c.dividend_yield).filter(v => v && v > 0);
    const medPE = pes.sort((a, b) => a - b)[Math.floor(pes.length / 2)] || 0;
    const medEV = evs.sort((a, b) => a - b)[Math.floor(evs.length / 2)] || 0;
    const medDiv = divs.sort((a, b) => a - b)[Math.floor(divs.length / 2)] || 0;

    const valuationSection = `<div style="${CARD}">
    <div style="${SECTION_TITLE}">Valuation Snapshot</div>
    <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${LABEL}">Median P/E Ratio</td><td style="${VALUE}">${medPE.toFixed(1)}x</td></tr>
        <tr><td style="${LABEL}">Median EV/EBITDA</td><td style="${VALUE}">${medEV.toFixed(1)}x</td></tr>
        <tr><td style="${LABEL}">Median Dividend Yield</td><td style="${VALUE}">${medDiv.toFixed(2)}%</td></tr>
    </table>
</div>`;

    return wrap(`
${header('Weekly Intelligence Digest', 'Week of ' + dateStr)}
${overviewSection}
${indexSection}
${sectorSection}
${moversSection}
${indicatorSection}
${analystSection}
${headlinesSection}
${earningsSection}
${valuationSection}
${footer()}
    `);
}

// ─── Main ───
async function main() {
    console.log(`Sending ${FREQUENCY} digest...`);

    // 1. Get subscribers
    const subsData = await fetchJSON(`${SITE_URL}/api/subscribers?frequency=${FREQUENCY}&key=${API_SECRET}`);
    if (!subsData.subscribers || subsData.count === 0) {
        console.log('No subscribers for', FREQUENCY);
        return;
    }
    console.log(`Found ${subsData.count} ${FREQUENCY} subscriber(s)`);

    // 2. Load market data (local file in CI, or fetch from site)
    let companies;
    const mdPath = path.join(__dirname, '../../market_data.json');
    if (fs.existsSync(mdPath)) {
        const raw = JSON.parse(fs.readFileSync(mdPath, 'utf-8'));
        companies = Array.isArray(raw) ? raw : Object.values(raw);
    } else {
        const raw = await fetchJSON(`${SITE_URL}/market_data.json`);
        companies = Array.isArray(raw) ? raw : Object.values(raw);
    }
    console.log(`Loaded ${companies.length} companies`);

    // 3. Load Gaming-25 index data
    let indexData = {};
    const idxPath = path.join(__dirname, '../../gaming25_index.json');
    if (fs.existsSync(idxPath)) {
        indexData = JSON.parse(fs.readFileSync(idxPath, 'utf-8'));
        console.log('Loaded gaming25_index.json (local)');
    } else {
        try {
            indexData = await fetchJSON(`${SITE_URL}/gaming25_index.json`);
            console.log('Loaded gaming25_index.json (remote)');
        } catch {
            console.log('No gaming25_index.json available');
        }
    }

    // 4. Load digest data for weekly emails
    let digest = {};
    if (FREQUENCY === 'weekly') {
        const digestPath = path.join(__dirname, '../../digest_data.json');
        if (fs.existsSync(digestPath)) {
            digest = JSON.parse(fs.readFileSync(digestPath, 'utf-8'));
            console.log('Loaded digest_data.json (local)');
        } else {
            try {
                digest = await fetchJSON(`${SITE_URL}/digest_data.json`);
                console.log('Loaded digest_data.json (remote)');
            } catch {
                console.log('No digest_data.json available, using market data only');
            }
        }
        // Merge index data into digest
        if (indexData && indexData.current_value != null) {
            digest.index_data = indexData;
        }

        // Auto-generate weekly gainers/losers from market data if not in digest
        if (!digest.weekly_gainers) {
            const with5d = companies.filter(c => c.change_5d != null);
            digest.weekly_gainers = [...with5d].sort((a, b) => (b.change_5d || 0) - (a.change_5d || 0)).slice(0, 5);
        }
        if (!digest.weekly_losers) {
            const with5d = companies.filter(c => c.change_5d != null);
            digest.weekly_losers = [...with5d].sort((a, b) => (a.change_5d || 0) - (b.change_5d || 0)).slice(0, 5);
        }
    }

    // 5. Build email
    const html = FREQUENCY === 'weekly' ? buildWeeklyEmail(companies, digest) : buildDailyEmail(companies, indexData);
    const subject = FREQUENCY === 'weekly'
        ? `Casino Gaming Intel \u2014 Weekly Digest (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
        : `Casino Gaming Intel \u2014 Daily Digest (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

    // 6. Send to each subscriber
    let sent = 0, failed = 0;
    for (const sub of subsData.subscribers) {
        const personalizedHtml = html.replace(/\{\{EMAIL\}\}/g, encodeURIComponent(sub.email));
        try {
            const result = await sendEmail(sub.email, subject, personalizedHtml);
            if (result.status >= 200 && result.status < 300) {
                sent++;
                console.log(`  Sent to ${sub.email}`);
            } else {
                failed++;
                console.error(`  Failed ${sub.email}: ${result.data}`);
            }
        } catch (err) {
            failed++;
            console.error(`  Error ${sub.email}: ${err.message}`);
        }
        await sleep(200); // Rate limit
    }

    console.log(`Done: ${sent} sent, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
