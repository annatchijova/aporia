import fs from 'node:fs';

const target = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json()).then(items => items.find(item => item.type === 'page'));
if (!target) throw new Error('No Chrome page target');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (waiter) { pending.delete(message.id); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); }
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__aporiaCalls=[]; const originalFetch=window.fetch.bind(window); window.fetch=(...args)=>{window.__aporiaCalls.push(String(args[0])); return originalFetch(...args)};` });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/?mode=demo' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
await delay(500);
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const actions = [
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Entrar a la sala')).click()`,
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Sumarme como participante')).click()`,
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Ver captura de ejemplo')).click()`,
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Ver lectura de ejemplo')).click()`,
  `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Confirmar mi aporte')).click()`,
];
for (const action of actions) { await evaluate(action); await delay(100); }
const report = await evaluate(`JSON.stringify({title:document.querySelector('.demo-room-heading h1')?.textContent, sampleLabel:document.querySelector('.demo-simulated-label')?.textContent, result:document.querySelector('.demo-result')?.textContent, feasible:document.querySelector('.demo-plan.is-feasible h3')?.textContent, imageLoaded:document.querySelector('.demo-image-card img')?.naturalWidth>0, requests:window.__aporiaCalls, body:document.body.innerText})`);
const parsed = JSON.parse(report);
if (!parsed.sampleLabel?.includes('no es una respuesta de Gemini')) throw new Error('Sample interpretation label missing');
if (!parsed.result?.includes('Hay una opción')) throw new Error('Deterministic plan result missing');
if (!parsed.imageLoaded) throw new Error('Synthetic screenshot fixture did not load');
if (parsed.requests.some(url => url.includes('/api/') || url.includes('generativelanguage.googleapis.com'))) throw new Error('Demo attempted a provider or room API request');
const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync('/tmp/aporia-demo-flow.png', Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify({ title: parsed.title, sampleLabel: parsed.sampleLabel, result: parsed.result, feasible: parsed.feasible, imageLoaded: parsed.imageLoaded, fetchRequests: parsed.requests }, null, 2));
socket.close();
