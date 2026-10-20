/* Keeps the whole app on the device so it opens without internet.
   With internet, the app page is fetched fresh first (so updates show immediately); without it, the saved copy opens. */
const VERSION = "cb-v4.20";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
/* the PDF reader (used only for bill PDFs on purchases): kept offline too, but the app still installs if these files are missing */
const EXTRA = ["./cb-pdf.js", "./cb-pdf-worker.js"];
const keepExtra = async c => { for (const f of EXTRA) { try { const old = await caches.match(f, { ignoreSearch: true }); if (old) await c.put(f, old.clone()); else await c.add(f); } catch (err) {} } };
self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES).then(() => keepExtra(c))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
function fresh(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("slow")), ms);
    fetch(req, { cache: "no-store" }).then(r => { clearTimeout(t); r.ok ? resolve(r) : reject(new Error("bad")); }, err => { clearTimeout(t); reject(err); });
  });
}
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  if (/\/revoked\.json$/.test(new URL(e.request.url).pathname)) return;   /* list of cancelled plan codes: always from the internet */
  const isPage = e.request.mode === "navigate" || /\/(index\.html)?$/.test(new URL(e.request.url).pathname);
  e.respondWith(caches.open(VERSION).then(async c => {
    if (isPage) {
      try { const r = await fresh(e.request, 4000); c.put("./index.html", r.clone()); return r; }
      catch (err) { return (await c.match("./index.html")) || new Response("Offline", { status: 503 }); }
    }
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || new Response("Offline", { status: 503 });
  }));
});
