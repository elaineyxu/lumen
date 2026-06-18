/* ============================================================
   LUMEN — local backend API helper
   ============================================================ */
(function () {
  function backendRequiredMessage() {
    return 'Lumen backend is not connected. Start the server with `node server/index.js` and open http://127.0.0.1:8787 instead of a file or static prototype.';
  }

  async function request(path, options) {
    if (window.location.protocol === 'file:') {
      throw new Error(backendRequiredMessage());
    }
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...((options && options.headers) || {}) },
      ...(options || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || ('Request failed: HTTP ' + response.status));
    }
    return payload;
  }

  const api = {
    getWorkspace() {
      return request('/api/workspace');
    },
    getKnowledge() {
      return request('/api/knowledge');
    },
    getCompileRuns() {
      return request('/api/compile-runs');
    },
    createMap(question) {
      return request('/api/maps', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
    },
    renameMap(mapId, title) {
      return request('/api/maps/' + encodeURIComponent(mapId), {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
    },
    deleteMap(mapId) {
      return request('/api/maps/' + encodeURIComponent(mapId), { method: 'DELETE' });
    },
    captureInbox(item) {
      return request('/api/inbox', {
        method: 'POST',
        body: JSON.stringify({ item }),
      });
    },
    digestInbox(id, mapId) {
      return request('/api/inbox/' + encodeURIComponent(id) + '/digest', {
        method: 'POST',
        body: JSON.stringify({ mapId }),
      });
    },
    dismissInbox(id) {
      return request('/api/inbox/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    applyReview(runId, payload) {
      return request('/api/reviews/' + encodeURIComponent(runId) + '/apply', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
    },
    getAiSettings() {
      return request('/api/settings/ai');
    },
    saveAiSettings(settings) {
      return request('/api/settings/ai', {
        method: 'POST',
        body: JSON.stringify(settings || {}),
      });
    },
  };

  window.LumenApi = api;
})();
