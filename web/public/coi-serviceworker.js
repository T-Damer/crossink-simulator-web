const COOP = "same-origin";
const COEP = "require-corp";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.status === 0) return response;

      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", COOP);
      headers.set("Cross-Origin-Embedder-Policy", COEP);
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    }),
  );
});
