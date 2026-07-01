// Synchronous initial listeners to satisfy Chrome's strict evaluation checks
self.addEventListener('message', (event) => {
  // Empty listener to keep Chrome happy on initial worker script evaluation
});
self.addEventListener('push', (event) => {
  // Empty push listener
});
