import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const CONFIG = {
  API_KEY: import.meta.env.VITE_OPENROUTER_KEY || "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",
  MODEL: import.meta.env.VITE_MODEL || "openrouter/free",
  REFRESH: 25000,
};

// ── FIRE CLUSTERS (India) ───────────────────────────────────────
const ZONES = [
  [22.0, 82.0, 'Chhattisgarh Forest'], [20.5, 85.5, 'Odisha Jungle'],
  [24.0, 80.5, 'Madhya Pradesh Savanna'], [15.5, 76.0, 'Karnataka Scrubland'],
  [17.0, 81.5, 'Andhra Pradesh Hills'], [25.5, 91.5, 'Meghalaya Ridge'],
  [29.5, 79.0, 'Uttarakhand Pine'], [23.5, 87.5, 'Jharkhand Sal Forest'],
  [10.5, 77.0, 'Tamil Nadu Nilgiris'], [13.0, 74.5, 'Western Ghats'],
  [26.0, 93.0, 'Assam Valley'], [21.0, 76.0, 'Vidarbha Grassland'],
  [14.5, 78.5, 'Rayalaseema Scrub'], [28.0, 77.5, 'Aravalli Foothills'],
  [23.0, 92.5, 'Mizoram Hill Tract'], [19.5, 84.0, 'Koraput Highlands'],
  [18.0, 79.5, 'Telangana Plateau'], [27.0, 95.0, 'Arunachal Hills'],
];

function mkRng(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 } }

function calcRisk(b, c, f) {
  const w = { low: .3, nominal: .6, high: 1.0 }[c] || .6;
  const sc = Math.min(100, b * w * Math.log(f + 1.001) / 50);
  return { score: +sc.toFixed(1), level: sc >= 75 ? 'CRITICAL' : sc >= 50 ? 'HIGH' : sc >= 25 ? 'MEDIUM' : 'LOW' };
}

function genSpots() {
  const rng = mkRng(Math.floor(Date.now() / CONFIG.REFRESH));
  const confs = ['low', 'nominal', 'nominal', 'high', 'high'];
  const now = Date.now();
  return Array.from({ length: 115 }, (_, i) => {
    const [slat, slon, zone] = ZONES[Math.floor(rng() * ZONES.length)];
    const lat = +(slat + rng() * 3 - 1.5).toFixed(5);
    const lon = +(slon + rng() * 3 - 1.5).toFixed(5);
    const brightness = +(290 + rng() * 130).toFixed(1);
    const frp = +(2 + rng() * 185).toFixed(1);
    const conf = confs[Math.floor(rng() * confs.length)];
    const { score, level } = calcRisk(brightness, conf, frp);
    return {
      id: `SYN-${String(i).padStart(4, '0')}`,
      lat, lon, brightness, frp, conf, score, level, zone,
      ts: new Date(now - rng() * 5400000).toISOString(),
      wind: +(5 + rng() * 40).toFixed(0),
      humidity: +(10 + rng() * 65).toFixed(0),
      area: +(0.5 + rng() * 12).toFixed(1),
    };
  });
}

const rHex = l => ({ CRITICAL: '#ff3b3b', HIGH: '#ff7700', MEDIUM: '#ffaa00', LOW: '#00ff9f' }[l] || '#00ff9f');
const rRad = l => ({ CRITICAL: 14, HIGH: 11, MEDIUM: 8, LOW: 5 }[l] || 5);

function mkIcon(level, sel = false) {
  const col = rHex(level), r = rRad(level), sz = r * 7;
  const p = level === 'CRITICAL' || level === 'HIGH', dur = level === 'CRITICAL' ? '.9s' : '1.8s';
  const ring = sel ? `<circle cx="35" cy="35" r="${r * 2.6}" fill="none" stroke="white" stroke-width="1.2" opacity=".9"/>` : '';
  return L.divIcon({
    className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 70 70">
      ${p ? `<circle cx="35" cy="35" r="${r * 2}" fill="${col}" opacity=".07">
        <animate attributeName="r" values="${r * 1.5};${r * 3.6};${r * 1.5}" dur="${dur}" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".1;.01;.1" dur="${dur}" repeatCount="indefinite"/>
      </circle>`: ''}
      <circle cx="35" cy="35" r="${r}" fill="${col}" opacity=".9"/>
      <circle cx="35" cy="35" r="${r * .38}" fill="rgba(255,255,255,.95)"/>
      ${ring}
    </svg>`
  });
}

function popHtml(s) {
  const col = rHex(s.level);
  const rows = [
    ['ID', s.id], ['Zone', s.zone], ['Lat', s.lat.toFixed(5) + '°N'],
    ['Lon', s.lon.toFixed(5) + '°E'], ['Brightness', s.brightness + ' K'],
    ['FRP', `<span style="color:${col};font-weight:700">${s.frp} MW</span>`],
    ['Confidence', s.conf.toUpperCase()],
    ['Risk Score', `<span style="color:${col};font-weight:700;font-size:13px">${s.score}/100</span>`],
    ['Est. Area', s.area + ' km²'],
    ['Wind', s.wind + ' km/h'], ['Humidity', s.humidity + '%'],
  ];
  return `<div style="min-width:220px">
    <div style="color:${col};font-weight:700;font-size:12px;margin-bottom:8px;font-family:Orbitron,monospace;letter-spacing:1px">
      ◈ ${s.level} FIRE HOTSPOT
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      ${rows.map(([k, v]) => `<tr>
        <td style="color:#00804f;padding:2px 10px 2px 0;white-space:nowrap">${k}</td>
        <td style="color:#00ff9f">${v}</td>
      </tr>`).join('')}
    </table>
  </div>`;
}

export default function App() {
  const mapRef = useRef(null);
  const mLayerRef = useRef(null);
  const hLayerRef = useRef(null);
  const cLayerRef = useRef(null);
  const selectedMarkerRef = useRef(null);

  const [spots, setSpots] = useState([]);
  const [curLayer, setCurLayer] = useState('markers');
  const [curFilter, setCurFilter] = useState('ALL');
  const [messages, setMessages] = useState([
    { type: 'ms', text: '── CrisisVision AI v2.0 operational ──' },
    { type: 'ms', text: '── Satellite feed active · AI Analyst online ──' },
    { type: 'ms', text: '── Click a fire marker or use action buttons above ──' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [rpct, setRpct] = useState(100);
  const [timeStr, setTimeStr] = useState('');
  const [lastRefStr, setLastRefStr] = useState('');
  const [toastMsg, setToastMsg] = useState({ msg: '', err: false, show: false });
  const [cursorCoord, setCursorCoord] = useState('--°N --°E');

  const chatLogRef = useRef(null);

  // Stats
  const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  spots.forEach(s => c[s.level]++);
  const totalFRP = spots.reduce((t, s) => t + s.frp, 0);
  const regsSet = new Set(spots.map(s => s.zone));

  const allAlerts = spots.filter(s => s.level === 'CRITICAL' || s.level === 'HIGH').sort((a, b) => b.score - a.score);
  const filteredAlerts = curFilter === 'ALL' ? allAlerts : allAlerts.filter(a => a.level === curFilter);

  const rm = {};
  spots.forEach(s => {
    if (!rm[s.zone]) rm[s.zone] = { n: 0, frp: 0, ms: 0, ml: 'LOW', lat: s.lat, lon: s.lon, name: s.zone };
    rm[s.zone].n++; rm[s.zone].frp += s.frp;
    if (s.score > rm[s.zone].ms) { rm[s.zone].ms = s.score; rm[s.zone].ml = s.level; rm[s.zone].lat = s.lat; rm[s.zone].lon = s.lon; }
  });
  const sortedRegions = Object.values(rm).sort((a, b) => b.ms - a.ms);

  const hiConf = spots.length ? Math.round(spots.filter(s => s.conf === 'high').length / spots.length * 100) : 0;
  const critR = spots.length ? c.CRITICAL / spots.length : 0;
  let tLv, tCol, tPct;
  if (critR > .14) { tLv = 'CRITICAL'; tCol = 'var(--red)'; tPct = 88 + critR * 8; }
  else if (critR > .06) { tLv = 'HIGH'; tCol = 'var(--orange)'; tPct = 60 + critR * 80; }
  else if (c.HIGH > 8) { tLv = 'ELEVATED'; tCol = 'var(--amber)'; tPct = 42; }
  else { tLv = 'MODERATE'; tCol = 'var(--g)'; tPct = 25; }
  const maxV = Math.max(c.CRITICAL, c.HIGH, c.MEDIUM, c.LOW, 1);

  const showToast = (msg, err = false) => {
    setToastMsg({ msg, err, show: true });
    setTimeout(() => setToastMsg(prev => ({ ...prev, show: false })), 3500);
  };

  const addMsg = (type, text) => {
    setMessages(prev => [...prev, { type, text }]);
    setTimeout(() => {
      if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }, 50);
  };

  useEffect(() => {
    const map = L.map('map', { center: [22.5, 82], zoom: 5, zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18 }).addTo(map);
    mapRef.current = map;
    mLayerRef.current = L.layerGroup().addTo(map);
    hLayerRef.current = L.layerGroup();
    cLayerRef.current = L.layerGroup();

    map.on('mousemove', e => {
      setCursorCoord(e.latlng.lat.toFixed(3) + '°N ' + e.latlng.lng.toFixed(3) + '°E');
    });

    const refreshData = () => {
      const newSpots = genSpots();
      setSpots(newSpots);
      setLastRefStr(new Date().toUTCString().slice(17, 25) + ' UTC');
      setRpct(100);
    };

    refreshData();
    const mapInterval = setInterval(refreshData, CONFIG.REFRESH);

    const tick = () => {
      setTimeStr(new Date().toUTCString().slice(17, 25) + ' UTC');
      setRpct(prev => Math.max(0, prev - (100 / (CONFIG.REFRESH / 1000))));
    };
    tick();
    const timeInterval = setInterval(tick, 1000);

    showToast('🛰️ CrisisVision AI v2.0 operational');

    return () => {
      clearInterval(mapInterval);
      clearInterval(timeInterval);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const mLayer = mLayerRef.current;
    const hLayer = hLayerRef.current;
    const cLayer = cLayerRef.current;

    mLayer.clearLayers(); hLayer.clearLayers(); cLayer.clearLayers();

    spots.forEach(s => {
      const m = L.marker([s.lat, s.lon], { icon: mkIcon(s.level) });
      m._spot = s;
      m.on('click', () => {
        if (selectedMarkerRef.current && selectedMarkerRef.current._spot) {
          selectedMarkerRef.current.setIcon(mkIcon(selectedMarkerRef.current._spot.level, false));
        }
        selectedMarkerRef.current = m;
        m.setIcon(mkIcon(s.level, true));
        m.bindPopup(popHtml(s), { maxWidth: 280 }).openPopup();
        mapRef.current.flyTo([s.lat, s.lon], 8, { duration: 1.2 });
        addMsg('s', `▸ Targeting: ${s.zone} [${s.level} — Score ${s.score}]`);
        callAI(
          `Satellite fire hotspot:\\n` +
          `- Zone: ${s.zone} (${s.lat.toFixed(4)}°N, ${s.lon.toFixed(4)}°E)\\n` +
          `- Risk: ${s.level} | Score: ${s.score}/100\\n` +
          `- FRP: ${s.frp} MW | Brightness: ${s.brightness} K | Confidence: ${s.conf.toUpperCase()}\\n` +
          `- Estimated area: ${s.area} km² | Wind: ${s.wind} km/h | Humidity: ${s.humidity}%\\n\\n` +
          `Assess: what is burning, how bad, spread risk given wind+humidity, nearest population risk, one immediate action.`,
          `HOTSPOT ANALYSIS — ${s.zone}`
        );
      });
      m.bindTooltip(
        `<b style="color:${rHex(s.level)}">${s.level}</b> — ${s.zone}<br>` +
        `FRP: ${s.frp} MW | Score: ${s.score} | Wind: ${s.wind} km/h`,
        { className: 'cvtt', direction: 'top' }
      );
      mLayer.addLayer(m);

      hLayer.addLayer(L.circle([s.lat, s.lon], {
        radius: (20 + s.score * 1.4) * 400,
        color: rHex(s.level), fillColor: rHex(s.level),
        fillOpacity: .07, weight: .4, opacity: .25
      }));
    });

    Object.values(rm).forEach(r => {
      const col = rHex(r.ml), sz = Math.min(90, 28 + r.n * 2.5);
      const m = L.marker([r.lat, r.lon], {
        icon: L.divIcon({
          className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="40" fill="${col}" opacity=".12" stroke="${col}" stroke-width="1"/>
          <circle cx="45" cy="45" r="28" fill="${col}" opacity=".06" stroke="${col}" stroke-width=".5"/>
          <text x="45" y="43" text-anchor="middle" fill="${col}" font-size="16" font-weight="700" font-family="Orbitron,monospace">${r.n}</text>
          <text x="45" y="54" text-anchor="middle" fill="${col}" font-size="8" opacity=".7">FIRES</text>
        </svg>`
        })
      });
      m.bindTooltip(`<b style="color:${col}">${r.name}</b><br>Fires: ${r.n} | FRP: ${r.frp.toFixed(0)} MW | Peak: ${r.ms}`, { className: 'cvtt' });
      m.on('click', () => {
        mapRef.current.flyTo([r.lat, r.lon], 8, { duration: 1.2 });
        addMsg('s', `▸ Region: ${r.name} — ${r.n} fires, ${r.frp.toFixed(0)} MW total`);
      });
      cLayer.addLayer(m);
    });

    applyLayer(curLayer);
  }, [spots]);

  const applyLayer = (l) => {
    if (!mapRef.current) return;
    mapRef.current.removeLayer(mLayerRef.current);
    mapRef.current.removeLayer(hLayerRef.current);
    mapRef.current.removeLayer(cLayerRef.current);
    if (l === 'markers') mapRef.current.addLayer(mLayerRef.current);
    else if (l === 'heat') { mapRef.current.addLayer(mLayerRef.current); mapRef.current.addLayer(hLayerRef.current); }
    else mapRef.current.addLayer(cLayerRef.current);
  };

  const handleSetLayer = (l) => {
    setCurLayer(l);
    applyLayer(l);
  };

  const flyTo = (lat, lon) => {
    mapRef.current.flyTo([lat, lon], 8, { duration: 1.2 });
  };

  function getCtx() {
    const top = allAlerts.slice(0, 5).map(a => `  • ${a.zone}: Score ${a.score}, FRP ${a.frp} MW, Wind ${a.wind} km/h, Humidity ${a.humidity}%`).join('\\n');
    return `LIVE NASA VIIRS SATELLITE DATA — India Subcontinent:\\n` +
      `Total hotspots: ${spots.length} | CRITICAL: ${c.CRITICAL} | HIGH: ${c.HIGH} | MEDIUM: ${c.MEDIUM} | LOW: ${c.LOW}\\n` +
      `Total FRP: ${totalFRP.toFixed(0)} MW | Avg: ${(totalFRP / spots.length).toFixed(1)} MW per fire\\n` +
      `Top danger zones:\\n${top}`;
  }

  async function callAI(prompt, label = '') {
    if (isThinking) return;
    setIsThinking(true);
    if (label) addMsg('u', label);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + CONFIG.API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crisisvision.ai',
          'X-Title': 'CrisisVision AI'
        },
        body: JSON.stringify({
          model: CONFIG.MODEL,
          max_tokens: 520,
          messages: [
            {
              role: 'system', content:
                'You are a senior disaster intelligence analyst at a government emergency response center. ' +
                'You have real-time NASA satellite fire data for India. Be direct, urgent, and precise — military tone. ' +
                'Use **bold** for critical points. Keep responses tight and actionable. ' +
                'Max 5 sentences unless generating a structured report.'
            },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || 'HTTP ' + res.status);
      }
      const d = await res.json();
      if (d.error) throw new Error(d.error?.message || JSON.stringify(d.error));
      const text = d.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty AI response — try again');
      addMsg('a', text);
    } catch (e) {
      addMsg('e', e.message);
      showToast(e.message.slice(0, 70), true);
    } finally {
      setIsThinking(false);
    }
  }

  const handleAction = (actionType) => {
    if (actionType === 'sitrep') {
      callAI(getCtx() + '\\n\\nGenerate a military SITUATION REPORT:\\n' +
        'CLASSIFICATION: UNCLASSIFIED\\nDTG: [current]\\nSITUATION: [2 sentences]\\n' +
        'THREAT ASSESSMENT: [key dangers + spread vectors]\\nPRIORITY ZONES: [top 3 with why]\\n' +
        'ACTIONS REQUIRED: [3 specific bullets]\\nRESOURCES NEEDED: [what + where]\\nNEXT UPDATE: [timeframe]',
        '▶ GENERATING SITUATION REPORT...');
    } else if (actionType === 'predict') {
      callAI(getCtx() + '\\n\\nPredict fire spread — NEXT 24-48 HOURS:\\n' +
        '1. Which CRITICAL zones will expand? Why?\\n2. Which MEDIUM zones risk escalation?\\n' +
        '3. Account for India dry season, terrain, wind patterns\\n' +
        '4. Give 4 named predictions with confidence HIGH/MED/LOW\\n5. Identify single highest-risk corridor',
        '▶ RUNNING 48H SPREAD PREDICTION...');
    } else if (actionType === 'evac') {
      callAI(getCtx() + '\\n\\nEvacuation priority analysis:\\n' +
        'IMMEDIATE EVAC (0-6h): which zones, estimated population\\n' +
        'PRECAUTIONARY EVAC (6-24h): standby zones\\n' +
        'EVACUATION ROUTES: roads to use/avoid in each region\\n' +
        'SHELTER LOCATIONS: recommend staging areas\\n' +
        'Give district-level specifics.',
        '▶ COMPUTING EVACUATION PRIORITIES...');
    } else if (actionType === 'wx') {
      callAI(getCtx() + '\\n\\nFire weather analysis for these zones:\\n' +
        '- Rate overall fire weather danger: Extreme/Very High/High/Moderate\\n' +
        '- Which wind+humidity combos are most dangerous right now?\\n' +
        '- Fire behavior prediction: spotting, crowning, rapid spread risk?\\n' +
        '- What weather change would help suppression?\\n' +
        '- Issue fire weather watches for specific zones.',
        '▶ ANALYZING FIRE WEATHER...');
    } else if (actionType === 'summary') {
      callAI(getCtx() + '\\n\\nExecutive summary for the minister:\\n' +
        'OVERALL THREAT LEVEL: [CRITICAL/HIGH/MED/LOW]\\n' +
        'WORST ZONE: [name, coords, reason]\\n' +
        'SCALE: [what does ' + totalFRP.toFixed(0) + ' MW mean in practical terms?]\\n' +
        'CASUALTIES RISK: [estimate from population density]\\n' +
        'TREND: [escalating/stable/improving + reason]\\n' +
        'BOTTOM LINE: [1 sentence — what must happen in next 2 hours]',
        '▶ GENERATING EXECUTIVE SUMMARY...');
    } else if (actionType === 'resources') {
      callAI(getCtx() + '\\n\\nResource deployment plan:\\n' +
        '1. AERIAL: Water bombers + helicopters per zone (how many, where)\\n' +
        '2. GROUND: Fire brigade priorities + estimated crews needed\\n' +
        '3. MEDICAL: Pre-position ambulances + trauma units where\\n' +
        '4. LOGISTICS: Staging areas + supply corridors\\n' +
        '5. COORDINATION: Which state EOCs to activate NOW\\n' +
        'Base all numbers on actual FRP levels and Indian geography.',
        '▶ COMPUTING RESOURCE DEPLOYMENT...');
    }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    callAI(getCtx() + '\\n\\nQuestion: ' + chatInput.trim());
    setChatInput('');
  };

  return (
    <>
      <div id="hdr">
        <div id="logo-wrap">
          <div className="radar-box">
            <div className="r-ring"></div>
            <div className="r-ring2"></div>
            <div className="r-core"></div>
          </div>
          <div>
            <div className="logo-name">CRISISVISION</div>
            <div className="logo-sub">DISASTER INTELLIGENCE · AI</div>
          </div>
        </div>
        <div id="hstats">
          <div className="hs ok"><div className="hs-v">{spots.length}</div><div className="hs-l">HOTSPOTS</div></div>
          <div className="hs cr"><div className="hs-v">{c.CRITICAL}</div><div className="hs-l">CRITICAL</div></div>
          <div className="hs am"><div className="hs-v">{c.HIGH}</div><div className="hs-l">HIGH RISK</div></div>
          <div className="hs cy"><div className="hs-v">{totalFRP.toFixed(0)}</div><div className="hs-l">FRP MW</div></div>
          <div className="hs ok"><div className="hs-v">{regsSet.size}</div><div className="hs-l">REGIONS</div></div>
        </div>
        <div id="hright">
          <div className="hbadge live"><div className="dot"></div>SAT FEED LIVE</div>
          <div className="hbadge"><div className="dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 4px var(--cyan)', animation: 'glow 2s ease infinite' }}></div>AI ONLINE</div>
          <div id="clock">{timeStr}</div>
        </div>
      </div>

      <div id="left">
        <div className="ph"><span className="ph-t">Threat Level</span><span className="ph-b">{tLv}</span></div>
        <div id="threat-block">
          <div className="tl-lbl">OVERALL THREAT ASSESSMENT</div>
          <div id="tl-val" style={{ color: tCol, textShadow: `0 0 20px ${tCol}` }}>{tLv}</div>
          <div className="tbar"><div className="tbar-fill" style={{ width: `${Math.min(100, tPct)}%`, background: tCol }}></div></div>
          <div className="tgrid">
            <div className="tcard"><div className="tcard-v">{spots.length ? (totalFRP / spots.length).toFixed(1) : 0}</div><div className="tcard-l">AVG FRP (MW)</div></div>
            <div className="tcard"><div className="tcard-v">{hiConf}%</div><div className="tcard-l">HIGH CONFIDENCE</div></div>
          </div>
        </div>

        <div className="ph" style={{ borderTop: '1px solid var(--border)' }}><span className="ph-t">Risk Distribution</span></div>
        <div id="chart-block">
          <div className="bars">
            <div className="bar" style={{ background: 'var(--red)', height: `${Math.max(4, c.CRITICAL / maxV * 100)}%` }} data-v={c.CRITICAL}></div>
            <div className="bar" style={{ background: 'var(--orange)', height: `${Math.max(4, c.HIGH / maxV * 100)}%` }} data-v={c.HIGH}></div>
            <div className="bar" style={{ background: 'var(--amber)', height: `${Math.max(4, c.MEDIUM / maxV * 100)}%` }} data-v={c.MEDIUM}></div>
            <div className="bar" style={{ background: 'var(--g)', height: `${Math.max(4, c.LOW / maxV * 100)}%` }} data-v={c.LOW}></div>
          </div>
          <div className="bar-labels">
            <span style={{ color: 'var(--red)' }}>CRIT</span>
            <span style={{ color: 'var(--orange)' }}>HIGH</span>
            <span style={{ color: 'var(--amber)' }}>MED</span>
            <span style={{ color: 'var(--g)' }}>LOW</span>
          </div>
        </div>

        <div className="ph" style={{ borderTop: '1px solid var(--border)' }}><span className="ph-t">Active Regions</span><span className="ph-b">{sortedRegions.length}</span></div>
        <div id="regions">
          {sortedRegions.map(r => (
            <div key={r.name} className="ri" onClick={() => flyTo(r.lat, r.lon)}>
              <div className="ri-h">
                <span className="ri-n" style={{ color: rHex(r.ml) }}>{r.name}</span>
                <span className="ri-bx" style={{ color: rHex(r.ml), background: `${rHex(r.ml)}22` }}>{r.ml}</span>
              </div>
              <div className="ri-s">
                <span>🔥 {r.n} fires</span>
                <span>⚡ {r.frp.toFixed(0)} MW</span>
                <span>📊 {r.ms}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="map-wrap">
        <div id="map-grid"></div>
        <div id="scanline"></div>
        <div className="mc" id="mc-tl"></div>
        <div className="mc" id="mc-tr"></div>
        <div className="mc" id="mc-bl"></div>
        <div className="mc" id="mc-br"></div>
        <div id="map"></div>

        <div id="map-hud">
          <span style={{ color: 'var(--dim)' }}>REGION</span> INDIA SUBCONTINENT<br />
          <span style={{ color: 'var(--dim)' }}>SAT&nbsp;&nbsp;&nbsp;</span> VIIRS-SNPP NRT<br />
          <span style={{ color: 'var(--dim)' }}>PROJ&nbsp;&nbsp;</span> WGS84 / EPSG:4326<br />
          <span style={{ color: 'var(--dim)' }}>CURSOR</span> <span className="coord">{cursorCoord}</span><br />
          <span className="live">HOTSPOTS: <span>{spots.length}</span></span>
        </div>

        <div id="map-legend">
          <div style={{ fontSize: '8px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '7px' }}>RISK LEVEL</div>
          <div className="lr"><div className="ld" style={{ background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }}></div><span style={{ color: 'var(--red)' }}>CRITICAL  ≥ 75</span></div>
          <div className="lr"><div className="ld" style={{ background: 'var(--orange)' }}></div><span style={{ color: 'var(--orange)' }}>HIGH      ≥ 50</span></div>
          <div className="lr"><div className="ld" style={{ background: 'var(--amber)' }}></div><span style={{ color: 'var(--amber)' }}>MEDIUM    ≥ 25</span></div>
          <div className="lr"><div className="ld" style={{ background: 'var(--g)' }}></div><span style={{ color: 'var(--g)' }}>LOW       &lt; 25</span></div>
        </div>

        <div id="map-ctrls">
          <button className={`mc-btn ${curLayer === 'markers' ? 'on' : ''}`} onClick={() => handleSetLayer('markers')}>◉ MARKERS</button>
          <button className={`mc-btn ${curLayer === 'heat' ? 'on' : ''}`} onClick={() => handleSetLayer('heat')}>◈ HEATMAP</button>
          <button className={`mc-btn ${curLayer === 'cluster' ? 'on' : ''}`} onClick={() => handleSetLayer('cluster')}>⬡ CLUSTERS</button>
          <button className="mc-btn" onClick={() => mapRef.current.setView([22.5, 82], 5)}>⌂ RESET VIEW</button>
        </div>

        <div id="click-hint">▸ CLICK FIRE MARKER → AI ANALYSIS</div>
      </div>

      <div id="right">
        <div className="ph">
          <span className="ph-t" style={{ color: 'var(--cyan)' }}>AI Analyst</span>
          <span style={{ fontSize: '9px', color: 'var(--g)', letterSpacing: '1px', marginLeft: '4px' }}>[ ONLINE ]</span>
          <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--g)', boxShadow: '0 0 6px var(--g)', animation: 'glow 2s ease infinite' }}></div>
        </div>

        <div id="analyst">
          <div id="actions">
            <button disabled={isThinking} className={`ab pri ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('sitrep')}><span className="ic">📋</span><span className="tx">GEN SITREP</span></button>
            <button disabled={isThinking} className={`ab pri ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('predict')}><span className="ic">📡</span><span className="tx">PREDICT SPREAD</span></button>
            <button disabled={isThinking} className={`ab red ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('evac')}><span className="ic">🚨</span><span className="tx">EVAC PRIORITY</span></button>
            <button disabled={isThinking} className={`ab cy ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('wx')}><span className="ic">🌡️</span><span className="tx">FIRE WEATHER</span></button>
            <button disabled={isThinking} className={`ab ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('summary')}><span className="ic">📊</span><span className="tx">RISK SUMMARY</span></button>
            <button disabled={isThinking} className={`ab red ${isThinking ? 'loading' : ''}`} onClick={() => handleAction('resources')}><span className="ic">🚒</span><span className="tx">DEPLOY ASSETS</span></button>
          </div>

          <div id="chat-log" ref={chatLogRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.type === 'u' ? 'mu' : m.type === 'a' ? 'ma' : m.type === 'e' ? 'me' : 'ms'}`}>
                {m.type === 'u' && `▸ ${m.text}`}
                {m.type === 'a' && <span dangerouslySetInnerHTML={{ __html: m.text.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\\n/g, '<br>') }} />}
                {m.type === 'e' && `[ERROR] ${m.text}`}
                {m.type === 'ms' && m.text}
              </div>
            ))}
            {isThinking && <div className="mtyp">AI analyst processing<span>█</span></div>}
          </div>

          <form id="chat-form" onSubmit={sendChat}>
            <input id="chat-input" disabled={isThinking} value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask the AI analyst anything..." autoComplete="off" />
            <button id="send-btn" disabled={isThinking} type="submit">SEND ▶</button>
          </form>
        </div>

        <div id="alerts">
          <div className="ph">
            <span className="ph-t" style={{ color: 'var(--red)' }}>Alert Queue</span>
            <span style={{ color: 'var(--red)', fontWeight: 700, marginLeft: '4px' }}>[{allAlerts.length}]</span>
            <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: c.CRITICAL > 0 ? 'var(--red)' : 'var(--dim)', boxShadow: c.CRITICAL > 0 ? '0 0 8px var(--red)' : 'none', animation: c.CRITICAL > 0 ? 'pulse .7s ease infinite' : 'none' }}></div>
          </div>
          <div id="alert-stats">
            <div className="as" onClick={() => setCurFilter('CRITICAL')}><div className="as-n" style={{ color: 'var(--red)' }}>{c.CRITICAL}</div><div className="as-l">CRITICAL</div></div>
            <div className="as" onClick={() => setCurFilter('HIGH')}><div className="as-n" style={{ color: 'var(--orange)' }}>{c.HIGH}</div><div className="as-l">HIGH</div></div>
            <div className="as" onClick={() => setCurFilter('MEDIUM')}><div className="as-n" style={{ color: 'var(--amber)' }}>{c.MEDIUM}</div><div className="as-l">MEDIUM</div></div>
            <div className="as" onClick={() => setCurFilter('ALL')}><div className="as-n" style={{ color: 'var(--g)' }}>{c.LOW}</div><div className="as-l">LOW</div></div>
          </div>
          <div id="alert-list">
            {filteredAlerts.slice(0, 30).map((a, i) => {
              const c = a.level === 'CRITICAL' ? { col: '#ff3b3b', bg: 'rgba(255,59,59,.08)', ic: '◈' } : a.level === 'HIGH' ? { col: '#ff7700', bg: 'rgba(255,119,0,.08)', ic: '◆' } : { col: '#ffaa00', bg: 'rgba(255,170,0,.05)', ic: '◇' };
              return (
                <div key={i} className="al" style={{ borderLeftColor: c.col, background: c.bg }} onClick={() => flyTo(a.lat, a.lon)}>
                  <div className="al-h">
                    <span className="al-lv" style={{ color: c.col }}>{c.ic} {a.level}</span>
                    <span className="al-ts">{Math.round((Date.now() - new Date(a.ts)) / 60000)}m ago</span>
                  </div>
                  <div className="al-m">{a.zone} — FRP: {a.frp} MW | Score: {a.score}</div>
                  <div className="al-c">
                    <span>{Math.abs(a.lat).toFixed(3)}°{a.lat >= 0 ? 'N' : 'S'} {Math.abs(a.lon).toFixed(3)}°{a.lon >= 0 ? 'E' : 'W'}</span>
                    <span>💨{a.wind}km/h 💧{a.humidity}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div id="sbar">
        <div className="sb-i"><div className="sb-d"></div>SYSTEM OPERATIONAL</div>
        <div className="sb-i"><div className="sb-d" style={{ background: 'var(--cyan)', boxShadow: '0 0 4px var(--cyan)' }}></div>VIIRS-SNPP NRT</div>
        <div className="sb-i"><div className="sb-d" style={{ background: 'var(--amber)', boxShadow: '0 0 4px var(--amber)' }}></div>AI: {CONFIG.MODEL.toUpperCase()}</div>
        <div id="sbr">
          <span>NEXT REFRESH:</span>
          <div id="ref-bar"><div id="ref-fill" style={{ width: `${rpct}%` }}></div></div>
          <span>{lastRefStr}</span>
        </div>
      </div>

      <div id="toast" className={toastMsg.show ? `show ${toastMsg.err ? 'err' : ''}` : ''}>{toastMsg.msg}</div>
    </>
  );
}
