const MODEL_URL = "./modelo/model.json";
const META_URL = "./modelo/metadata.json";
const HIST_KEY = "historial-clasificador";
// Mensajes de salida: edítalos a tu gusto
const MSG_MATCH = (clase, pct) => "¡Es " + clase + "! (" + pct + "% de seguridad)";
const MSG_NO_MATCH = "No lo tengo claro. Prueba con otra imagen.";

let model, webcam, rafId = null, running = false, lastLabel = null;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const setStatus = t => { $("status").textContent = t; };

async function loadModel() {
  if (!model) {
    setStatus("Cargando modelo…");
    model = await tmImage.load(MODEL_URL, META_URL);
    setStatus("");
  }
  return model;
}

async function start() {
  if (running) return;
  $("btnStart").disabled = true;
  try {
    await loadModel();
    webcam = new tmImage.Webcam(320, 320, true);
    await webcam.setup();
    await webcam.play();
    $("cam").innerHTML = "";
    $("cam").appendChild(webcam.canvas);
    running = true;
    $("btnStop").disabled = false;
    rafId = requestAnimationFrame(loop);
  } catch (e) {
    setStatus("No se pudo iniciar: " + e.message);
    $("btnStart").disabled = false;
  }
}

async function loop() {
  if (!running) return;
  webcam.update();
  const preds = await model.predict(webcam.canvas);
  showResult(preds, true);
  rafId = requestAnimationFrame(loop);
}

function stop() {
  running = false;
  cancelAnimationFrame(rafId);
  if (webcam) webcam.stop();
  $("cam").innerHTML = "<p>Cámara detenida</p>";
  $("btnStart").disabled = false;
  $("btnStop").disabled = true;
  lastLabel = null;
}

function showResult(preds, fromCam) {
  const min = Number($("threshold").value) / 100;
  const best = preds.reduce((a, b) => (b.probability > a.probability ? b : a));
  $("bars").innerHTML = preds.map(p => {
    const pct = Math.round(p.probability * 100);
    return '<div class="bar"><div class="label"><span>' + esc(p.className) + "</span><span>" + pct +
      '%</span></div><div class="track"><div class="fill" style="width:' + pct + '%"></div></div></div>';
  }).join("");

  const msg = $("message");
  if (best.probability >= min) {
    const pct = Math.round(best.probability * 100);
    msg.textContent = MSG_MATCH(best.className, pct);
    msg.className = "ok";
    if (!fromCam || best.className !== lastLabel) addHistory(best.className, pct, fromCam ? "cámara" : "imagen subida");
    lastLabel = best.className;
  } else {
    msg.textContent = MSG_NO_MATCH;
    msg.className = "no";
    lastLabel = null;
  }
}

$("file").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (running) stop();
    await loadModel();
    const img = new Image();
    img.onload = async () => {
      $("cam").innerHTML = "";
      $("cam").appendChild(img);
      showResult(await model.predict(img), false);
    };
    img.src = URL.createObjectURL(f);
  } catch (err) {
    setStatus("No se pudo analizar la imagen: " + err.message);
  }
  e.target.value = "";
});

// Histórico (se guarda en el navegador)
function loadHist() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; }
}
function saveHist(h) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {}
}
function addHistory(label, pct, origin) {
  const h = loadHist();
  h.unshift({ label, pct, origin, time: new Date().toLocaleString("es-ES") });
  h.splice(50);
  saveHist(h);
  renderHistory(h);
}
function renderHistory(h = loadHist()) {
  $("history").innerHTML = h.length
    ? h.map(x => "<li><span>" + esc(x.label) + " (" + x.pct + "%)</span><small>" + esc(x.origin) + " · " + esc(x.time) + "</small></li>").join("")
    : '<li class="empty">Aún no hay resultados guardados.</li>';
}

$("btnStart").addEventListener("click", start);
$("btnStop").addEventListener("click", stop);
$("btnClear").addEventListener("click", () => { saveHist([]); renderHistory([]); });
$("threshold").addEventListener("input", e => { $("thValue").textContent = e.target.value; });
renderHistory();