// Service worker: deixa o app funcionar offline (cache-first para o app,
// rede-first para a busca de alimentos)
const CACHE = 'imc-pro-v5';

const ARQUIVOS_BASE = [
    '.',
    'index.html',
    'style.css',
    'script.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (evento) {
    evento.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.addAll(ARQUIVOS_BASE); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (evento) {
    evento.waitUntil(
        caches.keys()
            .then(function (chaves) {
                return Promise.all(chaves
                    .filter(function (chave) { return chave !== CACHE; })
                    .map(function (chave) { return caches.delete(chave); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (evento) {
    if (evento.request.method !== 'GET') return;

    const url = new URL(evento.request.url);

    // Busca de alimentos: sempre tenta a rede primeiro (dados dinâmicos)
    if (url.hostname.indexOf('openfoodfacts.org') !== -1) {
        evento.respondWith(
            fetch(evento.request).catch(function () {
                return caches.match(evento.request);
            })
        );
        return;
    }

    // App e fontes: cache primeiro, rede como reserva (e guarda no cache)
    evento.respondWith(
        caches.match(evento.request).then(function (emCache) {
            if (emCache) return emCache;
            return fetch(evento.request).then(function (resposta) {
                if (resposta && resposta.ok) {
                    const copia = resposta.clone();
                    caches.open(CACHE).then(function (cache) {
                        cache.put(evento.request, copia);
                    });
                }
                return resposta;
            });
        })
    );
});
