/* HidroSed Maestra
   Aplicación estática: hidráulica, granulometría, transporte de sedimentos, socavación y lecho móvil.
   Compatible con GitHub Pages. Sin dependencias externas.
*/
const G = 9.80665;
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 3) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (id, fallback = 0) => {
  const el = $(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : fallback;
};
const str = (id, fallback = "") => ($(id)?.value ?? fallback).trim();
const uid = () => Math.random().toString(36).slice(2, 10);

const presets = {
  "A2-1": { n: 0.040, d90: 178.00, dm: 37.27, d84: 20.00, d50: 18.0, q: {2:0.44,5:0.48,10:0.57,25:0.74,50:0.91,100:1.05,200:1.15}, bed0: 1132.16, slope: 0.120, width: 5.4, depth: 0.16 },
  "A2-2": { n: 0.040, d90: 118.67, dm: 28.17, d84: 84.40, d50: 28.0, q: {2:1.46,5:1.62,10:1.90,25:2.49,50:3.05,100:3.52,200:3.86}, bed0: 1124.20, slope: 0.130, width: 8.2, depth: 0.28 },
  "A2-3": { n: 0.040, d90: 23.33, dm: 13.74, d84: 18.50, d50: 9.0, q: {2:1.66,5:1.85,10:2.16,25:2.83,50:3.46,100:4.00,200:4.39}, bed0: 1112.13, slope: 0.049, width: 10.5, depth: 0.42 },
  "Andacollo": { n: 0.034, d90: 54.333, dm: 19.237, d84: 36.67, d50: 15.0, q: {2:3.80,5:11.59,10:16.30,25:18.92,50:19.76,100:24.29,200:27.04}, bed0: 1036.50, slope: 0.020, width: 14.0, depth: 0.75 }
};

const dgaItems = [
  ["Antecedentes generales", "Proyecto, cauce, ubicación, condición sin/con proyecto y descripción de intervención."],
  ["Topografía", "Planta, perfil longitudinal y perfiles transversales representativos del cauce."],
  ["Hidrología", "Caudales máximos, operacionales o de verificación según objetivo del estudio."],
  ["Rugosidad", "Manning por inspección de lecho, taludes, vegetación e irregularidades."],
  ["Modelación hidráulica", "Eje hidráulico, condiciones de borde y resultados interpretables."],
  ["Granulometría", "Curva del material del lecho y diámetros característicos D50, D84, D90/Ds90 y Dm."],
  ["Mecánica fluvial", "Capacidad de transporte, movilidad del lecho, acorazamiento y estabilidad."],
  ["Socavación", "Socavación generalizada y revisión de puntos críticos/curvas/obras."],
  ["Planos y reporte", "Tablas de cálculo, perfiles, conclusiones, recomendaciones y trazabilidad."],
];

let state = {
  projectName: "Estudio hidráulico y socavación",
  riverName: "Cauce en estudio",
  locationName: "Región de Coquimbo",
  condition: "Sin Proyecto",
  globals: { q: 3.52, tr: 100, S: 0.013, n: 0.040, rhoW: 1000, rhoS: 2650, porosity: 0.35, mu: 1, gammaMix: 1, thetaCrit: 0.047, supplyFactor: 1, sfScour: 1, roughnessCorrection: true, curveWarnings: true },
  sections: [],
  gradation: [
    { d: 0.5, p: 3 }, { d: 2, p: 12 }, { d: 8, p: 35 }, { d: 16, p: 55 }, { d: 32, p: 72 }, { d: 64, p: 86 }, { d: 128, p: 95 }, { d: 200, p: 100 }
  ],
  results: [],
  mobile: []
};

let tempPointsPx = [];
let drawMode = "pencil";
let isDrawing = false;
let bgImage = null;
let bgImageDataUrl = null;

function init() {
  renderChecklist();
  fillTutorial();
  loadInputsFromState();
  if (!state.sections.length) generateSections();
  bindEvents();
  renderAll();
  calculateGradation();
  runCalculations(false);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  ["openTutorial"].forEach(id => $(id).addEventListener("click", () => $("tutorialDialog").showModal()));
  $("closeTutorial").addEventListener("click", () => $("tutorialDialog").close());

  $("loadPreset").addEventListener("click", loadPreset);
  $("makeSections").addEventListener("click", () => { syncStateFromInputs(); generateSections(); renderAll(); runCalculations(false); switchTab("sections"); });
  $("addSection").addEventListener("click", () => { addSection(); renderAll(); });
  $("clearSections").addEventListener("click", () => { if (confirm("¿Limpiar todas las secciones?")) { state.sections = []; state.results = []; renderAll(); } });
  $("reindexSections").addEventListener("click", () => { state.sections.sort((a,b)=>a.distance-b.distance); updateDxFromDistances(); renderAll(); });
  $("applyGlobals").addEventListener("click", () => { syncStateFromInputs(); state.sections.forEach(s => { s.q = state.globals.q; s.slope = state.globals.S; s.n = state.globals.n; }); renderAll(); });
  $("parseSections").addEventListener("click", parseSectionsText);
  $("copyExampleSections").addEventListener("click", () => navigator.clipboard?.writeText(sectionExample()).then(()=>alert("Ejemplo copiado.")));

  ["runAll", "runAllTop"].forEach(id => $(id).addEventListener("click", () => runCalculations(true)));
  ["saveLocal", "saveLocalTop"].forEach(id => $(id).addEventListener("click", saveLocal));
  $("loadLocal").addEventListener("click", loadLocal);
  $("exportCSV").addEventListener("click", exportCSV);
  $("exportJSON").addEventListener("click", exportJSON);
  $("importJSON").addEventListener("change", importJSON);
  $("exportReport").addEventListener("click", exportReportHTML);
  $("copyMethodology").addEventListener("click", copyMethodology);

  ["projectName","riverName","locationName","condition","tr","qGlobal","sGlobal","nGlobal","rhoW","rhoS","porosity","muGlobal","gammaMix","thetaCrit","supplyFactor","sfScour"].forEach(id => $(id).addEventListener("change", () => { syncStateFromInputs(); renderReportPreview(); }));
  ["roughnessCorrection","curveWarnings"].forEach(id => $(id).addEventListener("change", () => { syncStateFromInputs(); }));

  $("sectionsTable").addEventListener("input", onSectionInput);
  $("sectionsTable").addEventListener("change", onSectionInput);
  $("sectionsTable").addEventListener("click", onSectionAction);

  $("activeSection").addEventListener("change", () => loadActiveGeometryToCanvas());
  $("modePencil").addEventListener("click", () => setDrawMode("pencil"));
  $("modePoint").addEventListener("click", () => setDrawMode("point"));
  $("undoPoint").addEventListener("click", () => { tempPointsPx.pop(); redrawCanvas(); });
  $("clearCanvas").addEventListener("click", () => { tempPointsPx = []; bgImage = null; bgImageDataUrl = null; redrawCanvas(); });
  $("exampleSection").addEventListener("click", loadExampleGeometry);
  $("saveGeometry").addEventListener("click", saveGeometryFromCanvas);
  $("imageUpload").addEventListener("change", handleImageUpload);
  ["scaleX","scaleY","zBottom"].forEach(id => $(id).addEventListener("change", redrawCanvas));

  const canvas = $("sectionCanvas");
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointerleave", pointerUp);

  $("addGrain").addEventListener("click", () => { state.gradation.push({ d: 10, p: 50 }); renderGrainTable(); calculateGradation(); });
  $("loadGrainExample").addEventListener("click", loadGrainExample);
  $("applyGrain").addEventListener("click", applyGrainToSections);
  $("parseGrain").addEventListener("click", parseGrainText);
  $("grainTable").addEventListener("input", onGrainInput);
  $("grainTable").addEventListener("click", onGrainAction);

  $("runMobile").addEventListener("click", runMobileSimulation);
  $("exportMobileCSV").addEventListener("click", exportMobileCSV);
}

function loadInputsFromState() {
  $("projectName").value = state.projectName;
  $("riverName").value = state.riverName;
  $("locationName").value = state.locationName;
  $("condition").value = state.condition;
  $("tr").value = state.globals.tr;
  $("qGlobal").value = state.globals.q;
  $("sGlobal").value = state.globals.S;
  $("nGlobal").value = state.globals.n;
  $("rhoW").value = state.globals.rhoW;
  $("rhoS").value = state.globals.rhoS;
  $("porosity").value = state.globals.porosity;
  $("muGlobal").value = state.globals.mu;
  $("gammaMix").value = state.globals.gammaMix;
  $("thetaCrit").value = state.globals.thetaCrit;
  $("supplyFactor").value = state.globals.supplyFactor;
  $("sfScour").value = state.globals.sfScour;
  $("roughnessCorrection").checked = !!state.globals.roughnessCorrection;
  $("curveWarnings").checked = !!state.globals.curveWarnings;
}

function syncStateFromInputs() {
  state.projectName = str("projectName", state.projectName);
  state.riverName = str("riverName", state.riverName);
  state.locationName = str("locationName", state.locationName);
  state.condition = str("condition", state.condition);
  state.globals.tr = num("tr", 100);
  state.globals.q = num("qGlobal", 1);
  state.globals.S = num("sGlobal", 0.001);
  state.globals.n = num("nGlobal", 0.04);
  state.globals.rhoW = num("rhoW", 1000);
  state.globals.rhoS = num("rhoS", 2650);
  state.globals.porosity = clamp(num("porosity", 0.35), 0, 0.8);
  state.globals.mu = Math.max(0.1, num("muGlobal", 1));
  state.globals.gammaMix = Math.max(0.5, num("gammaMix", 1));
  state.globals.thetaCrit = Math.max(0.001, num("thetaCrit", 0.047));
  state.globals.supplyFactor = Math.max(0, num("supplyFactor", 1));
  state.globals.sfScour = Math.max(0.1, num("sfScour", 1));
  state.globals.roughnessCorrection = $("roughnessCorrection").checked;
  state.globals.curveWarnings = $("curveWarnings").checked;
}

function switchTab(id) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === id));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("is-active", p.id === id));
  if (id === "draw") { renderActiveSelect(); loadActiveGeometryToCanvas(); }
  if (id === "gradation") { calculateGradation(); }
  if (id === "results") { drawCharts(); }
  if (id === "report") { renderReportPreview(); }
}

function renderAll() {
  renderSectionsTable();
  renderActiveSelect();
  renderGrainTable();
  renderReportPreview();
}

function loadPreset() {
  const key = $("presetSelect").value;
  if (key === "custom") return;
  const p = presets[key];
  const tr = String(num("tr", 100));
  $("qGlobal").value = p.q[tr] ?? p.q[100] ?? Object.values(p.q)[0];
  $("sGlobal").value = p.slope;
  $("nGlobal").value = p.n;
  $("bed0").value = p.bed0;
  $("bDefault").value = p.width;
  $("yDefault").value = p.depth;
  const grain = syntheticGradationFromD(p.d50, p.d84, p.d90, p.dm);
  state.gradation = grain;
  syncStateFromInputs();
  generateSections();
  renderAll();
  calculateGradation();
  runCalculations(false);
}

function syntheticGradationFromD(d50, d84, d90, dm) {
  const d10 = Math.max(0.05, d50 * 0.28);
  const d30 = Math.max(d10 * 1.2, d50 * 0.62);
  const d60 = Math.max(d50 * 1.1, Math.sqrt(d50 * d84));
  const d95 = Math.max(d90 * 1.15, d84 * 1.3, dm * 1.5);
  return [{d:d10,p:10},{d:d30,p:30},{d:d50,p:50},{d:d60,p:60},{d:d84,p:84},{d:d90,p:90},{d:d95,p:95},{d:d95*1.35,p:100}];
}

function generateSections() {
  syncStateFromInputs();
  const n = clamp(parseInt(num("nSections", 6), 10), 1, 100);
  const dx = Math.max(0.01, num("dxDefault", 40));
  const B = Math.max(0.05, num("bDefault", 8));
  const y = Math.max(0.01, num("yDefault", 0.45));
  const z = Math.max(0, num("zSideDefault", 1.5));
  const bed0 = num("bed0", 100);
  const g = currentGradationValues();
  state.sections = [];
  for (let i = 0; i < n; i++) {
    const distance = i * dx;
    const wobble = 1 + 0.08 * Math.sin(i * 0.8);
    const isCurve = i > 0 && i < n - 1 && i % 3 === 1;
    state.sections.push({
      key: uid(), id: `S${i + 1}`, distance, dx: i === 0 ? dx : dx,
      q: state.globals.q, slope: state.globals.S, n: state.globals.n,
      manualB: B * wobble, manualY: y * (1 + 0.06 * Math.cos(i)), zSide: z,
      bed: bed0 - distance * state.globals.S, isCurve,
      curveSide: isCurve ? "exterior" : "eje", curveFactor: isCurve ? 1.15 : 1.00,
      d50: g.d50 || 28, d84: g.d84 || 84.4, d90: g.d90 || 118.67, dm: g.dm || g.d50 || 28,
      mu: state.globals.mu, note: "", points: [], bgImage: null, scaleX: 20, scaleY: 5, zBottom: bed0 - 2
    });
  }
}

function addSection() {
  const last = state.sections[state.sections.length - 1];
  const dx = Math.max(0.01, num("dxDefault", last?.dx || 40));
  const g = currentGradationValues();
  state.sections.push({
    key: uid(), id: `S${state.sections.length + 1}`, distance: last ? last.distance + dx : 0, dx,
    q: state.globals.q, slope: state.globals.S, n: state.globals.n,
    manualB: num("bDefault", last?.manualB || 8), manualY: num("yDefault", last?.manualY || 0.45), zSide: num("zSideDefault", last?.zSide || 1.5),
    bed: last ? last.bed - dx * state.globals.S : num("bed0", 100), isCurve: false, curveSide: "eje", curveFactor: 1,
    d50: g.d50 || 28, d84: g.d84 || 84, d90: g.d90 || 120, dm: g.dm || 28, mu: state.globals.mu, note: "", points: [], bgImage: null, scaleX: 20, scaleY: 5, zBottom: num("bed0", 100) - 2
  });
}

function updateDxFromDistances() {
  state.sections.forEach((s, i) => { s.dx = i === 0 ? (state.sections[1]?.distance - s.distance || s.dx || 0) : Math.max(0, s.distance - state.sections[i-1].distance); });
}

function renderSectionsTable() {
  const rows = state.sections.map((s, i) => `
    <tr data-i="${i}">
      <td><input data-k="id" value="${esc(s.id)}"></td>
      <td><input type="number" step="0.1" data-k="distance" value="${fmt(s.distance,1)}"></td>
      <td><input type="number" step="0.1" data-k="dx" value="${fmt(s.dx,1)}"></td>
      <td><input type="number" step="0.001" data-k="q" value="${fmt(s.q,4)}"></td>
      <td><input type="number" step="0.0001" data-k="slope" value="${fmt(s.slope,6)}"></td>
      <td><input type="number" step="0.001" data-k="n" value="${fmt(s.n,4)}"></td>
      <td><input type="number" step="0.01" data-k="manualB" value="${fmt(s.manualB,2)}"></td>
      <td><input type="number" step="0.01" data-k="manualY" value="${fmt(s.manualY,3)}"></td>
      <td><input type="number" step="0.1" data-k="zSide" value="${fmt(s.zSide,2)}"></td>
      <td><input type="number" step="0.01" data-k="bed" value="${fmt(s.bed,3)}"></td>
      <td><input class="check" type="checkbox" data-k="isCurve" ${s.isCurve ? "checked" : ""}></td>
      <td><select data-k="curveSide"><option ${s.curveSide==="interior"?"selected":""}>interior</option><option ${s.curveSide==="eje"?"selected":""}>eje</option><option ${s.curveSide==="exterior"?"selected":""}>exterior</option></select></td>
      <td><input type="number" step="0.01" data-k="curveFactor" value="${fmt(s.curveFactor,2)}"></td>
      <td><input type="number" step="0.001" data-k="d50" value="${fmt(s.d50,3)}"></td>
      <td><input type="number" step="0.001" data-k="d84" value="${fmt(s.d84,3)}"></td>
      <td><input type="number" step="0.001" data-k="d90" value="${fmt(s.d90,3)}"></td>
      <td><input type="number" step="0.001" data-k="dm" value="${fmt(s.dm,3)}"></td>
      <td>${s.points?.length ? `<span class="badge ok">${s.points.length} pts</span>` : `<span class="badge soft">manual</span>`}</td>
      <td><button data-action="draw">Dibujar</button><button data-action="clone" class="ghost">Clonar</button><button data-action="delete" class="danger">Eliminar</button></td>
    </tr>`).join("");
  $("sectionsTable").innerHTML = `<thead><tr>
    <th>ID</th><th>Dist. m</th><th>Δx m</th><th>Q m³/s</th><th>S</th><th>n</th><th>B m</th><th>y m</th><th>Talud H:V</th><th>Fondo m</th><th>Curva</th><th>Lado</th><th>Factor</th><th>D50</th><th>D84</th><th>D90/Ds90</th><th>Dm</th><th>Geom.</th><th>Acción</th>
  </tr></thead><tbody>${rows}</tbody>`;
}

function onSectionInput(e) {
  const el = e.target;
  const k = el.dataset.k;
  if (!k) return;
  const i = parseInt(el.closest("tr").dataset.i, 10);
  const s = state.sections[i];
  if (!s) return;
  if (el.type === "checkbox") s[k] = el.checked;
  else if (["id","curveSide","note"].includes(k)) s[k] = el.value;
  else s[k] = parseFloat(el.value) || 0;
  renderActiveSelect(false);
}

function onSectionAction(e) {
  const action = e.target.dataset.action;
  if (!action) return;
  const i = parseInt(e.target.closest("tr").dataset.i, 10);
  if (action === "delete") { state.sections.splice(i, 1); renderAll(); }
  if (action === "clone") { const clone = JSON.parse(JSON.stringify(state.sections[i])); clone.key = uid(); clone.id = clone.id + "c"; clone.distance += clone.dx || 0; state.sections.splice(i + 1, 0, clone); renderAll(); }
  if (action === "draw") { renderActiveSelect(); $("activeSection").value = String(i); switchTab("draw"); }
}

function sectionExample() {
  return [
    "S1,0,40,3.52,0.013,0.040,8,0.45,1.5,100,no,eje,1.00,28,84.4,118.67,28.17",
    "S2,40,40,3.52,0.013,0.040,8.4,0.48,1.5,99.48,si,exterior,1.15,28,84.4,118.67,28.17",
    "S3,80,40,3.52,0.013,0.040,7.9,0.43,1.5,98.96,no,eje,1.00,28,84.4,118.67,28.17"
  ].join("\n");
}

function parseSectionsText() {
  const raw = $("pasteSections").value.trim();
  if (!raw) return;
  const lines = raw.split(/\n+/).filter(Boolean);
  state.sections = lines.map((line, i) => {
    const c = line.split(/[;,\t]/).map(x => x.trim());
    return { key: uid(), id: c[0] || `S${i+1}`, distance: +c[1] || 0, dx: +c[2] || 0, q: +c[3] || state.globals.q, slope: +c[4] || state.globals.S, n: +c[5] || state.globals.n, manualB: +c[6] || 1, manualY: +c[7] || 0.1, zSide: +c[8] || 0, bed: +c[9] || 0, isCurve: /si|sí|yes|true|1/i.test(c[10] || ""), curveSide: c[11] || "eje", curveFactor: +c[12] || 1, d50: +c[13] || 1, d84: +c[14] || 1, d90: +c[15] || 1, dm: +c[16] || +c[13] || 1, mu: state.globals.mu, note: "", points: [], bgImage: null, scaleX: 20, scaleY: 5, zBottom: 0 };
  });
  renderAll();
  runCalculations(false);
}

function renderActiveSelect(preserve = true) {
  const sel = $("activeSection");
  const old = preserve ? sel.value : "0";
  sel.innerHTML = state.sections.map((s, i) => `<option value="${i}">${esc(s.id)} · ${fmt(s.distance,1)} m</option>`).join("");
  if (state.sections[old]) sel.value = old;
}

function activeSection() {
  const i = parseInt($("activeSection").value || "0", 10);
  return state.sections[i];
}

function setDrawMode(mode) {
  drawMode = mode;
  $("modePencil").classList.toggle("is-active", mode === "pencil");
  $("modePoint").classList.toggle("is-active", mode === "point");
}

function pointerPos(e) {
  const rect = $("sectionCanvas").getBoundingClientRect();
  const sx = $("sectionCanvas").width / rect.width;
  const sy = $("sectionCanvas").height / rect.height;
  return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}
function pointerDown(e) {
  e.preventDefault();
  const p = pointerPos(e);
  if (drawMode === "point") { tempPointsPx.push(p); redrawCanvas(); return; }
  isDrawing = true; tempPointsPx.push(p); redrawCanvas();
}
function pointerMove(e) {
  if (!isDrawing || drawMode !== "pencil") return;
  const p = pointerPos(e);
  const last = tempPointsPx[tempPointsPx.length - 1];
  if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 4) { tempPointsPx.push(p); redrawCanvas(); }
}
function pointerUp() { isDrawing = false; }

function redrawCanvas() {
  const c = $("sectionCanvas"), ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,c.width,c.height);
  if (bgImage) {
    const scale = Math.min(c.width / bgImage.width, c.height / bgImage.height);
    const w = bgImage.width * scale, h = bgImage.height * scale;
    ctx.globalAlpha = .58; ctx.drawImage(bgImage, (c.width-w)/2, (c.height-h)/2, w, h); ctx.globalAlpha = 1;
  }
  drawGrid(ctx, c);
  if (tempPointsPx.length) {
    ctx.strokeStyle = "#0f766e"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
    tempPointsPx.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke();
    ctx.fillStyle = "#0f766e"; tempPointsPx.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); });
  }
  ctx.fillStyle = "#334155"; ctx.font = "14px system-ui";
  ctx.fillText(`Escala: ${num("scaleX",20)} m horizontal · ${num("scaleY",5)} m vertical · cota base ${num("zBottom",0)} m`, 18, c.height - 18);
}
function drawGrid(ctx, c) {
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let x=0; x<=c.width; x+=55) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
  for (let y=0; y<=c.height; y+=52) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
}

function handleImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { bgImageDataUrl = reader.result; bgImage = new Image(); bgImage.onload = redrawCanvas; bgImage.src = bgImageDataUrl; };
  reader.readAsDataURL(file);
}

function loadActiveGeometryToCanvas() {
  const s = activeSection();
  tempPointsPx = [];
  bgImage = null; bgImageDataUrl = s?.bgImage || null;
  if (s) { $("scaleX").value = s.scaleX || 20; $("scaleY").value = s.scaleY || 5; $("zBottom").value = s.zBottom ?? s.bed ?? 0; }
  if (s?.points?.length) tempPointsPx = meterPointsToCanvas(s.points, s.scaleX || 20, s.scaleY || 5, s.zBottom ?? 0);
  if (bgImageDataUrl) { bgImage = new Image(); bgImage.onload = redrawCanvas; bgImage.src = bgImageDataUrl; } else redrawCanvas();
  updateSectionStatus();
}

function loadExampleGeometry() {
  const c = $("sectionCanvas"), H = c.height, W = c.width;
  tempPointsPx = [
    {x:30,y:H*.35},{x:130,y:H*.43},{x:240,y:H*.56},{x:360,y:H*.72},{x:500,y:H*.76},{x:660,y:H*.68},{x:810,y:H*.54},{x:980,y:H*.42},{x:W-30,y:H*.37}
  ];
  redrawCanvas();
}

function canvasPointsToMeter(pointsPx, scaleX, scaleY, zBottom) {
  const c = $("sectionCanvas");
  const sorted = pointsPx.slice().sort((a,b)=>a.x-b.x);
  return sorted.map(p => ({ x: (p.x / c.width) * scaleX, z: zBottom + (1 - p.y / c.height) * scaleY }));
}
function meterPointsToCanvas(points, scaleX, scaleY, zBottom) {
  const c = $("sectionCanvas");
  return points.map(p => ({ x: (p.x / scaleX) * c.width, y: (1 - (p.z - zBottom) / scaleY) * c.height }));
}
function saveGeometryFromCanvas() {
  const s = activeSection(); if (!s) return alert("No hay sección activa.");
  if (tempPointsPx.length < 2) return alert("Debe dibujar al menos dos puntos.");
  const scaleX = Math.max(0.01, num("scaleX", 20));
  const scaleY = Math.max(0.01, num("scaleY", 5));
  const zBottom = num("zBottom", 0);
  const pts = simplifyPoints(canvasPointsToMeter(tempPointsPx, scaleX, scaleY, zBottom), 0.03);
  s.points = pts; s.bgImage = bgImageDataUrl; s.scaleX = scaleX; s.scaleY = scaleY; s.zBottom = zBottom;
  s.manualB = Math.max(0.01, Math.max(...pts.map(p=>p.x)) - Math.min(...pts.map(p=>p.x)));
  s.bed = Math.min(...pts.map(p=>p.z));
  renderSectionsTable(); updateSectionStatus();
  alert(`Geometría guardada en ${s.id}: ${pts.length} puntos.`);
}
function simplifyPoints(pts, tol = 0.03) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i=1; i<pts.length-1; i++) {
    const a = out[out.length-1], b = pts[i];
    if (Math.hypot(a.x-b.x, a.z-b.z) >= tol) out.push(b);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function updateSectionStatus() {
  const s = activeSection();
  $("sectionStatus").textContent = s ? `${s.id}: ${s.points?.length || 0} puntos guardados · B manual/digital ${fmt(s.manualB,2)} m · fondo ${fmt(s.bed,2)} m` : "";
}

function renderGrainTable() {
  const rows = state.gradation.map((g,i)=>`<tr data-i="${i}"><td>${i+1}</td><td><input type="number" step="0.001" data-k="d" value="${fmt(g.d,3)}"></td><td><input type="number" step="0.1" data-k="p" value="${fmt(g.p,1)}"></td><td><button data-action="delete" class="danger">Eliminar</button></td></tr>`).join("");
  $("grainTable").innerHTML = `<thead><tr><th>#</th><th>Diámetro mm</th><th>% que pasa</th><th></th></tr></thead><tbody>${rows}</tbody>`;
}
function onGrainInput(e) {
  const k = e.target.dataset.k; if (!k) return;
  const i = parseInt(e.target.closest("tr").dataset.i, 10);
  state.gradation[i][k] = parseFloat(e.target.value) || 0;
  calculateGradation();
}
function onGrainAction(e) {
  if (e.target.dataset.action === "delete") { const i = parseInt(e.target.closest("tr").dataset.i, 10); state.gradation.splice(i,1); renderGrainTable(); calculateGradation(); }
}
function loadGrainExample() {
  state.gradation = [{d:0.25,p:2},{d:0.5,p:5},{d:2,p:12},{d:8,p:32},{d:16,p:50},{d:32,p:68},{d:64,p:84},{d:128,p:93},{d:200,p:100}];
  renderGrainTable(); calculateGradation();
}
function parseGrainText() {
  const raw = $("pasteGrain").value.trim(); if (!raw) return;
  state.gradation = raw.split(/\n+/).map(line => { const c = line.split(/[;,\t]/).map(x=>x.trim()); return { d:+c[0]||0, p:+c[1]||0 }; }).filter(g => g.d > 0);
  renderGrainTable(); calculateGradation();
}
function sortedGradation() {
  return state.gradation.filter(g => Number.isFinite(g.d) && g.d > 0 && Number.isFinite(g.p)).sort((a,b)=>a.p-b.p);
}
function percentileD(percent) {
  const arr = sortedGradation();
  if (arr.length < 2) return NaN;
  if (percent <= arr[0].p) return arr[0].d;
  if (percent >= arr[arr.length-1].p) return arr[arr.length-1].d;
  for (let i=1; i<arr.length; i++) if (percent <= arr[i].p) {
    const a = arr[i-1], b = arr[i];
    const t = (percent - a.p) / ((b.p - a.p) || 1);
    const logD = Math.log10(a.d) + t * (Math.log10(b.d) - Math.log10(a.d));
    return Math.pow(10, logD);
  }
  return NaN;
}
function meanDiameterGeom() {
  const arr = sortedGradation();
  if (arr.length < 2) return percentileD(50);
  let sum = 0, weight = 0;
  for (let i=1; i<arr.length; i++) {
    const dp = Math.max(0, arr[i].p - arr[i-1].p);
    const dg = Math.sqrt(arr[i].d * arr[i-1].d);
    sum += dg * dp; weight += dp;
  }
  return weight > 0 ? sum / weight : percentileD(50);
}
function currentGradationValues() {
  const d10 = percentileD(10), d16 = percentileD(16), d30 = percentileD(30), d50 = percentileD(50), d60 = percentileD(60), d84 = percentileD(84), d90 = percentileD(90), dm = meanDiameterGeom();
  return { d10,d16,d30,d50,d60,d84,d90,dm, cu: d60/d10, cc:(d30*d30)/(d10*d60) };
}
function calculateGradation() {
  const g = currentGradationValues();
  $("grainSummary").innerHTML = Object.entries({D10:g.d10,D16:g.d16,D30:g.d30,D50:g.d50,D60:g.d60,D84:g.d84,"D90/Ds90":g.d90,Dm:g.dm,Cu:g.cu,Cc:g.cc}).map(([k,v]) => `<div class="metric"><strong>${fmt(v,3)}</strong><span>${k}${k.startsWith("D") ? " mm" : ""}</span></div>`).join("");
  drawGrainCurve();
  return g;
}
function applyGrainToSections() {
  const g = calculateGradation();
  state.sections.forEach(s => { if (Number.isFinite(g.d50)) s.d50=g.d50; if (Number.isFinite(g.d84)) s.d84=g.d84; if (Number.isFinite(g.d90)) s.d90=g.d90; if (Number.isFinite(g.dm)) s.dm=g.dm; });
  renderSectionsTable();
}
function drawGrainCurve() {
  const c = $("grainCanvas"); if (!c) return; const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  const arr = sortedGradation(); if (arr.length < 2) return;
  const pad=48, minD=Math.min(...arr.map(g=>g.d)), maxD=Math.max(...arr.map(g=>g.d));
  const lx0=Math.log10(minD), lx1=Math.log10(maxD);
  const X=d=>pad+(Math.log10(d)-lx0)/(lx1-lx0||1)*(c.width-2*pad); const Y=p=>c.height-pad-p/100*(c.height-2*pad);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let p=0;p<=100;p+=20){ctx.beginPath();ctx.moveTo(pad,Y(p));ctx.lineTo(c.width-pad,Y(p));ctx.stroke();ctx.fillStyle="#64748b";ctx.fillText(String(p),14,Y(p)+4);}
  ctx.strokeStyle="#0f766e"; ctx.lineWidth=3; ctx.beginPath(); arr.forEach((g,i)=> i?ctx.lineTo(X(g.d),Y(g.p)):ctx.moveTo(X(g.d),Y(g.p))); ctx.stroke();
  ctx.fillStyle="#0f766e"; arr.forEach(g=>{ctx.beginPath();ctx.arc(X(g.d),Y(g.p),4,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle="#334155"; ctx.font="13px system-ui"; ctx.fillText("% que pasa",12,20); ctx.fillText("Diámetro mm (log)",c.width/2-60,c.height-12);
}

function hydraulicAtWaterLevel(points, wl) {
  const pts = points.slice().sort((a,b)=>a.x-b.x);
  let A=0, P=0, T=0;
  for (let i=0; i<pts.length-1; i++) {
    const a=pts[i], b=pts[i+1], dx=b.x-a.x, dz=b.z-a.z;
    if (Math.abs(dx) < 1e-9) continue;
    const da=wl-a.z, db=wl-b.z;
    if (da>0 && db>0) { A += (da+db)*0.5*Math.abs(dx); P += Math.hypot(dx,dz); T += Math.abs(dx); }
    else if (da>0 || db>0) {
      const t = da/(da-db);
      const xi = a.x + t*dx;
      if (da>0) { const wetDx=Math.abs(xi-a.x); A += 0.5*da*wetDx; P += Math.hypot(wetDx, da); T += wetDx; }
      else { const wetDx=Math.abs(b.x-xi); A += 0.5*db*wetDx; P += Math.hypot(wetDx, db); T += wetDx; }
    }
  }
  const R = P > 0 ? A/P : 0;
  const hMean = T > 0 ? A/T : 0;
  return { A,P,T,R,hMean,wl };
}
function normalDepthFromGeometry(points, Q, n, S) {
  const minZ = Math.min(...points.map(p=>p.z));
  const maxZ = Math.max(...points.map(p=>p.z));
  let lo=minZ+1e-5, hi=maxZ + Math.max(2, (maxZ-minZ)*2);
  const qAt = wl => { const h=hydraulicAtWaterLevel(points, wl); return h.A>0 && h.R>0 ? (1/n)*h.A*Math.pow(h.R,2/3)*Math.sqrt(Math.max(S,0)) : 0; };
  let guard=0; while(qAt(hi)<Q && guard<30){ hi += Math.max(1, (hi-lo)*0.8); guard++; }
  for(let k=0;k<70;k++){ const mid=(lo+hi)/2; if(qAt(mid)<Q) lo=mid; else hi=mid; }
  const wl=(lo+hi)/2; const hyd=hydraulicAtWaterLevel(points, wl); return { ...hyd, y: wl-minZ, bedMin:minZ, Qcalc:qAt(wl) };
}
function trapezoidHydraulic(s) {
  const B=Math.max(0.001,s.manualB), y=Math.max(0.001,s.manualY), z=Math.max(0,s.zSide);
  const A = y*(B + z*y);
  const P = B + 2*y*Math.sqrt(1+z*z);
  const T = B + 2*z*y;
  const R = A/P;
  const Qcalc = (1/s.n)*A*Math.pow(R,2/3)*Math.sqrt(Math.max(s.slope,0));
  return { A,P,T,R,hMean:A/T,wl:s.bed+y,y,bedMin:s.bed,Qcalc };
}
function betaLL(Tr) { return 0.7929 + 0.0973 * Math.log10(Math.max(Tr, 1)); }
function zLL(Dm_mm) { const L=Math.log10(Math.max(Dm_mm,0.0001)); return 0.394557 - 0.04136*L - 0.00891*L*L; }
function phiLL(gammaMix) { return gammaMix <= 1 ? 1 : Math.max(0.1, -0.54 + 1.5143*gammaMix); }
function criticalVelocityRef(y, d50mm) { return 6.19 * Math.pow(Math.max(y,0.001),1/6) * Math.pow(Math.max(d50mm,0.05)/1000,1/3); }
function computeSection(s) {
  const Q=Math.max(0,s.q), S=Math.max(0,s.slope), n=Math.max(0.001,s.n);
  let hyd, source;
  if (s.points && s.points.length >= 2) { hyd = normalDepthFromGeometry(s.points, Q, n, S); source = "digitalizada"; }
  else { hyd = trapezoidHydraulic(s); source = "manual/trapecial"; }
  const A=hyd.A, R=hyd.R, Be=Math.max(0.001,hyd.T), y=Math.max(0.001,hyd.hMean || hyd.y), V=A>0?Q/A:0;
  const Fr = A>0 && Be>0 ? V / Math.sqrt(G*A/Be) : 0;
  const tau = state.globals.rhoW * G * R * S;
  const tauKg = tau / G;
  const d50m=Math.max(s.d50/1000,1e-6), dmm=Math.max((s.dm || s.d50)/1000,1e-6), d90m=Math.max(s.d90/1000,1e-6);
  const theta50 = tau / ((state.globals.rhoS-state.globals.rhoW)*G*d50m);
  const thetaDm = tau / ((state.globals.rhoS-state.globals.rhoW)*G*dmm);
  const Ks = 1/n;
  const Kr = 26 / Math.pow(d90m, 1/6);
  const rugFactor = state.globals.roughnessCorrection ? Math.pow(Ks/Kr, 1.5) : 1;
  const thetaEff = Math.max(0, thetaDm * rugFactor);
  const excess = Math.max(0, thetaEff - state.globals.thetaCrit);
  const qb = 8 * Math.pow(excess, 1.5) * Math.sqrt((state.globals.rhoS/state.globals.rhoW - 1) * G * Math.pow(dmm, 3)); // m2/s per width
  const Gs_m3s = qb * Be * state.globals.supplyFactor;
  const Gs_m3h = Gs_m3s * 3600;
  const Gs_tonh = Gs_m3h * state.globals.rhoS / 1000;
  const Vc = criticalVelocityRef(y, s.d50);
  const moving = thetaEff > state.globals.thetaCrit;

  const alpha = Q / (Be * Math.pow(y, 5/3));
  const beta = betaLL(state.globals.tr);
  const z = zLL(s.dm || s.d50);
  const phi = phiLL(state.globals.gammaMix);
  const mu = Math.max(0.1, s.mu || state.globals.mu || 1);
  const denom = Math.max(1e-9, 0.68 * beta * mu * phi * Math.pow(Math.max(s.dm || s.d50,0.0001), 0.28));
  const Hs = Math.pow((alpha * Math.pow(y,5/3))/denom, 1/(1+z));
  const baseScour = Math.max(0, Hs - y);
  const curveApplied = (s.isCurve && s.curveSide === "exterior") ? Math.max(1, s.curveFactor || 1) : 1;
  const scour = baseScour * curveApplied * state.globals.sfScour;
  const scouredBed = hyd.bedMin - scour;

  const sinuosityReduction = s.isCurve ? (s.curveFactor >= 1.25 ? 0.78 : s.curveFactor >= 1.12 ? 0.87 : 0.95) : 1;
  const stabilityIndex = thetaEff / state.globals.thetaCrit;
  return { key:s.key,id:s.id,distance:s.distance,dx:s.dx,source,isCurve:s.isCurve,curveSide:s.curveSide,curveFactor:s.curveFactor,Q,S,n,Be,y,A,P:hyd.P,R,V,Fr,tau,tauKg,theta50,thetaDm,thetaEff,stabilityIndex,Ks,Kr,rugFactor,Vc,moving,d50:s.d50,d84:s.d84,d90:s.d90,dm:s.dm,alpha,beta,z,phi,mu,Hs,baseScour,curveApplied,scour,scouredBed,bedMin:hyd.bedMin,waterLevel:hyd.wl,Qcalc:hyd.Qcalc,qb,Gs_m3s,Gs_m3h,Gs_tonh,sinuosityReduction,note:s.note||"" };
}
function runCalculations(goResults = true) {
  syncStateFromInputs();
  if (!state.sections.length) generateSections();
  state.results = state.sections.map(computeSection);
  renderResults();
  renderReportPreview();
  if (goResults) switchTab("results");
}

function renderResults() {
  const rs = state.results;
  if (!rs.length) { $("resultSummary").innerHTML=""; $("resultsTable").innerHTML=""; return; }
  const maxScour = maxBy(rs, r=>r.scour), maxSed=maxBy(rs,r=>r.Gs_tonh), maxV=maxBy(rs,r=>r.V), maxMob=maxBy(rs,r=>r.stabilityIndex);
  $("resultSummary").innerHTML = [
    [fmt(maxScour.scour,3),`Socavación máxima · ${maxScour.id}`],
    [fmt(maxSed.Gs_tonh,2),`Arrastre máximo ton/h · ${maxSed.id}`],
    [fmt(maxV.V,3),`Velocidad máxima m/s · ${maxV.id}`],
    [fmt(maxMob.stabilityIndex,2),`Índice movilidad θ/θc · ${maxMob.id}`]
  ].map(([a,b])=>`<div class="metric"><strong>${a}</strong><span>${b}</span></div>`).join("");
  renderWarnings();
  renderResultsTable();
  drawCharts();
}
function maxBy(arr, fn) { return arr.reduce((a,b)=>fn(b)>fn(a)?b:a, arr[0]); }
function renderWarnings() {
  const warns = [];
  if (state.results.some(r => r.source.includes("manual"))) warns.push("Hay secciones sin geometría digitalizada: se usó sección manual/trapecial.");
  if (state.results.some(r => r.isCurve && r.curveSide === "exterior")) warns.push("Hay tramos en curva con lado exterior: revise distribución lateral de velocidades, ribera externa y obras de protección.");
  if (state.results.some(r => r.Fr > 1)) warns.push("Se detecta flujo supercrítico en al menos una sección; revise supuestos de cálculo y régimen hidráulico.");
  if (state.results.some(r => r.moving)) warns.push("El criterio de Shields/MPM indica movilidad potencial del lecho en una o más secciones.");
  if (state.results.some(r => r.d50 < 0.2)) warns.push("D50 muy fino: si existe cohesión, las fórmulas no cohesivas pueden no representar correctamente la erosión.");
  $("warnings").innerHTML = warns.map(w=>`<div class="warning">${esc(w)}</div>`).join("");
}
function renderResultsTable() {
  const rows = state.results.map(r => `<tr>
    <td>${esc(r.id)}</td><td>${fmt(r.distance,1)}</td><td>${r.source}</td><td>${r.isCurve?`<span class="badge curve">${r.curveSide}</span>`:""}</td>
    <td>${fmt(r.Q,3)}</td><td>${fmt(r.Be,2)}</td><td>${fmt(r.y,3)}</td><td>${fmt(r.A,3)}</td><td>${fmt(r.R,4)}</td><td>${fmt(r.V,3)}</td><td>${fmt(r.Fr,3)}</td><td>${fmt(r.tau,2)}</td><td>${fmt(r.thetaEff,4)}</td><td>${r.moving?`<span class="badge warn">móvil</span>`:`<span class="badge ok">estable</span>`}</td>
    <td>${fmt(r.d50,3)}</td><td>${fmt(r.d84,3)}</td><td>${fmt(r.d90,3)}</td><td>${fmt(r.dm,3)}</td>
    <td>${fmt(r.qb,6)}</td><td>${fmt(r.Gs_tonh,3)}</td><td>${fmt(r.Gs_m3h,3)}</td>
    <td>${fmt(r.alpha,4)}</td><td>${fmt(r.beta,3)}</td><td>${fmt(r.z,3)}</td><td>${fmt(r.Hs,3)}</td><td>${fmt(r.baseScour,3)}</td><td>${fmt(r.scour,3)}</td><td>${fmt(r.scouredBed,3)}</td>
  </tr>`).join("");
  $("resultsTable").innerHTML = `<thead><tr><th>Sección</th><th>Dist.</th><th>Geom.</th><th>Curva</th><th>Q</th><th>Be</th><th>y</th><th>A</th><th>R</th><th>V</th><th>Fr</th><th>τ N/m²</th><th>θ ef.</th><th>Cond.</th><th>D50</th><th>D84</th><th>D90/Ds90</th><th>Dm</th><th>qb m²/s</th><th>Gs ton/h</th><th>Gs m³/h</th><th>α</th><th>β</th><th>z</th><th>Hs</th><th>Soc.base</th><th>Soc.ajust.</th><th>Fondo soc.</th></tr></thead><tbody>${rows}</tbody>`;
}
function drawCharts() {
  drawProfileChart();
  drawSedChart();
}
function drawProfileChart() {
  const c=$("profileCanvas"); if(!c || !state.results.length) return; const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  const rs=state.results, xs=rs.map(r=>r.distance), bed=rs.map(r=>r.bedMin), water=rs.map(r=>r.waterLevel), scour=rs.map(r=>r.scouredBed);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...scour)-0.2, maxY=Math.max(...water)+0.2, pad=56;
  const X=x=>pad+(x-minX)/(maxX-minX||1)*(c.width-2*pad), Y=y=>c.height-pad-(y-minY)/(maxY-minY||1)*(c.height-2*pad);
  chartGrid(ctx,c,pad);
  line(ctx,xs,bed,X,Y,"#334155",3); line(ctx,xs,water,X,Y,"#0284c7",2,[8,6]); line(ctx,xs,scour,X,Y,"#b42318",3);
  ctx.fillStyle="#0f172a"; ctx.font="16px system-ui"; ctx.fillText("Perfil longitudinal: fondo, eje hidráulico y fondo socavado",pad,28);
  legend(ctx, pad, c.height-22, [["Fondo","#334155"],["Agua","#0284c7"],["Fondo socavado","#b42318"]]);
}
function drawSedChart() {
  const c=$("sedCanvas"); if(!c || !state.results.length) return; const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  const rs=state.results, xs=rs.map(r=>r.distance), sed=rs.map(r=>r.Gs_tonh), soc=rs.map(r=>r.scour);
  const minX=Math.min(...xs), maxX=Math.max(...xs), maxY=Math.max(0.001,...sed,...soc), pad=56;
  const X=x=>pad+(x-minX)/(maxX-minX||1)*(c.width-2*pad), Y=y=>c.height-pad-y/maxY*(c.height-2*pad);
  chartGrid(ctx,c,pad); line(ctx,xs,sed,X,Y,"#0f766e",3); line(ctx,xs,soc,X,Y,"#b45309",3,[6,5]);
  ctx.fillStyle="#0f172a"; ctx.font="16px system-ui"; ctx.fillText("Transporte potencial y socavación ajustada",pad,28);
  legend(ctx,pad,c.height-22,[["Gs ton/h","#0f766e"],["Socavación m","#b45309"]]);
}
function chartGrid(ctx,c,pad){ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=pad+i*(c.height-2*pad)/5;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(c.width-pad,y);ctx.stroke();}}
function line(ctx,xs,ys,X,Y,color,w,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash);ctx.beginPath();xs.forEach((x,i)=>i?ctx.lineTo(X(x),Y(ys[i])):ctx.moveTo(X(x),Y(ys[i])));ctx.stroke();ctx.fillStyle=color;xs.forEach((x,i)=>{ctx.beginPath();ctx.arc(X(x),Y(ys[i]),4,0,Math.PI*2);ctx.fill();});ctx.restore();}
function legend(ctx,x,y,items){let off=0;ctx.font="13px system-ui";items.forEach(([t,c])=>{ctx.fillStyle=c;ctx.fillRect(x+off,y-10,22,4);ctx.fillStyle="#334155";ctx.fillText(t,x+off+28,y-5);off+=150;});}

function runMobileSimulation() {
  if (!state.results.length) runCalculations(false);
  const hours=Math.max(0.01,num("mobileHours",6)), dtH=Math.max(0.001,num("mobileDt",15)/60), por=state.globals.porosity;
  const upstream=Math.max(0,num("upstreamSupply",0)), maxDz=Math.max(0.001,num("maxDzStep",0.05));
  const bedChange = state.results.map(()=>0);
  const steps = Math.ceil(hours/dtH);
  for(let k=0;k<steps;k++){
    const supply = [upstream, ...state.results.map(r=>r.Gs_m3h)];
    state.results.forEach((r,i)=>{
      const Qin = supply[i], Qout = supply[i+1];
      const B=Math.max(0.01,r.Be), dx=Math.max(1,r.dx || (state.results[i+1]?.distance-r.distance) || 1);
      let dz = -((Qout-Qin)*dtH)/(Math.max(0.05,1-por)*B*dx);
      dz = clamp(dz, -maxDz, maxDz);
      bedChange[i] += dz;
    });
  }
  state.mobile = state.results.map((r,i)=>({ id:r.id,distance:r.distance,bedOriginal:r.bedMin,dz:bedChange[i],bedFinal:r.bedMin+bedChange[i],trend:bedChange[i]<-0.001?"erosión":bedChange[i]>0.001?"depósito":"estable" }));
  renderMobileResults();
  switchTab("mobile");
}
function renderMobileResults() {
  const ms=state.mobile; if(!ms.length) return;
  const min=maxBy(ms,m=>-m.dz), max=maxBy(ms,m=>m.dz);
  $("mobileSummary").innerHTML = `<div class="metric"><strong>${fmt(min.dz,3)}</strong><span>Mayor erosión · ${min.id}</span></div><div class="metric"><strong>${fmt(max.dz,3)}</strong><span>Mayor depósito · ${max.id}</span></div><div class="metric"><strong>${ms.filter(m=>m.trend==='erosión').length}</strong><span>Secciones con tendencia erosiva</span></div>`;
  $("mobileTable").innerHTML = `<thead><tr><th>Sección</th><th>Dist. m</th><th>Fondo inicial</th><th>Δz m</th><th>Fondo final</th><th>Tendencia</th></tr></thead><tbody>${ms.map(m=>`<tr><td>${m.id}</td><td>${fmt(m.distance,1)}</td><td>${fmt(m.bedOriginal,3)}</td><td>${fmt(m.dz,4)}</td><td>${fmt(m.bedFinal,3)}</td><td>${m.trend}</td></tr>`).join("")}</tbody>`;
  drawMobileChart();
}
function drawMobileChart(){const c=$("mobileCanvas"); if(!c || !state.mobile.length)return; const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);const xs=state.mobile.map(m=>m.distance), y0=state.mobile.map(m=>m.bedOriginal), y1=state.mobile.map(m=>m.bedFinal);const pad=48,minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...y0,...y1)-.1,maxY=Math.max(...y0,...y1)+.1;const X=x=>pad+(x-minX)/(maxX-minX||1)*(c.width-2*pad),Y=y=>c.height-pad-(y-minY)/(maxY-minY||1)*(c.height-2*pad);chartGrid(ctx,c,pad);line(ctx,xs,y0,X,Y,"#334155",3);line(ctx,xs,y1,X,Y,"#0f766e",3,[6,5]);ctx.fillStyle="#0f172a";ctx.font="15px system-ui";ctx.fillText("Tendencia de fondo por continuidad sólida",pad,26);}

function exportCSV() {
  if (!state.results.length) runCalculations(false);
  const headers = ["id","distance_m","source","curve","curve_side","Q_m3s","S","n","Be_m","y_m","A_m2","P_m","R_m","V_ms","Froude","tau_Nm2","theta_eff","moving","D50_mm","D84_mm","D90/Ds90_mm","Dm_mm","qb_m2s","Gs_m3h","Gs_tonh","alpha_LL","beta_LL","z_LL","Hs_m","scour_base_m","scour_adjusted_m","bed_scoured_m"];
  const lines = [headers.join(",")];
  state.results.forEach(r => lines.push([r.id,r.distance,r.source,r.isCurve,r.curveSide,r.Q,r.S,r.n,r.Be,r.y,r.A,r.P,r.R,r.V,r.Fr,r.tau,r.thetaEff,r.moving,r.d50,r.d84,r.d90,r.dm,r.qb,r.Gs_m3h,r.Gs_tonh,r.alpha,r.beta,r.z,r.Hs,r.baseScour,r.scour,r.scouredBed].join(",")));
  downloadText(lines.join("\n"), "hidrosed_maestra_resultados.csv", "text/csv");
}
function exportMobileCSV() {
  if (!state.mobile.length) runMobileSimulation();
  const lines = ["id,distance_m,bed_original_m,dz_m,bed_final_m,trend", ...state.mobile.map(m=>[m.id,m.distance,m.bedOriginal,m.dz,m.bedFinal,m.trend].join(","))];
  downloadText(lines.join("\n"), "hidrosed_maestra_lecho_movil.csv", "text/csv");
}
function exportJSON(){ downloadText(JSON.stringify(state,null,2), "hidrosed_maestra_proyecto.json", "application/json"); }
function importJSON(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{ const obj=JSON.parse(reader.result); state=obj; loadInputsFromState(); renderAll(); calculateGradation(); runCalculations(false); alert("Proyecto importado."); }catch(err){ alert("No se pudo importar: "+err.message); } }; reader.readAsText(file); }
function saveLocal(){ syncStateFromInputs(); localStorage.setItem("hidrosed-maestra", JSON.stringify(state)); alert("Proyecto guardado en este navegador."); }
function loadLocal(){ const raw=localStorage.getItem("hidrosed-maestra"); if(!raw) return alert("No hay proyecto guardado."); state=JSON.parse(raw); loadInputsFromState(); renderAll(); calculateGradation(); runCalculations(false); alert("Proyecto cargado."); }
function downloadText(text, filename, type){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

function methodologyText() {
  return `Metodología HidroSed Maestra\n\n1. Se define el tramo mediante N secciones transversales, separación entre perfiles y condición sin/con proyecto.\n2. Cada sección puede digitalizarse desde dibujo manual o imagen, o representarse mediante sección trapecial simplificada.\n3. La hidráulica se calcula con propiedades geométricas de la sección, ecuación de Manning, velocidad media, número de Froude y tensión de fondo.\n4. La granulometría se caracteriza con interpolación logarítmica de la curva, obteniendo D50, D84, D90/Ds90 y Dm.\n5. La movilidad y transporte de fondo se estiman con criterio de Shields y fórmula Meyer-Peter-Müller como capacidad potencial.\n6. La socavación general se estima con Lischtvan-Levediev, usando parámetros α, β, z, μ, φ y Dm, con ajuste preliminar por tramos en curva.\n7. El lecho móvil se aproxima mediante continuidad sólida tipo Exner entre secciones.\n8. Los resultados deben validarse con topografía, hidrología, inspección de rugosidad, antecedentes de terreno y criterio profesional.`;
}
function copyMethodology(){ navigator.clipboard?.writeText(methodologyText()).then(()=>alert("Metodología copiada.")); }
function exportReportHTML() {
  if (!state.results.length) runCalculations(false);
  const rows = state.results.map(r => `<tr><td>${esc(r.id)}</td><td>${fmt(r.distance,1)}</td><td>${r.source}</td><td>${fmt(r.V,3)}</td><td>${fmt(r.thetaEff,4)}</td><td>${fmt(r.Gs_tonh,3)}</td><td>${fmt(r.Hs,3)}</td><td>${fmt(r.scour,3)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Reporte HidroSed Maestra</title><style>body{font-family:Arial,sans-serif;margin:36px;color:#172033}h1,h2{color:#0f3b4a}table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#eef7f6}.box{background:#f8fafc;border:1px solid #ddd;padding:12px;border-radius:10px;margin:10px 0}</style><h1>Reporte HidroSed Maestra</h1><div class="box"><strong>Proyecto:</strong> ${esc(state.projectName)}<br><strong>Cauce:</strong> ${esc(state.riverName)}<br><strong>Ubicación:</strong> ${esc(state.locationName)}<br><strong>Condición:</strong> ${esc(state.condition)}<br><strong>Q:</strong> ${fmt(state.globals.q,3)} m³/s · <strong>Tr:</strong> ${fmt(state.globals.tr,0)} años · <strong>S:</strong> ${fmt(state.globals.S,5)} · <strong>n:</strong> ${fmt(state.globals.n,3)}</div><h2>Metodología resumida</h2><pre>${esc(methodologyText())}</pre><h2>Resultados por sección</h2><table><thead><tr><th>Sección</th><th>Distancia</th><th>Geometría</th><th>V m/s</th><th>θ ef.</th><th>Gs ton/h</th><th>Hs m</th><th>Socavación m</th></tr></thead><tbody>${rows}</tbody></table><h2>Advertencia</h2><p>Resultados preliminares. Requieren validación profesional, levantamiento topográfico, hidrología y modelación hidráulica formal cuando corresponda.</p></html>`;
  downloadText(html, "hidrosed_maestra_reporte.html", "text/html");
}
function renderReportPreview() {
  const rs = state.results || [];
  const maxScour = rs.length ? maxBy(rs,r=>r.scour) : null;
  const maxSed = rs.length ? maxBy(rs,r=>r.Gs_tonh) : null;
  $("reportPreview").innerHTML = `<div class="row"><strong>Proyecto</strong><span>${esc(state.projectName)}</span></div><div class="row"><strong>Cauce</strong><span>${esc(state.riverName)}</span></div><div class="row"><strong>Condición</strong><span>${esc(state.condition)}</span></div><div class="row"><strong>N secciones</strong><span>${state.sections.length}</span></div><div class="row"><strong>Socavación crítica</strong><span>${maxScour ? `${maxScour.id}: ${fmt(maxScour.scour,3)} m` : "-"}</span></div><div class="row"><strong>Transporte crítico</strong><span>${maxSed ? `${maxSed.id}: ${fmt(maxSed.Gs_tonh,3)} ton/h` : "-"}</span></div>`;
}

function renderChecklist() {
  $("dgaChecklist").innerHTML = dgaItems.map(([a,b]) => `<div class="check-item"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("");
}
function tutorialHTML() {
  return `<section><h3>1. Crear el proyecto</h3><ol><li>Complete nombre, cauce, ubicación, condición y caudal.</li><li>Seleccione un caso base PASM 157 o mantenga valores personalizados.</li><li>Genere N secciones y revise la separación Δx.</li></ol></section><section><h3>2. Construir secciones</h3><ol><li>En la pestaña Secciones edite Q, pendiente, Manning, ancho, tirante, taludes y fondo.</li><li>Marque los tramos en curva y defina si la sección está en lado interior, eje o exterior.</li><li>Use el botón Dibujar para pasar al digitalizador.</li></ol></section><section><h3>3. Digitalizar desde imagen o dibujo</h3><ol><li>Cargue una imagen de la sección o dibuje a mano alzada.</li><li>Defina escala horizontal, vertical y cota base.</li><li>Guarde la geometría. La app usará esa geometría para calcular el área, perímetro y profundidad normal.</li></ol></section><section><h3>4. Granulometría y diámetros</h3><ol><li>Ingrese la curva diámetro/% que pasa.</li><li>Revise D50, D84, D90/Ds90 y Dm.</li><li>Presione Aplicar a secciones para usar esos diámetros en las fórmulas.</li></ol></section><section><h3>5. Cálculo e interpretación</h3><ol><li>Revise métodos y parámetros físicos.</li><li>Presione Calcular todo.</li><li>Analice velocidades, Froude, tensión de fondo, movilidad, transporte MPM y socavación LL.</li><li>Exporte CSV, JSON o reporte HTML.</li></ol></section><section><h3>6. Buen uso técnico</h3><p>Use esta herramienta como apoyo de revisión y predimensionamiento. Para presentación formal se requiere respaldo topográfico, hidrológico, criterios de rugosidad, memoria de cálculo y revisión profesional.</p></section>`;
}
function fillTutorial() { const html=tutorialHTML(); $("tutorialContent").innerHTML = html; $("tutorialDialogContent").innerHTML = html; }

function esc(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

init();
