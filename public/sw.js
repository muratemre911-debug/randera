/* Randera Service Worker
 * ---------------------------------------------------------------------------
 * Görevleri:
 *  1. Uygulama kabuğunu ve statik varlıkları önbelleğe alıp PWA'nın çevrimdışı
 *     açılabilmesini sağlamak (Chrome'un kurulabilirlik şartı da budur).
 *  2. Push bildirimlerini göstermek ve doğru sayfaya yönlendirmek.
 *
 * Strateji özeti:
 *  - /_next/static/*  → cache-first (içerik hash'li, asla değişmez)
 *  - gezinme (HTML)   → network-first + 4sn zaman aşımı → önbellek → /offline
 *  - /api/*           → asla önbelleğe alınmaz (kullanıcıya özel veri)
 *  - diğer aynı köken GET → stale-while-revalidate
 *  - farklı köken (Supabase, harita karoları) → dokunulmaz
 */

const VERSION = "v4";
const STATIC_CACHE = `randera-static-${VERSION}`;
const PAGE_CACHE = `randera-pages-${VERSION}`;

/** Kurulumda hemen önbelleğe alınan varlıklar. */
const PRECACHE = [
  "/offline.html",
  "/theme-init.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/badge.png",
  "/favicon.ico",
];

/** Gezinme isteklerinde ağ için beklenecek en uzun süre. */
const NAV_TIMEOUT = 4000;

const isDevHost = () =>
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!isDevHost()) {
        const cache = await caches.open(PAGE_CACHE);
        // Tek tek ekle: biri 404 olursa kurulum tümden düşmesin.
        await Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
          ),
        );
        const staticCache = await caches.open(STATIC_CACHE);
        await staticCache.add(
          new Request("/icon-192.png", { cache: "reload" }),
        ).catch(() => {});
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => isDevHost() || !key.endsWith(`-${VERSION}`))
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        // Yavaş ağlarda gezinmeyi hızlandırır; ağ hatasında sessizce yok sayılır.
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })(),
  );
});

/** Sayfadan gelen mesajlar (ör. yeni sürüme geç). */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isSameOrigin = (url) => url.origin === self.location.origin;

const isApi = (url) => url.pathname.startsWith("/api/");

/** Next.js build çıktısı ve diğer değişmez varlıklar. */
const isImmutable = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?|ttf|otf|css|js)$/.test(
    url.pathname,
  );

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Yalnızca GET; ayrıca yalnızca aynı köken.
  if (request.method !== "GET") return;

  // Geliştirme ortamında (localhost) hiçbir JS/CSS/sayfa önbellekten dönmemeli.
  if (isDevHost()) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!isSameOrigin(url)) return;

  // Kullanıcıya özel API yanıtları asla önbellekten gelmemeli.
  if (isApi(url)) return;

  // Auth callback / Supabase yönlendirmeleri her zaman canlı olmalı.
  if (url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

/**
 * Gezinme: ağ önce (zaman aşımıyla), sonra önbellek, en son çevrimdışı sayfa.
 *
 * ÖNEMLİ: Ağdan gelen yanıt `ok` olmasa bile AYNEN döndürülür. Uygulama
 * oturum yönlendirmelerini (307 → /login) bu şekilde yapar; istek
 * `redirect: "manual"` modunda geldiği için yanıt `opaqueredirect` olur
 * (status 0). Bunu hata sayıp çevrimdışı sayfaya düşmek, giriş yapmamış
 * kullanıcıyı 503 ekranına hapsederdi.
 */
async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);

  let response = null;
  try {
    response = await withTimeout(fetch(request), NAV_TIMEOUT);
  } catch {
    response = null;
  }

  if (response) {
    // Yalnızca başarılı ve yönlendirilmemiş HTML yanıtları saklanır.
    if (response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }

  const cached = await cache.match(request);
  if (cached) return cached;

  // Aynı sayfanın sorgusuz hali (ör. ?utm=...) önbellekte olabilir.
  try {
    const bare = await cache.match(new URL(request.url).pathname);
    if (bare) return bare;
  } catch {
    /* geçersiz URL: önbellek aramasını atla */
  }

  const offline =
    (await cache.match("/offline.html")) ||
    (await cache.match("/offline"));
  if (offline) return offline;

  return new Response("Çevrimdışısınız.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/* --------------------------------------------------------------------------
 * Push bildirimleri
 * ------------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Randera", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Randera";
  const options = {
    body: data.body || "",
    // 4.6MB'lık logoyu bildirim simgesi olarak kullanmak mobilde çok yavaş;
    // 192px'lik üretilmiş ikon kullanılır.
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/badge.png",
    vibrate: data.vibrate || [90, 60, 90],
    tag: data.tag || "randera",
    renotify: true,
    data: {
      url: data.url || "/",
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(
    (async () => {
      // Uygulama ön planda açıksa banner göstermek yerine sayfaya haber ver.
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visible = clientList.find((c) => c.visibilityState === "visible");
      if (visible) {
        visible.postMessage({ type: "PUSH_RECEIVED", payload: data });
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Aynı uygulama zaten açıksa onu öne getir ve hedefe yönlendir.
      for (const client of clientList) {
        if (!("focus" in client)) continue;
        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(target);
          } catch {
            /* yok sayılır */
          }
        }
        return;
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
