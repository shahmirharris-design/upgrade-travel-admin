'use strict';
/* Preview bootstrap: the customer renderer boots in preview mode — no Supabase,
   the itinerary arrives from the admin host by postMessage. */
window.UT_SB = { url: 'https://preview.invalid', anon: 'preview', contact: '#' };
window.supabase = { createClient: function () { return { auth: { onAuthStateChange: function () { return { data: { subscription: {} } }; }, getSession: function () { return Promise.resolve({ data: { session: null } }); } } }; } };
window.addEventListener('message', function (ev) {
  var d = ev.data || {};
  if (d.type !== 'bv-render' || !d.payload || window.UT_ITIN_PREVIEW) return;
  window.UT_ITIN_PREVIEW = d.payload; /* { settings, profile, itinerary } */
  if (/[?&]mode=doc/.test(location.search)) window.UT_ITIN_PREVIEW.mode = 'doc';
  /* async=false scripts execute in the order they are added: d3 → land data → renderer */
  ['https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', 'globe-land.js', 'account.js'].forEach(function (src) {
    var s = document.createElement('script');
    s.src = src; s.async = false;
    document.body.appendChild(s);
  });
});
window.addEventListener('DOMContentLoaded', function () {
  try { window.parent.postMessage({ type: 'bv-preview-ready' }, '*'); } catch (e) { }
});
