// Unregister any active service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (var registration of registrations) {
      registration.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (var name of names) {
      caches.delete(name);
    }
  });
}
