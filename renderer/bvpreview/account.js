/* Upgrade Travel — customer account portal (Supabase Auth + bookings + profile).
   Expects window.UT_SB = { url, anon, contact } and the supabase-js UMD global.
   All DOM is built with createElement + textContent (no innerHTML) to avoid XSS. */
(function () {
  var root = document.getElementById('ut-account');
  if (!root) return;

  /* empty-state icon chip (inline SVG, brand gold) */
  function emptyIc(kind) {
    function svp(paths) { return sv('svg', { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, paths); }
    var icons = {
      trips: [sv('rect', { x: 2, y: 7, width: 20, height: 14, rx: 2 }), sv('path', { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' })],
      quotes: [sv('path', { d: 'M12 2v20' }), sv('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })],
      invoices: [sv('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }), sv('polyline', { points: '14 2 14 8 20 8' }), sv('path', { d: 'M8 13h8' }), sv('path', { d: 'M8 17h5' })]
    };
    return h('span', { class: 'acct-empty-ic' }, [svp(icons[kind] || icons.trips)]);
  }
  /* ---------- safe DOM builder ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else if (k === 'selected') e.selected = !!v;
      else if (k === 'disabled' || k === 'required' || k === 'novalidate') { if (v) e.setAttribute(k, ''); }
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return e;
  }
  function mount(node) { root.textContent = ''; root.appendChild(node); }
  function field(labelText, attrs, hint) {
    var kids = [labelText, h('input', attrs)];
    if (hint) kids.push(h('span', { class: 'acct-hint', text: hint }));
    return h('label', null, kids);
  }
  function customSelect(labelText, name, value, opts) {
    var sel = opts.filter(function (o) { return !o.divider && o.v === (value || ''); })[0] || opts.filter(function (o) { return !o.divider; })[0];
    var hidden = h('input', { type: 'hidden', name: name, value: value || '' });
    var btn = h('button', { type: 'button', class: 'ut-select-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, [
      h('span', { class: 'ut-select-val', text: sel ? sel.l : '' }), h('span', { class: 'ut-select-chev', 'aria-hidden': 'true' })
    ]);
    var list = h('div', { class: 'ut-select-list', role: 'listbox', 'data-lenis-prevent': '' }, opts.map(function (o) {
      if (o.divider) return h('div', { class: 'ut-select-sep' });
      return h('div', { class: 'ut-select-opt' + (o.v === (value || '') ? ' is-sel' : ''), role: 'option', 'data-val': o.v, text: o.l });
    }));
    return h('div', { class: 'ut-select-label' }, [h('span', { class: 'ut-select-labeltext', text: labelText }), h('div', { class: 'ut-select' }, [hidden, btn, list])]);
  }
  function flagEmoji(iso) { return (iso || '').toUpperCase().replace(/[A-Z]/g, function (c) { return String.fromCodePoint(127397 + c.charCodeAt(0)); }); }
  var STATES = {
    US: 'AL Alabama,AK Alaska,AZ Arizona,AR Arkansas,CA California,CO Colorado,CT Connecticut,DE Delaware,DC District of Columbia,FL Florida,GA Georgia,HI Hawaii,ID Idaho,IL Illinois,IN Indiana,IA Iowa,KS Kansas,KY Kentucky,LA Louisiana,ME Maine,MD Maryland,MA Massachusetts,MI Michigan,MN Minnesota,MS Mississippi,MO Missouri,MT Montana,NE Nebraska,NV Nevada,NH New Hampshire,NJ New Jersey,NM New Mexico,NY New York,NC North Carolina,ND North Dakota,OH Ohio,OK Oklahoma,OR Oregon,PA Pennsylvania,RI Rhode Island,SC South Carolina,SD South Dakota,TN Tennessee,TX Texas,UT Utah,VT Vermont,VA Virginia,WA Washington,WV West Virginia,WI Wisconsin,WY Wyoming',
    CA: 'AB Alberta,BC British Columbia,MB Manitoba,NB New Brunswick,NL Newfoundland and Labrador,NS Nova Scotia,NT Northwest Territories,NU Nunavut,ON Ontario,PE Prince Edward Island,QC Quebec,SK Saskatchewan,YT Yukon',
    AU: 'ACT Australian Capital Territory,NSW New South Wales,NT Northern Territory,QLD Queensland,SA South Australia,TAS Tasmania,VIC Victoria,WA Western Australia'
  };
  function stateOpts(iso) {
    if (!STATES[iso]) return null;
    return [{ v: '', l: 'Select' }].concat(STATES[iso].split(',').map(function (s) { var i = s.indexOf(' '); return { v: s.slice(0, i), l: s.slice(i + 1) }; }));
  }
  function isoCountries() {
    var data = (window.intlTelInputGlobals && window.intlTelInputGlobals.getCountryData) ? window.intlTelInputGlobals.getCountryData() : [];
    var byIso = {};
    data.forEach(function (c) { byIso[c.iso2.toUpperCase()] = c.name.replace(/\s*\(.+\)\s*$/, ''); });
    return byIso;
  }
  function countryOpts() {
    var byIso = isoCountries(), top = ['US', 'CA', 'GB', 'AU'];
    var opts = [{ v: '', l: 'Select country' }];
    top.forEach(function (iso) { if (byIso[iso]) opts.push({ v: iso, l: flagEmoji(iso) + '  ' + byIso[iso] }); });
    if (Object.keys(byIso).length) opts.push({ divider: true });
    Object.keys(byIso).filter(function (iso) { return top.indexOf(iso) === -1; })
      .sort(function (a, b) { return byIso[a].localeCompare(byIso[b]); })
      .forEach(function (iso) { opts.push({ v: iso, l: flagEmoji(iso) + '  ' + byIso[iso] }); });
    return opts;
  }
  function addrDynamic(iso, p) {
    var sOpts = stateOpts(iso);
    var sLabel = iso === 'CA' ? 'Province / Territory' : iso === 'AU' ? 'State / Territory' : iso === 'GB' ? 'County' : 'State / Region';
    var pLabel = iso === 'US' ? 'ZIP code' : (iso === 'GB' || iso === 'AU') ? 'Postcode' : 'Postal code';
    var stateField = sOpts ? customSelect(sLabel, 'address_state', p.address_state, sOpts) : field(sLabel, { name: 'address_state', type: 'text', value: p.address_state || '' });
    return h('div', { class: 'acct-row3' }, [
      field('City', { name: 'address_city', type: 'text', value: p.address_city || '' }),
      stateField,
      field(pLabel, { name: 'address_postal', type: 'text', value: p.address_postal || '' })
    ]);
  }
  function fetchIpCountry() {
    if (state.ipCountry) return;
    fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (d) { if (d && d.country_code) state.ipCountry = d.country_code.toUpperCase(); }).catch(function () {});
  }
  function closeAllSelects(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.ut-select.is-open'), function (s) {
      if (s !== except) { s.classList.remove('is-open'); var b = s.querySelector('.ut-select-btn'); if (b) b.setAttribute('aria-expanded', 'false'); }
    });
  }
  function msgBox() { return h('div', { class: 'acct-msg', style: 'display:none' }); }

  if (!window.UT_SB || !window.supabase || !window.supabase.createClient) {
    mount(h('div', { class: 'acct-card' }, h('p', { class: 'acct-msg err', style: 'display:block', text: 'Account service is unavailable right now. Please try again later.' })));
    return;
  }
  var sb = window.supabase.createClient(UT_SB.url, UT_SB.anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var ACCOUNT_URL = window.location.origin + window.location.pathname;
  var CONTACT = (UT_SB && UT_SB.contact) || '/contact/';
  var state = { profile: null, bookings: null };
  var SECTIONS = [
    ['overview', 'Overview'], ['trips', 'My trips'], ['quotes', 'My quotes'], ['invoices', 'Invoices'],
    ['profile', 'Profile'], ['security', 'Account & security']
  ];
  var SAVE_FIELDS = ['title', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'phone',
    'address_line', 'address_city', 'address_state', 'address_postal', 'address_country',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship', 'emergency_contact_relationship_other',
    'passport_number', 'passport_expiry', 'nationality', 'country_of_residence', 'known_traveler_number', 'redress_number',
    'cabin_pref', 'seat_pref', 'meal_pref', 'frequent_flyer'];

  /* ---------- formatters ---------- */
  function curSymbol(cur) { return cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : cur === 'AED' ? 'AED ' : '$'; }
  function money(n, cur) {
    if (n == null || n === '' || isNaN(n)) return '';
    var sym = curSymbol(cur);
    return sym + Math.round(Number(n)).toLocaleString('en-US');
  }
  function fmtDate(s) {
    if (!s) return '';
    var d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { var pp = s.split('-'); d = new Date(+pp[0], +pp[1] - 1, +pp[2]); }
    else d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function initials(p) { return ((p.first_name || '?').charAt(0) + (p.last_name || '').charAt(0)).toUpperCase(); }
  function avatarNode(p, cls) {
    var span = h('span', { class: 'acct-avatar' + (cls ? ' ' + cls : '') + (p.avatar_url ? ' acct-avatar--img' : '') });
    if (p.avatar_url) span.appendChild(h('img', { src: p.avatar_url, alt: '' }));
    else span.textContent = initials(p);
    return span;
  }
  function setBusy(formEl, busy, label) {
    var btn = formEl.querySelector('button[type=submit]'); if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Working…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }
  function msg(formEl, text, kind) {
    var box = formEl.querySelector('.acct-msg'); if (!box) return;
    box.textContent = text || ''; box.className = 'acct-msg' + (kind ? ' ' + kind : ''); box.style.display = text ? 'flex' : 'none';
  }
  function updatePwUI(form) {
    var pw = form.querySelector('[name=password]'), pw2 = form.querySelector('[name=password2]');
    var confirmWrap = form.querySelector('.acct-confirm'), reqs = form.querySelector('.acct-reqs');
    if (!pw || !reqs) return;
    var v = pw.value;
    if (confirmWrap && v.length > 0) confirmWrap.hidden = false;
    function set(n, ok) { var li = reqs.querySelector('[data-req=' + n + ']'); if (li) li.classList.toggle('is-met', ok); }
    set('len', v.length >= 6); set('upper', /[A-Z]/.test(v)); set('num', /[0-9]/.test(v));
    set('match', !!(pw2 && pw2.value.length > 0 && pw2.value === v));
  }
  function pwError(pw, pw2) {
    pw = pw || '';
    if (pw.length < 6) return 'Password must be at least 6 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password needs at least one capital letter.';
    if (!/[0-9]/.test(pw)) return 'Password needs at least one number.';
    if (pw !== pw2) return 'Passwords don’t match.';
    return null;
  }
  function pwBlock(submitLabel, withCurrent) {
    var items = [];
    if (withCurrent) items.push(field('Current password', { name: 'current_password', type: 'password', autocomplete: 'current-password', required: true }));
    items.push(field(withCurrent ? 'New password' : 'Password', { name: 'password', type: 'password', autocomplete: 'new-password', minlength: '6', required: true }));
    var c = field('Confirm password', { name: 'password2', type: 'password', autocomplete: 'new-password', minlength: '6' }); c.className = 'acct-confirm'; c.hidden = true;
    items.push(c);
    items.push(h('ul', { class: 'acct-reqs' }, [
      h('li', { 'data-req': 'len' }, [h('span', { class: 'req-dot' }), 'At least 6 characters']),
      h('li', { 'data-req': 'upper' }, [h('span', { class: 'req-dot' }), 'One capital letter']),
      h('li', { 'data-req': 'num' }, [h('span', { class: 'req-dot' }), 'One number']),
      h('li', { 'data-req': 'match' }, [h('span', { class: 'req-dot' }), 'Passwords match'])
    ]));
    items.push(msgBox());
    items.push(h('button', { type: 'submit', class: 'btn btn-primary acct-btn', text: submitLabel }));
    return items;
  }
  function initPickers(scope) {
    if (!window.flatpickr) return;
    Array.prototype.forEach.call(scope.querySelectorAll('.acct-date'), function (el) {
      if (el._flatpickr) return;
      var opts = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'M j, Y', allowInput: true };
      if (el.getAttribute('data-dob')) opts.maxDate = 'today';
      window.flatpickr(el, opts);
    });
  }
  function initPhones(scope) {
    if (!window.intlTelInput) return;
    Array.prototype.forEach.call(scope.querySelectorAll('.acct-phone'), function (el) {
      if (el._iti) return;
      var iti = window.intlTelInput(el, {
        initialCountry: 'auto', separateDialCode: true, autoPlaceholder: 'aggressive',
        geoIpLookup: function (cb) { fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (d) { cb((d && d.country_code) || 'us'); }).catch(function () { cb('us'); }); },
        utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js'
      });
      el._iti = iti;
      var cl = el.parentNode && el.parentNode.querySelector('.iti__country-list');
      if (cl) cl.setAttribute('data-lenis-prevent', '');
      el.addEventListener('blur', function () { var n = iti.getNumber && iti.getNumber(); if (n) iti.setNumber(n); });
    });
  }

  /* ---------- auth views (signed out) ---------- */
  function viewLoading() {
    mount(h('div', { class: 'acct-card acct-loading' }, [h('span', { class: 'acct-spin', 'aria-hidden': 'true' }), h('p', { text: 'Loading your account…' })]));
  }
  function viewAuth(mode) {
    mode = mode || 'signin';
    var card = h('div', { class: 'acct-card' });
    card.appendChild(h('h2', { class: 'acct-title', text: mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset password' : 'Welcome back' }));
    card.appendChild(h('p', { class: 'acct-sub', text: mode === 'signup' ? 'Track your trips and see everything you’ve saved.' : mode === 'forgot' ? 'We’ll email you a reset link.' : 'Sign in to see your trips and savings.' }));
    if (mode !== 'forgot') card.appendChild(h('div', { class: 'acct-tabs', role: 'tablist' }, [
      h('button', { class: 'acct-tab' + (mode === 'signin' ? ' is-active' : ''), 'data-mode': 'signin', text: 'Sign in' }),
      h('button', { class: 'acct-tab' + (mode === 'signup' ? ' is-active' : ''), 'data-mode': 'signup', text: 'Create account' })
    ]));
    var form = h('form', { class: 'acct-form' + (mode === 'signup' ? ' has-pwcheck' : ''), 'data-action': mode === 'forgot' ? 'forgot' : mode, novalidate: true });
    if (mode === 'signup') {
      form.appendChild(h('div', { class: 'acct-row2' }, [
        field('First name', { name: 'first_name', type: 'text', autocomplete: 'given-name', required: true }),
        field('Last name', { name: 'last_name', type: 'text', autocomplete: 'family-name', required: true })
      ]));
      form.appendChild(field('Email', { name: 'email', type: 'email', autocomplete: 'email', required: true }));
      pwBlock('Create account').forEach(function (n) { form.appendChild(n); });
    } else if (mode === 'forgot') {
      form.appendChild(field('Email', { name: 'email', type: 'email', autocomplete: 'email', required: true }));
      form.appendChild(msgBox());
      form.appendChild(h('button', { type: 'submit', class: 'btn btn-primary acct-btn', text: 'Send reset link' }));
      form.appendChild(h('button', { type: 'button', class: 'acct-link', 'data-mode': 'signin', text: 'Back to sign in' }));
    } else {
      form.appendChild(field('Email', { name: 'email', type: 'email', autocomplete: 'email', required: true }));
      form.appendChild(field('Password', { name: 'password', type: 'password', autocomplete: 'current-password', required: true }));
      form.appendChild(msgBox());
      form.appendChild(h('button', { type: 'submit', class: 'btn btn-primary acct-btn', text: 'Sign in' }));
      form.appendChild(h('button', { type: 'button', class: 'acct-link', 'data-mode': 'forgot', text: 'Forgot password?' }));
    }
    card.appendChild(form);
    mount(card);
  }
  function viewRecovery() {
    var form = h('form', { class: 'acct-form has-pwcheck', 'data-action': 'recover', novalidate: true }, pwBlock('Update password'));
    form.querySelector('button').textContent = 'Update password';
    mount(h('div', { class: 'acct-card' }, [h('h2', { class: 'acct-title', text: 'Set a new password' }), form]));
  }

  /* ---------- trip card ---------- */
  function statusBadge(s) { var k = (s || 'confirmed').toLowerCase(); var l = (s || 'Confirmed'); l = l.charAt(0).toUpperCase() + l.slice(1); return h('span', { class: 'trip-status trip-status--' + k, text: l }); }
  function tripCard(b) {
    var hasRetail = b.retail_price != null && b.amount_charged != null && Number(b.retail_price) > Number(b.amount_charged);
    var card = h('article', { class: 'trip-card' });
    var routeH = h('h4', { class: 'trip-route' }, [(b.from_city || b.from_airport || ''), h('span', { class: 'trip-arrow', text: ' → ' }), (b.to_city || b.to_airport || '')]);
    var codes = [b.from_airport, b.to_airport].filter(Boolean).join(' · ');
    card.appendChild(h('div', { class: 'trip-top' }, [h('div', null, [routeH, codes ? h('p', { class: 'trip-codes', text: codes }) : null]), statusBadge(b.status)]));
    var flight = [b.airline, b.flight_number].filter(Boolean).join(' ');
    var dates = [fmtDate(b.depart_at), b.return_at ? fmtDate(b.return_at) : null].filter(Boolean).join(' – ');
    var chips = [];
    if (flight) chips.push(h('span', { class: 'trip-chip', text: flight }));
    if (b.cabin) chips.push(h('span', { class: 'trip-chip trip-chip--cabin', text: b.cabin }));
    if (b.passengers) chips.push(h('span', { class: 'trip-chip', text: b.passengers + (Number(b.passengers) === 1 ? ' passenger' : ' passengers') }));
    if (dates) chips.push(h('span', { class: 'trip-chip', text: dates }));
    card.appendChild(h('div', { class: 'trip-meta' }, chips));
    if (b.hotel_name) card.appendChild(h('p', { class: 'trip-hotel', text: '🏨 ' + b.hotel_name }));
    var mk = [];
    if (b.amount_charged != null) mk.push(h('div', { class: 'trip-paid' }, [h('span', { text: 'You paid' }), h('strong', { text: money(b.amount_charged, b.currency) })]));
    if (hasRetail) {
      mk.push(h('div', { class: 'trip-retail' }, [h('span', { text: 'Public price' }), h('s', { text: money(b.retail_price, b.currency) })]));
      mk.push(h('div', { class: 'trip-saved' }, [h('span', { text: 'You saved' }), h('strong', { text: money(b.amount_saved, b.currency) })]));
    }
    if (mk.length) card.appendChild(h('div', { class: 'trip-money' }, mk));
    if (b.confirmation_code) card.appendChild(h('div', { class: 'trip-foot' }, [
      h('span', { class: 'trip-conf' }, ['Confirmation ', h('b', { text: b.confirmation_code })])
    ]));
    return card;
  }

  /* ---------- sections ---------- */
  function panel(title, sub, body) {
    var head = [h('h3', { class: 'acct-panel-title', text: title })];
    if (sub) head.push(h('p', { class: 'acct-panel-sub', text: sub }));
    return h('section', { class: 'acct-panel' }, [h('div', { class: 'acct-panel-head' }, head)].concat(body));
  }
  function saveForm(fields) {
    var form = h('form', { class: 'acct-form', 'data-action': 'savefields' }, fields.concat([msgBox(), h('button', { type: 'submit', class: 'btn btn-primary acct-btn', text: 'Save changes' })]));
    return form;
  }
  function fmtStamp(ts) {
    if (!ts) return '';
    var d = new Date(ts); if (isNaN(d)) return '';
    var h12 = d.getHours() % 12 || 12, ap = d.getHours() >= 12 ? 'pm' : 'am';
    return fmtDate(ts) + ', ' + h12 + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + ap;
  }
  function stampText(row) {
    var c = fmtStamp(row.created_at); if (!c) return '';
    var upd = row.updated_at && (new Date(row.updated_at) - new Date(row.created_at) > 60000) ? fmtStamp(row.updated_at) : '';
    return 'Created ' + c + (upd ? '   ·   Updated ' + upd : '');
  }
  function cardStamp(row) { var t = stampText(row); return t ? h('p', { class: 'card-stamp', text: t }) : null; }
  /* a booking is "covered" when an itinerary spans its dates — the same trip entered twice */
  function bookingCoveredBy(b, its) {
    if (!b.depart_at) return null;
    var d = new Date(b.depart_at);
    for (var i = 0; i < its.length; i++) {
      var it = its[i]; if (!it.start_date) continue;
      var s = new Date(it.start_date + 'T00:00:00'); s.setDate(s.getDate() - 2);
      var e = new Date((it.end_date || it.start_date) + 'T23:59:59'); e.setDate(e.getDate() + 2);
      if (d >= s && d <= e) return it;
    }
    return null;
  }
  function itinSavings(it) { var t = Number(it.total_charged), c = Number(it.comparable_total); return (t > 0 && c > t) ? c - t : 0; }
  function itinUpcoming(it) { var end = it.end_date || it.start_date; if (!end) return true; return new Date(end + 'T23:59:59') >= new Date(); }
  function acctAlert(kind, title, sub, href, cta) {
    return h('a', { class: 'acct-alert acct-alert--' + kind, href: href }, [
      h('div', { class: 'acct-alert-main' }, [h('strong', { text: title }), sub ? h('span', { text: sub }) : null]),
      h('span', { class: 'acct-alert-cta', text: cta })
    ]);
  }
  function sectionOverview() {
    var p = state.profile, bk = state.bookings || [], its = state.itineraries || [], qs = state.quotes || [], ivs = state.invoices || [];
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'Welcome back, ' + (p.first_name || 'traveler') + '.' }));
    /* things that need the customer's attention come first */
    var waiting = qs.filter(function (q) { return (q.status || 'sent') === 'sent'; });
    if (waiting.length) {
      var qSave = waiting.reduce(function (s, q) { var c = Number(q.comparable_total) || 0, t = Number(q.total_charged) || 0; return s + (c > t ? c - t : 0); }, 0);
      wrap.appendChild(acctAlert('quote',
        waiting.length === 1 ? 'A quote is waiting for you' : waiting.length + ' quotes are waiting for you',
        qSave > 0 ? 'Savings of ' + money(qSave, waiting[0].currency || 'USD') + ' — fares move daily.' : 'Your specialist has priced your trip.',
        '#quotes', 'View quote'));
    }
    var outstanding = 0, dueDates = [];
    ivs.forEach(function (iv) { var b = Math.max((Number(iv.total_charged) || 0) - (Number(iv.amount_paid) || 0), 0); if (b > 0.001) { outstanding += b; if (iv.due_date) dueDates.push(iv.due_date); } });
    if (outstanding > 0.001) {
      dueDates.sort();
      wrap.appendChild(acctAlert('due', 'Balance outstanding: ' + money(outstanding, (ivs[0] && ivs[0].currency) || 'USD'),
        dueDates.length ? 'Due by ' + fmtDate(dueDates[0]) + '.' : '', '#invoices', 'View invoices'));
    }
    /* savings across everything, without double-counting bookings an itinerary already covers */
    var savedBk = bk.reduce(function (s, b) { if (bookingCoveredBy(b, its)) return s; var v = Number(b.amount_saved); return s + (isNaN(v) ? 0 : v); }, 0);
    var savedIt = its.reduce(function (s, it) { return s + itinSavings(it); }, 0);
    /* invoice-only trips count too, unless an itinerary already carries that invoice's pricing */
    var savedInv = ivs.reduce(function (s, iv) {
      var comp = Number(iv.comparable_total) || 0, tot = Number(iv.total_charged) || 0;
      if (!(comp > tot)) return s;
      var covered = its.some(function (it) { return it.price_invoice_number && iv.invoice_number && it.price_invoice_number === iv.invoice_number; });
      return covered ? s : s + (comp - tot);
    }, 0);
    var saved = savedBk + savedIt + savedInv;
    if (saved > 0) wrap.appendChild(h('div', { class: 'saved-stat' }, [
      h('span', { class: 'saved-eyebrow', text: 'Total saved with Upgrade Travel' }),
      h('span', { class: 'saved-amount', text: money(saved, (bk[0] && bk[0].currency) || (its[0] && its[0].currency) || 'USD') })
    ]));
    var freeBk = bk.filter(function (b) { return !bookingCoveredBy(b, its); });
    var tripCount = its.length + freeBk.length;
    var upcomingCount = its.filter(itinUpcoming).length + freeBk.filter(function (b) { return b.depart_at && new Date(b.depart_at) >= new Date(); }).length;
    wrap.appendChild(h('div', { class: 'acct-stats' }, [
      h('div', { class: 'acct-stat' }, [h('span', { class: 'acct-stat-num', text: String(tripCount) }), h('span', { class: 'acct-stat-lbl', text: tripCount === 1 ? 'trip' : 'trips' })]),
      h('div', { class: 'acct-stat' }, [h('span', { class: 'acct-stat-num', text: String(upcomingCount) }), h('span', { class: 'acct-stat-lbl', text: 'upcoming' })])
    ]));
    /* the next trip leads with the itinerary (the showpiece), bookings only as fallback */
    var upIts = its.filter(itinUpcoming).sort(function (a, b) { return ('' + (a.start_date || '9999')).localeCompare('' + (b.start_date || '9999')); });
    var upBk = bk.filter(function (b) { return b.depart_at && new Date(b.depart_at) >= new Date(); }).sort(function (a, b) { return new Date(a.depart_at) - new Date(b.depart_at); });
    if (upIts.length) {
      wrap.appendChild(h('h3', { class: 'acct-panel-title', text: 'Your next journey' }));
      wrap.appendChild(itinTripCard(upIts[0], bk.filter(function (b) { return bookingCoveredBy(b, [upIts[0]]); })));
      setTimeout(function () { loadBvImages(wrap); }, 0);
    } else if (upBk.length) {
      wrap.appendChild(h('h3', { class: 'acct-panel-title', text: 'Next trip' }));
      wrap.appendChild(tripCard(upBk[0]));
    } else if (!tripCount) {
      wrap.appendChild(h('div', { class: 'acct-empty' }, [
        emptyIc('trips'),
        h('p', null, h('strong', { text: 'No trips yet.' })),
        h('p', { text: 'When you book a flight with us, it shows up here automatically — with everything you saved.' }),
        h('a', { class: 'btn btn-primary', href: CONTACT, text: 'Get a quote' })
      ]));
    }
    return wrap;
  }
  /* is this itinerary the signed-in person's own (vs a fellow group member's)? */
  function itinIsOwn(it) { return (it.user_id && it.user_id === state.uid) || (it.customer_email && state.email && it.customer_email.toLowerCase() === state.email.toLowerCase()); }
  /* itineraries built together as one group trip share a group_trip_id — cluster them */
  function tripClusters(its) {
    var map = {}, order = [], solo = [];
    its.forEach(function (it) { if (it.group_trip_id) { if (!map[it.group_trip_id]) { map[it.group_trip_id] = { id: it.group_trip_id, items: [] }; order.push(it.group_trip_id); } map[it.group_trip_id].items.push(it); } else solo.push(it); });
    return { clusters: order.map(function (id) { return map[id]; }), solo: solo };
  }
  function groupTitleFromItems(items) { var t = items[0].title || '', i = t.indexOf(' · '); return (i > 0 ? t.slice(0, i) : (items[0].destination || '')) || 'Group trip'; }
  function travelerList(names) { return (names || '').split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function tripGroupBox(cluster, coveredFor) {
    var items = cluster.items.slice();
    var others = items.filter(function (it) { return !itinIsOwn(it); });
    var allOwn = others.length === 0; /* one shared login → don't single anyone out */
    var ordered = allOwn ? items : items.filter(itinIsOwn).concat(others);
    var travelers = items.reduce(function (n, it) { return n + (it.passengers || travelerList(it.traveler_names).length || 1); }, 0);
    return h('div', { class: 'trip-group' }, [
      h('div', { class: 'trip-group-head' }, [
        h('span', { class: 'trip-group-eyebrow', text: 'Traveling together' }),
        h('h3', { class: 'trip-group-title', text: groupTitleFromItems(items) }),
        h('p', { class: 'trip-group-sub', text: items.length + ' itineraries  ·  ' + travelers + ' travelers' })
      ]),
      h('div', { class: 'trip-list' }, ordered.map(function (it) { return itinTripCard(it, coveredFor(it), { group: true, own: !allOwn && itinIsOwn(it) }); }))
    ]);
  }
  function sectionTrips() {
    var bk = state.bookings || [], its = state.itineraries || [];
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'My trips' }));
    var tc = tripClusters(its);
    var freeBk = bk.filter(function (b) { return !bookingCoveredBy(b, its); });
    var upBk = freeBk.filter(function (b) { return !b.depart_at || new Date(b.depart_at) >= new Date() || (b.status || '') === 'upcoming'; });
    var pastBk = freeBk.filter(function (b) { return upBk.indexOf(b) < 0; });
    function coveredFor(it) { return bk.filter(function (b) { return bookingCoveredBy(b, [it]) === it || bookingCoveredBy(b, [it]); }); }
    function clusterUpcoming(c) { return c.items.some(itinUpcoming); }
    var upClusters = tc.clusters.filter(clusterUpcoming), pastClusters = tc.clusters.filter(function (c) { return !clusterUpcoming(c); });
    var upSolo = tc.solo.filter(itinUpcoming), pastSolo = tc.solo.filter(function (it) { return !itinUpcoming(it); });
    if (upClusters.length || upSolo.length || upBk.length) {
      wrap.appendChild(h('h3', { class: 'acct-panel-title acct-subhead', text: 'Upcoming' }));
      upClusters.forEach(function (c) { wrap.appendChild(tripGroupBox(c, coveredFor)); });
      if (upSolo.length || upBk.length) wrap.appendChild(h('div', { class: 'trip-list' }, upSolo.map(function (it) { return itinTripCard(it, coveredFor(it)); }).concat(upBk.map(tripCard))));
    }
    if (pastClusters.length || pastSolo.length || pastBk.length) {
      wrap.appendChild(h('h3', { class: 'acct-panel-title acct-subhead', text: 'Past trips' }));
      pastClusters.forEach(function (c) { wrap.appendChild(tripGroupBox(c, coveredFor)); });
      if (pastSolo.length || pastBk.length) wrap.appendChild(h('div', { class: 'trip-list' }, pastSolo.map(function (it) { return itinTripCard(it, coveredFor(it)); }).concat(pastBk.map(tripCard))));
    }
    if (!its.length && !bk.length) wrap.appendChild(h('div', { class: 'acct-empty' }, [emptyIc('trips'), h('p', null, h('strong', { text: 'No trips yet.' })), h('p', { text: 'Your trips and itineraries will appear here.' }), h('a', { class: 'btn btn-primary', href: CONTACT, text: 'Get a quote' })]));
    setTimeout(function () { loadBvImages(wrap); }, 0);
    return wrap;
  }
  function paxText(q) { var p = [], a = q.pax_adults || 0, c = q.pax_children || 0, i = q.pax_infants || 0; if (a) p.push(a + ' adult' + (a > 1 ? 's' : '')); if (c) p.push(c + ' child' + (c > 1 ? 'ren' : '')); if (i) p.push(i + ' infant' + (i > 1 ? 's' : '')); return p.join(' · ') || (q.passengers || 1) + ' passenger'; }
  function quoteStatusBadge(s) { var k = (s || 'sent').toLowerCase(), labels = { sent: 'New quote', accepted: 'Accepted', declined: 'Declined' }; return h('span', { class: 'quote-status quote-status--' + k, text: labels[k] || s }); }
  function tripTypeLabel(t) { return { round: 'Round trip', one_way: 'One way', multi: 'Multi-city' }[t] || ''; }
  function segRole(tt, i, n) { if (tt === 'round') return i === 0 ? 'Outbound' : (i === 1 ? 'Return' : 'Flight ' + (i + 1)); if (tt === 'multi' || n > 1) return 'Flight ' + (i + 1); return ''; }
  function quoteSegRow(s, role) {
    var head = [s.airline, s.cabin].filter(Boolean).join('  ·  ') || 'Flight';
    var sub = [s.from.city + ' to ' + s.to.city, s.flight_number || ''].filter(Boolean).join('  ·  ');
    var cols = [];
    var dep = [s.depart_date ? fmtDate(s.depart_date) : '', fmtTime(s.depart_time)].filter(Boolean).join('  ·  ');
    if (dep) cols.push(['Departs', dep]);
    if (s.return_date) cols.push(['Returns', [fmtDate(s.return_date), fmtTime(s.return_time)].filter(Boolean).join('  ·  ')]);
    else if (s.arrive_time) cols.push(['Arrives', fmtTime(s.arrive_time)]);
    return h('div', { class: 'q-seg' }, [
      role ? h('div', { class: 'q-seg-role', text: role }) : null,
      h('div', { class: 'q-seg-head' }, [h('span', { class: 'q-seg-air', text: head }), h('span', { class: 'q-seg-route', text: s.from.code + ' → ' + s.to.code })]),
      sub ? h('div', { class: 'q-seg-sub', text: sub }) : null,
      cols.length ? h('div', { class: 'q-seg-when' }, cols.map(function (c) { return h('div', { class: 'q-when' }, [h('div', { class: 'q-when-k', text: c[0] }), h('div', { class: 'q-when-v', text: c[1] })]); })) : null
    ]);
  }
  function quoteCard(q) {
    var total = Number(q.total_charged) || 0, comp = Number(q.comparable_total) || 0, hasComp = comp > total;
    var saved = q.savings != null ? Number(q.savings) : (comp - total);
    var card = h('article', { class: 'trip-card quote-card' });
    card.appendChild(h('div', { class: 'trip-top' }, [
      h('div', null, [h('h4', { class: 'trip-route', text: q.title || ('Quote ' + (q.quote_number || '')) }), q.destination ? h('p', { class: 'trip-codes', text: q.destination }) : null]),
      quoteStatusBadge(q.status)
    ]));
    var chips = [];
    var ttl = tripTypeLabel(q.trip_type); if (ttl) chips.push(h('span', { class: 'trip-chip trip-chip--type', text: ttl }));
    chips.push(h('span', { class: 'trip-chip', text: paxText(q) }));
    if (q.valid_until) {
      /* fares move daily — an expiring quote deserves an honest nudge */
      var days = Math.ceil((new Date(q.valid_until + 'T23:59:59') - new Date()) / 86400000);
      var urgent = (q.status || 'sent') === 'sent' && days <= 5;
      var lbl = days < 0 ? 'Expired ' + fmtDate(q.valid_until) : (urgent ? (days <= 1 ? 'Expires today' : 'Expires in ' + days + ' days') : 'Valid until ' + fmtDate(q.valid_until));
      chips.push(h('span', { class: 'trip-chip' + (urgent ? ' trip-chip--urgent' : ''), text: lbl }));
    }
    card.appendChild(h('div', { class: 'trip-meta' }, chips));
    if (q.segments && q.segments.length) card.appendChild(h('div', { class: 'q-flights' }, q.segments.map(function (s, i) { return quoteSegRow(s, segRole(q.trip_type, i, q.segments.length)); })));
    var priceKids = [h('div', { class: 'q-price-item' }, [h('div', { class: 'q-price-k', text: 'Your price' }), h('div', { class: 'q-price-v', text: money(total, q.currency) })])];
    if (hasComp) {
      priceKids.push(h('div', { class: 'q-price-item q-price-pub' }, [h('div', { class: 'q-price-k', text: 'Public price' }), h('div', { class: 'q-price-v', text: money(comp, q.currency) })]));
      priceKids.push(h('div', { class: 'q-price-item q-price-save' }, [h('div', { class: 'q-price-k', text: 'You save' }), h('div', { class: 'q-price-v', text: money(saved, q.currency) })]));
    }
    card.appendChild(h('div', { class: 'q-price' }, priceKids));
    /* alternative options: the client picks the one they want */
    if (q.options && q.options.length) {
      var open = (q.status || 'sent') === 'sent';
      card.appendChild(h('div', { class: 'q-opts' }, [h('div', { class: 'q-opts-h', text: 'Other options for this trip' })].concat(q.options.map(function (o) {
        var ot = Number(o.total) || 0, oc = Number(o.comparable) || 0;
        return h('div', { class: 'q-opt' }, [
          h('div', { class: 'q-opt-main' }, [
            h('div', { class: 'q-opt-label', text: o.label || 'Option' }),
            o.desc ? h('div', { class: 'q-opt-desc', text: o.desc }) : null,
            h('div', { class: 'q-opt-price' }, [h('strong', { text: money(ot, q.currency) }), oc > ot ? h('span', { class: 'q-opt-comp', text: money(oc, q.currency) }) : null, oc > ot ? h('span', { class: 'q-opt-save', text: 'Save ' + money(oc - ot, q.currency) }) : null])
          ]),
          open ? h('button', { class: 'btn btn-ghost q-opt-btn', 'data-action': 'acceptquote', 'data-id': q.id, 'data-opt': o.label || 'Option', text: 'Accept this option' }) : (q.chosen_option && q.chosen_option === o.label ? h('span', { class: 'q-opt-chosen', text: 'Your choice ✓' }) : null)
        ]);
      }))));
    }
    var actions = [];
    if ((q.status || 'sent') === 'sent') {
      actions.push(h('button', { class: 'btn btn-primary', 'data-action': 'acceptquote', 'data-id': q.id, text: 'Accept quote' }));
      actions.push(h('button', { class: 'btn btn-ghost', 'data-action': 'declinequote', 'data-id': q.id, text: 'Decline' }));
    }
    var qFile = 'Quote-' + (q.quote_number || 'flyupgrade') + '.pdf';
    actions.push(h('button', { type: 'button', class: 'btn btn-ghost q-view-btn', onclick: function () { openOverlay(quoteDoc(q), qFile, LD_PDF); }, text: 'View quote' }));
    actions.push(h('button', { type: 'button', class: 'btn btn-ghost q-view-btn', onclick: function () { makeDocPDF(quoteDoc(q), qFile, 'open', LD_PDF); }, text: 'View PDF' }));
    card.appendChild(h('div', { class: 'quote-actions' }, actions));
    if ((q.status || 'sent') !== 'sent') card.appendChild(h('p', { class: 'quote-decided', text: q.status === 'accepted' ? ('You accepted this quote' + (q.chosen_option ? ' (' + q.chosen_option + ')' : '') + '. Your agent will be in touch to book it.') : 'You declined this quote.' }));
    if (q.notes) card.appendChild(h('p', { class: 'quote-note', text: q.notes }));
    card.appendChild(h('p', { class: 'quote-ref', text: ['Quote ' + (q.quote_number || ''), stampText(q)].filter(Boolean).join('   ·   ') }));
    return card;
  }
  /* decided quotes shrink to a history row — only open quotes deserve the full card */
  function quoteHistoryRow(q) {
    var total = Number(q.total_charged) || 0;
    return h('div', { class: 'quote-hist' }, [
      h('div', { class: 'quote-hist-main' }, [
        h('div', { class: 'quote-hist-top' }, [h('strong', { text: q.title || ('Quote ' + (q.quote_number || '')) }), quoteStatusBadge(q.status)]),
        h('div', { class: 'quote-hist-sub', text: [q.quote_number, q.destination, q.chosen_option ? 'Chose ' + q.chosen_option : '', total ? money(total, q.currency) : ''].filter(Boolean).join('  ·  ') })
      ]),
      h('button', { type: 'button', class: 'btn btn-ghost quote-hist-btn', onclick: function () { openOverlay(quoteDoc(q), 'Quote-' + (q.quote_number || 'flyupgrade') + '.pdf', LD_PDF); }, text: 'View' })
    ]);
  }
  function sectionQuotes() {
    var qs = state.quotes || [];
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'My quotes' }));
    var open = qs.filter(function (q) { return (q.status || 'sent') === 'sent'; });
    var decided = qs.filter(function (q) { return (q.status || 'sent') !== 'sent'; });
    if (open.length) wrap.appendChild(h('div', { class: 'trip-list' }, open.map(quoteCard)));
    if (decided.length) {
      wrap.appendChild(h('h3', { class: 'acct-panel-title acct-subhead', text: 'Earlier quotes' }));
      wrap.appendChild(h('div', { class: 'quote-hist-list' }, decided.map(quoteHistoryRow)));
    }
    if (!qs.length) wrap.appendChild(h('div', { class: 'acct-empty' }, [emptyIc('quotes'), h('p', null, h('strong', { text: 'No quotes yet.' })), h('p', { text: 'Request a quote and choose “See it in my account”, and it will show up here.' }), h('a', { class: 'btn btn-primary', href: CONTACT, text: 'Get a quote' })]));
    return wrap;
  }
  async function decideQuote(id, decision, optLabel) {
    await sb.rpc('accept_quote', { qid: id, decision: decision, option_label: optLabel || null });
    for (var i = 0; i < (state.quotes || []).length; i++) { if (state.quotes[i].id === id) { state.quotes[i].status = decision; state.quotes[i].chosen_option = decision === 'accepted' ? (optLabel || null) : null; break; } }
    renderContent();
  }
  /* ---------- itineraries + invoices (customer-facing docs) ---------- */
  function agencyName() { return (state.settings && state.settings.agency_name) || 'Upgrade Travel'; }
  function fmtTime(t) { if (!t) return ''; var s = '' + t, m = s.indexOf('T') > -1 ? s.split('T')[1] : s; var x = m.match(/(\d{1,2}):(\d{2})/); if (!x) return ''; var hh = +x[1], ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 || 12; return h12 + ':' + x[2] + ' ' + ap; }
  /* seats may be an array of chips (['2A','2K']) or a legacy string; render either */
  function seatStr(s) { return Array.isArray(s) ? s.filter(Boolean).join(' · ') : (s || ''); }
  /* baggage may be an array of {type,qty,weight,unit} or a legacy string */
  function bagStr(v) {
    if (!Array.isArray(v)) return v || '';
    return v.map(function (b) {
      if (!b) return '';
      var q = (b.qty && b.qty > 1) ? b.qty + ' × ' : '';
      var w = (b.weight != null && b.weight !== '') ? ' ' + b.weight + ' ' + (b.unit || 'kg') : '';
      return (q + (b.type || 'Bag') + w).trim();
    }).filter(Boolean).join('  ·  ');
  }
  function itinDateRange(it) { return [it.start_date ? fmtDate(it.start_date) : '', it.end_date ? fmtDate(it.end_date) : ''].filter(Boolean).join(' – '); }
  var _pdfLoading = null;
  function ensureHtml2pdf(cb) {
    if (window.html2pdf) { cb(); return; }
    if (!_pdfLoading) { _pdfLoading = new Promise(function (resolve) { var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.3/dist/html2pdf.bundle.min.js'; s.onload = resolve; s.onerror = resolve; document.head.appendChild(s); }); }
    _pdfLoading.then(cb);
  }
  function makeDocPDF(docNode, filename, mode, pdfOpt) {
    pdfOpt = pdfOpt || {};
    var win = null;
    if (mode === 'open') { win = window.open('', '_blank'); if (win) { try { win.document.title = 'Preparing PDF…'; } catch (e) { } } }
    /* photos resolve asynchronously; give late banners a moment so none export as dark gradients */
    function waitForPhotos(cb) {
      var tries = 0, last = -1;
      (function poll() {
        var pending = 0;
        Array.prototype.forEach.call(docNode.querySelectorAll('.bv-ph'), function (el) { if (!el.classList.contains('bv-has-img')) pending++; });
        if (pending === 0 || (pending === last && tries > 2) || tries >= 12) { cb(); return; }
        last = pending; tries++;
        setTimeout(poll, 300);
      })();
    }
    ensureHtml2pdf(function () {
      if (!window.html2pdf) { if (win) win.close(); window.print(); return; }
      waitForPhotos(function () {
      var holder = h('div', { class: 'pdf-holder' });
      holder.appendChild(h('div', { class: 'pdf-holder-note', text: 'Preparing your PDF…' }));
      var page = h('div', { class: 'pdf-page' });
      page.appendChild(docNode.cloneNode(true));
      holder.appendChild(page);
      document.body.appendChild(holder);
      var opt = { margin: pdfOpt.margin != null ? pdfOpt.margin : [10, 10, 12, 10], filename: filename || 'document.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: pdfOpt.bg || '#ffffff', useCORS: true, scrollX: 0, scrollY: 0 }, jsPDF: { unit: 'mm', format: pdfOpt.format || 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
      var done = function () { if (holder.parentNode) document.body.removeChild(holder); };
      /* a discreet page footer on multi-page documents (skipped on single-page) */
      var stampPages = function (pdf) {
        try {
          var n = pdf.internal.getNumberOfPages();
          if (n < 2) return pdf;
          var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(139, 126, 99);
          for (var i = 1; i <= n; i++) { pdf.setPage(i); pdf.text(agencyName() + '   ·   Page ' + i + ' of ' + n, pw / 2, ph - 4, { align: 'center' }); }
        } catch (e) { }
        return pdf;
      };
      /* every page one solid paper sheet: wrap the document's top-level blocks so page breaks
         land BETWEEN them (each wrapper's transparent border is the air at the top of a page),
         and stretch the canvas to an exact page multiple so the last page has no white remainder.
         This runs on the CLONE only; the on-screen overlay is untouched. */
      if (pdfOpt.fill) {
        try {
          var rootEl = page.firstChild;
          var KEEP = ['ld-card', 'ld-note', 'ld-banner', 'ld-group-label', 'ld-charges', 'ld-save', 'ld-terms', 'ld-footer', 'ld-disclaimer', 'ld-party', 'ld-day'];
          Array.prototype.slice.call(rootEl.children).forEach(function (el) {
            var cl = el.classList, hit = false;
            for (var ki = 0; ki < KEEP.length; ki++) { if (cl.contains(KEEP[ki])) { hit = true; break; } }
            if (!hit) return;
            var wrapEl = document.createElement('div');
            wrapEl.className = 'ld-keep' + (cl.contains('ld-page') ? ' ld-page' : '');
            cl.remove('ld-page');
            rootEl.insertBefore(wrapEl, el);
            wrapEl.appendChild(el);
          });
        } catch (e) { }
      }
      /* the canvas html2pdf actually rendered (page-break spacers included) tells us exactly
         where content ends on the last page, so the remainder gets painted paper, not white */
      var cvW = 0, cvH = 0;
      var fillLastPage = function (pdf) {
        if (!pdfOpt.fill || !(cvW > 0)) return pdf;
        try {
          var pn = pdf.internal.getNumberOfPages(), pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
          var totalMm = cvH * (pw / cvW);
          var lastMm = totalMm - (pn - 1) * ph;
          if (lastMm > 0 && lastMm < ph - 0.5) {
            pdf.setPage(pn);
            pdf.setFillColor(244, 237, 223); /* after setPage: jsPDF fill color is per-page */
            pdf.rect(0, Math.max(0, lastMm - 0.4), pw, ph - lastMm + 0.6, 'F');
          }
        } catch (e) { }
        return pdf;
      };
      /* wait for the serif webfont so the PDF embeds it, not a fallback; then render once */
      var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      ready.then(function () {
        window.html2pdf().set(opt).from(page.firstChild).toCanvas().get('canvas').then(function (cv) { if (cv) { cvW = cv.width; cvH = cv.height; } }).toPdf().get('pdf').then(function (pdf) {
          fillLastPage(pdf);
          stampPages(pdf);
          if (mode === 'open') { var url = pdf.output('bloburl'); if (win) win.location.href = url; else window.open(url, '_blank'); }
          else { pdf.save(opt.filename); }
          done();
        }).catch(function () { if (win) win.close(); done(); });
      });
      });
    });
  }
  function openOverlay(docNode, filename, pdfOpt) {
    closeOverlay();
    var overlay = h('div', { class: 'acct-overlay', id: 'acct-overlay', 'data-lenis-prevent': '' });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    overlay.appendChild(h('div', { class: 'acct-modal' }, [
      h('div', { class: 'acct-modal-bar no-print' }, [
        h('button', { type: 'button', class: 'btn btn-primary acct-modal-pdf', onclick: function () { makeDocPDF(docNode, filename, 'save', pdfOpt); }, text: 'Download PDF' }),
        h('button', { type: 'button', class: 'btn btn-ghost acct-modal-view', onclick: function () { makeDocPDF(docNode, filename, 'open', pdfOpt); }, text: 'View PDF' }),
        h('button', { type: 'button', class: 'acct-modal-close', onclick: closeOverlay, 'aria-label': 'Close', text: '×' })
      ]),
      docNode
    ]));
    document.body.appendChild(overlay);
    document.body.classList.add('acct-modal-open');
    document.documentElement.classList.add('acct-modal-open');
    loadBvImages(overlay); /* city banners etc resolve their photos in place */
  }
  function closeOverlay() { var o = document.getElementById('acct-overlay'); if (o) o.remove(); document.body.classList.remove('acct-modal-open'); document.documentElement.classList.remove('acct-modal-open'); }
  /* ---- the customer itinerary PDF: editorial paper document (numbered booking cards,
     city photo banners, meta pills) — one continuous letter-page layout ---- */
  function ldPills(pairs) {
    var kids = [];
    pairs.forEach(function (p) { if (!p || !p[1]) return; kids.push(h('span', { class: 'ld-pill' }, p[0] ? [h('b', { text: p[0] }), ' ' + p[1]] : ['' + p[1]])); });
    return kids.length ? h('div', { class: 'ld-meta' }, kids) : null;
  }
  /* one gold icon per booking type, so a page skims like a real travel wallet */
  function ldIcon(kind) {
    var P = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    function svg(kids, fill) {
      return sv('svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: fill ? 'currentColor' : 'none', stroke: fill ? 'none' : 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, kids);
    }
    var icons = {
      flight: function () { return svg([sv('path', { d: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z' })], true); },
      hotel: function () { return svg([sv('path', { d: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8' }), sv('path', { d: 'M2 20h20' }), sv('path', { d: 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4' }), sv('path', { d: 'M6 14h4v6' })]); },
      transport: function () { return svg([sv('path', { d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2' }), sv('circle', { cx: '7', cy: '17', r: '2' }), sv('path', { d: 'M9 17h6' }), sv('circle', { cx: '17', cy: '17', r: '2' })]); },
      dining: function () { return svg([sv('path', { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' }), sv('path', { d: 'M7 2v20' }), sv('path', { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7' })]); },
      experience: function () { return svg([sv('path', { d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z' }), sv('path', { d: 'M13 5v2' }), sv('path', { d: 'M13 11v2' }), sv('path', { d: 'M13 17v2' })]); },
      cruise: function () { return svg([sv('path', { d: 'M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z' }), sv('path', { d: 'M21 14 10 2 3 14h18Z' }), sv('path', { d: 'M10 2v16' })]); }
    };
    var make = icons[kind];
    return make ? h('span', { class: 'ld-ic' }, [make()]) : null;
  }
  function ldCard(no, title, subtitle, kids, kind) {
    return h('section', { class: 'ld-card' }, [
      h('div', { class: 'ld-card-head' }, [
        h('div', { class: 'ld-no', text: ('0' + no).slice(-2) }),
        h('div', { class: 'ld-card-head-main' }, [h('h2', { class: 'ld-title', text: title }), subtitle ? h('div', { class: 'ld-subtitle', text: subtitle }) : null]),
        kind ? ldIcon(kind) : null
      ]),
      h('div', { class: 'ld-sumlabel', text: kind === 'flight' ? 'Flight Details' : 'Booking Summary' })
    ].concat(kids || []));
  }
  function ldFlightCard(no, s, prev) {
    var kids = [];
    if (s.connect_from_prev && prev) {
      var lc = (prev.to && (prev.to.city || prev.to.code)) || '', ld = (s.layover_duration || '').trim() || bvLayoverDur(prev, s);
      kids.push(h('div', { class: 'ld-layover', text: bvLayoverWord(s) + (lc ? ' in ' + lc : '') + (ld ? '  ·  ' + ld + ' on the ground' : '') + (s.layover_note ? ' — ' + s.layover_note : '') }));
    }
    var ad = s.arrive_date || s.return_date || bvArriveDate(s);
    var dt = s.depart_time ? fmtTime(s.depart_time) : '', at = s.arrive_time ? fmtTime(s.arrive_time) : '';
    function apLine(a, term) {
      if (!a) return '';
      var base = a.name || [a.city, a.country].filter(Boolean).join(', ');
      return [base, term ? 'Terminal ' + term : ''].filter(Boolean).join('  ·  ');
    }
    kids.push(h('div', { class: 'ld-flight' }, [
      h('div', { class: 'ld-fl-end' }, [
        h('div', { class: 'ld-fl-lab', text: 'Departure' + (s.depart_date ? ' · ' + fmtDate(s.depart_date) : '') }),
        h('div', { class: 'ld-fl-time', text: dt || (s.from && s.from.city) || '' }),
        h('div', { class: 'ld-fl-code', text: (s.from && s.from.code) || '' }),
        h('div', { class: 'ld-fl-ap', text: apLine(s.from, s.dep_terminal) })
      ]),
      h('div', { class: 'ld-fl-mid' }, [
        h('div', { class: 'ld-fl-dur', text: s.duration ? s.duration + (/nonstop/i.test(s.duration) ? '' : ' · Nonstop') : 'Nonstop' }),
        h('div', { class: 'ld-fl-line' }, [sv('svg', { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'currentColor', 'aria-hidden': 'true' }, [sv('path', { d: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z' })])]),
        h('div', { class: 'ld-fl-no', text: [s.flight_number, s.aircraft].filter(Boolean).join('  ·  ') })
      ]),
      h('div', { class: 'ld-fl-end ld-fl-arr' }, [
        h('div', { class: 'ld-fl-lab', text: 'Arrival' + (ad ? ' · ' + fmtDate(ad) : (s.depart_date ? ' · ' + fmtDate(s.depart_date) : '')) }),
        h('div', { class: 'ld-fl-time', text: at || (s.to && s.to.city) || '' }),
        h('div', { class: 'ld-fl-code', text: (s.to && s.to.code) || '' }),
        h('div', { class: 'ld-fl-ap', text: apLine(s.to, s.arr_terminal) })
      ])
    ]));
    kids.push(ldPills([
      ['Seats', seatStr(s.seats)],
      ['Baggage', bagStr(s.baggage)],
      ['Confirmation', s.confirmation || ''],
      ['E-ticket', s.eticket || '']
    ]));
    if (s.notes) kids.push(h('p', { class: 'ld-prose', text: s.notes }));
    var sub = [s.airline, s.cabin, s.flight_number].filter(Boolean).join('  ·  ');
    if (bvCodeshare(s)) sub += '  ·  Operated by ' + bvCodeshare(s);
    var title = ((s.from && s.from.city) || '') + '  →  ' + ((s.to && s.to.city) || '');
    return ldCard(no, title, sub, kids, 'flight');
  }
  function ldHotelCard(no, x) {
    var nights = null;
    if (x.checkin_date && x.checkout_date) { var nn = Math.round((new Date(x.checkout_date) - new Date(x.checkin_date)) / 86400000); if (nn > 0) nights = nn; }
    var kids = [ldPills([
      ['Check-in', x.checkin_date ? fmtDate(x.checkin_date) + (x.checkin_time ? ' · ' + fmtTime(x.checkin_time) : '') : ''],
      ['Check-out', x.checkout_date ? fmtDate(x.checkout_date) + (x.checkout_time ? ' · ' + fmtTime(x.checkout_time) : '') : ''],
      ['Nights', nights ? '' + nights : ''],
      ['Meals', x.board || ''],
      ['Rooms', x.rooms || ''],
      ['Confirmation', x.confirmation || ''],
      ['Phone', x.phone || '']
    ])];
    if (x.address) kids.push(h('p', { class: 'ld-addr', text: x.address }));
    if (x.notes) kids.push(h('p', { class: 'ld-prose', text: x.notes }));
    ldConf(kids, x);
    return ldCard(no, x.name || 'Your stay', [x.room, x.location].filter(Boolean).join('  ·  '), kids, 'hotel');
  }
  /* booking confirmation image (QR / ticket) in the PDF — crossorigin so html2canvas can draw it */
  function ldConf(kids, x) {
    if (x && x.confirmation_image) kids.push(h('div', { class: 'ld-conf' }, [h('div', { class: 'ld-conf-k', text: 'Ticket / confirmation — show at the venue' }), h('img', { class: 'ld-conf-img', src: x.confirmation_image, crossorigin: 'anonymous', alt: 'Booking confirmation' })]));
  }
  function ldTransportCard(no, x) {
    var kids = [ldPills([
      ['Date', x.date ? fmtDate(x.date) : ''],
      ['Time', x.time ? fmtTime(x.time) : ''],
      ['Chauffeur', [x.driver, x.car, x.plate].filter(Boolean).join(' · ')],
      ['Provider', x.company || ''],
      ['Confirmation', x.confirmation || ''],
      ['Phone', x.phone || '']
    ])];
    if (x.notes) kids.push(h('p', { class: 'ld-prose', text: x.notes }));
    ldConf(kids, x);
    return ldCard(no, x.type || 'Private transfer', [x.from, x.to].filter(Boolean).join('  →  '), kids, 'transport');
  }
  function ldEntCard(no, x) {
    var kids = [ldPills([
      ['Date', x.date ? fmtDate(x.date) : ''],
      ['Time', x.time ? fmtTime(x.time) : ''],
      ['Where', [x.location, x.address].filter(Boolean).join(' · ')],
      ['Party size', x.party || ''],
      ['Confirmation', x.confirmation || ''],
      ['Phone', x.phone || '']
    ])];
    if (x.notes) kids.push(h('p', { class: 'ld-prose', text: x.notes }));
    ldConf(kids, x);
    return ldCard(no, x.name || 'Experience', x.category || (x.kind === 'dining' ? 'Dining' : 'Experience'), kids, x.kind === 'dining' ? 'dining' : 'experience');
  }
  function ldCruiseCard(no, x) {
    var kids = [ldPills([
      ['Embarks', [x.embark_port, x.embark_date ? fmtDate(x.embark_date) : '', x.embark_time ? fmtTime(x.embark_time) : ''].filter(Boolean).join(' · ')],
      ['Disembarks', [x.disembark_port, x.disembark_date ? fmtDate(x.disembark_date) : '', x.disembark_time ? fmtTime(x.disembark_time) : ''].filter(Boolean).join(' · ')],
      ['Suite', x.cabin || ''],
      ['Deck and cabin', x.deck || ''],
      ['Booking', x.confirmation || ''],
      ['Phone', x.phone || '']
    ])];
    if (x.notes) kids.push(h('p', { class: 'ld-prose', text: x.notes }));
    ldConf(kids, x);
    return ldCard(no, x.ship || 'Your cruise', x.line || 'Cruise', kids, 'cruise');
  }
  function ldDayCard(x) {
    return h('div', { class: 'ld-note ld-day' }, [
      h('div', { class: 'ld-sumlabel', text: x.date ? fmtDate(x.date) : 'Your day' }),
      x.title ? h('p', { class: 'ld-day-title', text: x.title }) : null,
      x.body ? h('p', { class: 'ld-prose', text: x.body }) : null
    ]);
  }
  function ldBanner(city) {
    return h('section', { class: 'ld-banner ld-page' }, [
      h('div', { class: 'ld-banner-img bv-ph', 'data-city': city.city || '' }),
      h('div', { class: 'ld-banner-cap' }, [h('div', { class: 'ld-banner-eyebrow', text: 'Arriving in' }), h('h2', { class: 'ld-banner-city', text: city.city || '' })])
    ]);
  }
  /* chronological chapters: flights carry you to each stay city; that city's reservations follow */
  function ldEvents(it) {
    var segs = (it.segments || []).slice();
    segs.sort(function (a, b) { return ('' + (a.depart_date || '') + (a.depart_time || '')).localeCompare('' + (b.depart_date || '') + (b.depart_time || '')); });
    var seq = citySeq(segs), origin = seq[0];
    var dests = seq.slice(1).filter(function (c) { return !origin || c.code !== origin.code; });
    var out = [], used = { h: {}, t: {}, e: {} }, si = 0;
    dests.forEach(function (c) {
      out.push({ type: 'banner', city: c });
      while (si < segs.length) { var s = segs[si]; out.push({ type: 'flight', s: s, prev: si > 0 ? segs[si - 1] : null }); si++; if (s.to && s.to.code === c.code) break; }
      var items = [];
      (it.hotels || []).forEach(function (x, i) { if (!used.h[i] && bvMatchCity((x.location || '') + ' ' + (x.address || ''), c)) { used.h[i] = 1; items.push({ type: 'hotel', x: x, d: '' + (x.checkin_date || '') + (x.checkin_time || '') }); } });
      (it.transport || []).forEach(function (x, i) { if (!used.t[i] && bvMatchCity((x.from || '') + ' ' + (x.to || ''), c)) { used.t[i] = 1; items.push({ type: 'transport', x: x, d: '' + (x.date || '') + (x.time || '') }); } });
      (it.entertainment || []).forEach(function (x, i) { if (!used.e[i] && bvMatchCity((x.location || '') + ' ' + (x.address || ''), c)) { used.e[i] = 1; items.push({ type: 'ent', x: x, d: '' + (x.date || '') + (x.time || '') }); } });
      items.sort(function (a, b) { return a.d.localeCompare(b.d); });
      items.forEach(function (i) { out.push(i); });
    });
    var extras = [];
    (it.hotels || []).forEach(function (x, i) { if (!used.h[i]) extras.push({ type: 'hotel', x: x, d: '' + (x.checkin_date || '') }); });
    (it.transport || []).forEach(function (x, i) { if (!used.t[i]) extras.push({ type: 'transport', x: x, d: '' + (x.date || '') }); });
    (it.entertainment || []).forEach(function (x, i) { if (!used.e[i]) extras.push({ type: 'ent', x: x, d: '' + (x.date || '') }); });
    extras.sort(function (a, b) { return a.d.localeCompare(b.d); });
    if (extras.length) { out.push({ type: 'label', text: 'More reservations' }); extras.forEach(function (x) { out.push(x); }); }
    if (si < segs.length) {
      out.push({ type: 'label', text: 'The Journey Home' + (origin && origin.city ? ' — back to ' + origin.city : '') });
      while (si < segs.length) { out.push({ type: 'flight', s: segs[si], prev: si > 0 ? segs[si - 1] : null }); si++; }
    }
    return out;
  }
  var LD_PDF = { format: 'letter', margin: 0, bg: '#F4EDDF', fill: true };
  function ldMast(eyebrow) {
    return h('header', { class: 'ld-mast' }, [
      h('div', { class: 'ld-brand' }, [h('span', { class: 'ld-mark' }), h('span', { class: 'ld-brand-name', text: agencyName() })]),
      h('div', { class: 'ld-mast-r' }, [h('div', { class: 'ld-eyebrow', text: eyebrow }), (state.settings && state.settings.agency_tagline) ? h('div', { class: 'ld-mast-sub', text: state.settings.agency_tagline }) : null])
    ]);
  }
  function ldCover(kicker, title, pills) {
    var p = state.profile || {}, who = [p.first_name, p.last_name].filter(Boolean).join(' ');
    return h('div', { class: 'ld-cover' }, [
      h('div', { class: 'ld-kicker', text: kicker }),
      h('h1', { class: 'ld-h1', text: title }),
      h('div', { class: 'ld-rule' }),
      who ? h('p', { class: 'ld-prepared', text: 'Prepared exclusively for ' + who }) : null,
      ldPills(pills)
    ]);
  }
  function ldFooter(num) {
    return h('footer', { class: 'ld-footer' }, [
      h('div', null, [h('div', { class: 'ld-footer-brand' }, [h('span', { class: 'ld-mark' }), h('span', { class: 'ld-footer-name', text: agencyName() })]), (state.settings && state.settings.agency_tagline) ? h('div', { class: 'ld-footer-tag', text: state.settings.agency_tagline }) : null]),
      h('div', { class: 'ld-footer-tag', text: [(state.settings && state.settings.agency_phone) || '', num || ''].filter(Boolean).join('   ·   ') })
    ]);
  }
  /* fine print shown on the itinerary (beautiful view + PDF) so nobody treats a stock photo
     or a scheduled time as a guarantee */
  function itinDisclaimer() {
    return 'Photos are for inspiration, some via Pexels, and may not show the exact room, aircraft or venue. Flight times and schedules can change, and delays happen. We keep an eye on your trip and let you know as soon as we hear of a change. Please check your tickets and confirmations for the final details before you travel.';
  }
  function ldRouting(row) {
    return h('article', { class: 'ld-card' }, (row.segments || []).map(function (seg, i) {
      var role = segRole(row.trip_type, i, row.segments.length);
      var when = [seg.depart_date ? fmtDate(seg.depart_date) : '', seg.return_date ? '– ' + fmtDate(seg.return_date) : ''].filter(Boolean).join(' ');
      var times = [seg.depart_time ? fmtTime(seg.depart_time) : '', seg.arrive_time ? fmtTime(seg.arrive_time) : ''].filter(Boolean).join(' → ');
      return h('div', { class: 'ld-route' }, [
        h('div', { class: 'ld-route-l' }, [
          role ? h('div', { class: 'ld-route-role', text: role }) : null,
          h('div', { class: 'ld-route-city', text: seg.from.city + '  →  ' + seg.to.city }),
          h('div', { class: 'ld-route-sub', text: [seg.from.code + ' → ' + seg.to.code, seg.airline, seg.cabin, seg.flight_number].filter(Boolean).join('  ·  ') })
        ]),
        (when || times) ? h('div', { class: 'ld-route-r' }, [when ? h('div', { text: when }) : null, times ? h('div', { class: 'ld-route-sub', text: times }) : null]) : null
      ]);
    }));
  }
  function ldCharges(items, cur, totals) {
    var kids = items.map(function (it) {
      return h('div', { class: 'ld-charge' }, [
        h('div', null, [h('div', { class: 'ld-charge-label', text: it.label }), it.detail ? h('div', { class: 'ld-route-sub', text: it.detail }) : null]),
        h('div', { class: 'ld-charge-amt', text: money(Number(it.amount) || 0, cur) })
      ]);
    });
    totals.forEach(function (t) { if (!t) return; kids.push(h('div', { class: 'ld-charge ld-total' + (t[2] ? ' is-due' : '') }, [h('div', { class: 'ld-charge-label', text: t[0] }), h('div', { class: 'ld-charge-amt', text: t[1] })])); });
    return h('article', { class: 'ld-card' }, kids);
  }
  function ldSave(comp, total, cur) {
    return h('div', { class: 'ld-save' }, [
      h('div', { class: 'ld-save-k', text: 'Comparable price booked elsewhere ' + money(comp, cur) }),
      h('div', { class: 'ld-save-big' }, [h('span', { text: 'You saved ' }), h('b', { text: money(comp - total, cur) })])
    ]);
  }
  function itinDoc(it) {
    _bvCityOverride = (it && it.city_images) || {};
    var doc = h('div', { class: 'ldoc' });
    doc.appendChild(ldMast('Private Itinerary'));
    doc.appendChild(ldCover('Bespoke Journey', it.title || it.destination || 'Your journey', [
      ['Dates', itinDateRange(it)],
      ['Travelers', paxText(it)],
      ['Cabin', (it.segments && it.segments[0] && it.segments[0].cabin) || ''],
      ['Itinerary', it.itinerary_number ? 'No. ' + it.itinerary_number : '']
    ]));
    if (it.destination && it.destination !== it.title) doc.appendChild(h('p', { class: 'ld-dest', text: it.destination }));
    if (it.traveler_names) doc.appendChild(h('p', { class: 'ld-party', text: 'Traveling party: ' + travelerList(it.traveler_names).join(', ') }));
    var no = 0;
    ldEvents(it).forEach(function (ev) {
      if (ev.type === 'banner') doc.appendChild(ldBanner(ev.city));
      else if (ev.type === 'label') doc.appendChild(h('div', { class: 'ld-group-label ld-page', text: ev.text }));
      else if (ev.type === 'flight') doc.appendChild(ldFlightCard(++no, ev.s, ev.prev));
      else if (ev.type === 'hotel') doc.appendChild(ldHotelCard(++no, ev.x));
      else if (ev.type === 'transport') doc.appendChild(ldTransportCard(++no, ev.x));
      else if (ev.type === 'ent') doc.appendChild(ldEntCard(++no, ev.x));
    });
    if (it.cruises && it.cruises.length) { doc.appendChild(h('div', { class: 'ld-group-label ld-page', text: 'The Voyage' })); it.cruises.forEach(function (cx) { doc.appendChild(ldCruiseCard(++no, cx)); }); }
    var ldDN = (it.day_notes || []).slice().sort(function (a, b) { return ('' + (a.date || '')).localeCompare('' + (b.date || '')); });
    if (ldDN.length) { doc.appendChild(h('div', { class: 'ld-group-label ld-page', text: 'Day by Day' })); ldDN.forEach(function (dx) { doc.appendChild(ldDayCard(dx)); }); }
    if (it.notes) doc.appendChild(h('div', { class: 'ld-note' }, [h('div', { class: 'ld-sumlabel', text: 'From your specialist' }), h('p', { text: it.notes })]));
    if (it.documents && it.documents.length) doc.appendChild(h('div', { class: 'ld-note' }, [h('div', { class: 'ld-sumlabel', text: 'Travel documents' }), h('p', { class: 'ld-prose', text: it.documents.map(function (dz) { return dz.name; }).filter(Boolean).join('  ·  ') + '. Open them any time from your online itinerary.' })]));
    doc.appendChild(h('p', { class: 'ld-disclaimer', text: itinDisclaimer() }));
    doc.appendChild(ldFooter(it.itinerary_number));
    return doc;
  }
  function itinPdfName(it) { return 'Itinerary-' + (it.itinerary_number || 'flyupgrade') + '.pdf'; }
  /* direct download: render the doc off-screen, let the photos resolve, then save — no overlay step */
  function downloadItinPDF(it, btn) {
    var t0 = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
    var holder = h('div', { style: 'position:fixed; left:-10000px; top:0; width:850px; overflow:hidden;' }, [itinDoc(it)]);
    document.body.appendChild(holder);
    loadBvImages(holder);
    var waited = 0;
    var iv = setInterval(function () {
      waited += 300;
      if (holder.querySelectorAll('.bv-ph:not(.bv-has-img)').length && waited < 3600) return;
      clearInterval(iv);
      makeDocPDF(holder.firstChild, itinPdfName(it), 'save', LD_PDF);
      setTimeout(function () { if (holder.parentNode) holder.parentNode.removeChild(holder); if (btn) { btn.disabled = false; btn.textContent = t0; } }, 1500);
    }, 300);
  }
  /* "Add to calendar" export: one .ics file with every flight, stay and reservation */
  function icsEsc(t) { return ('' + (t || '')).split('\\').join('\\\\').split(';').join('\\;').split(',').join('\\,').split('\n').join('\\n'); }
  function icsDT(date, time) {
    var d = ('' + (date || '')).split('-').join(''); if (d.length !== 8) return '';
    var m = ('' + (time || '')).match(/(\d{1,2}):(\d{2})/);
    return d + 'T' + (m ? ('0' + m[1]).slice(-2) + m[2] + '00' : '090000');
  }
  function icsPlusHours(date, time, hrs) {
    var m = ('' + (time || '')).match(/(\d{1,2}):(\d{2})/);
    var dt = new Date(date + 'T' + (m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '09:00') + ':00');
    if (isNaN(dt)) return '';
    dt.setTime(dt.getTime() + hrs * 3600000);
    function p2(n) { return ('0' + n).slice(-2); }
    return '' + dt.getFullYear() + p2(dt.getMonth() + 1) + p2(dt.getDate()) + 'T' + p2(dt.getHours()) + p2(dt.getMinutes()) + '00';
  }
  function downloadICS(it) {
    var lines = [], base = (it.itinerary_number || 'trip') + '-' + (it.id || '');
    function ev(uid, fields) {
      lines.push('BEGIN:VEVENT'); lines.push('UID:' + uid + '-' + base + '@flyupgrade.com');
      fields.forEach(function (f) { if (f && f[1]) lines.push(f[0] + ':' + f[1]); });
      lines.push('END:VEVENT');
    }
    (it.segments || []).forEach(function (s, i) {
      if (!s.depart_date) return;
      var start = icsDT(s.depart_date, s.depart_time); if (!start) return;
      var endDate = s.arrive_date || s.return_date || bvArriveDate(s) || s.depart_date;
      var end = s.arrive_time ? icsDT(endDate, s.arrive_time) : icsPlusHours(s.depart_date, s.depart_time, 3);
      ev('flight' + i, [
        ['DTSTART', start], ['DTEND', end || start],
        ['SUMMARY', icsEsc('Flight ' + [s.flight_number, ((s.from && s.from.code) || '') + ' to ' + ((s.to && s.to.code) || '')].filter(Boolean).join(', '))],
        ['LOCATION', icsEsc((s.from && (s.from.name || s.from.city)) || '')],
        ['DESCRIPTION', icsEsc([s.airline, s.cabin, seatStr(s.seats) ? 'Seats ' + seatStr(s.seats) : '', s.confirmation ? 'Confirmation ' + s.confirmation : ''].filter(Boolean).join(', '))]
      ]);
    });
    (it.hotels || []).forEach(function (x2, i) {
      if (!x2.checkin_date) return;
      ev('hotel' + i, [
        ['DTSTART;VALUE=DATE', x2.checkin_date.split('-').join('')],
        ['DTEND;VALUE=DATE', (x2.checkout_date || x2.checkin_date).split('-').join('')],
        ['SUMMARY', icsEsc('Stay: ' + (x2.name || 'Hotel'))],
        ['LOCATION', icsEsc([x2.address, x2.location].filter(Boolean).join(', '))],
        ['DESCRIPTION', icsEsc([x2.room, x2.confirmation ? 'Confirmation ' + x2.confirmation : ''].filter(Boolean).join(', '))]
      ]);
    });
    (it.transport || []).forEach(function (x2, i) {
      if (!x2.date) return; var st = icsDT(x2.date, x2.time); if (!st) return;
      ev('transfer' + i, [['DTSTART', st], ['DTEND', icsPlusHours(x2.date, x2.time, 1) || st], ['SUMMARY', icsEsc((x2.type || 'Transfer') + (x2.to ? ' to ' + x2.to : ''))], ['LOCATION', icsEsc(x2.from || '')], ['DESCRIPTION', icsEsc([x2.company, x2.driver, x2.car, x2.confirmation ? 'Confirmation ' + x2.confirmation : ''].filter(Boolean).join(', '))]]);
    });
    (it.entertainment || []).forEach(function (x2, i) {
      if (!x2.date) return; var st = icsDT(x2.date, x2.time); if (!st) return;
      ev('res' + i, [['DTSTART', st], ['DTEND', icsPlusHours(x2.date, x2.time, 2) || st], ['SUMMARY', icsEsc(x2.name || 'Reservation')], ['LOCATION', icsEsc([x2.address, x2.location].filter(Boolean).join(', '))], ['DESCRIPTION', icsEsc([x2.category, x2.confirmation ? 'Confirmation ' + x2.confirmation : ''].filter(Boolean).join(', '))]]);
    });
    (it.cruises || []).forEach(function (x2, i) {
      if (!x2.embark_date) return; var st = icsDT(x2.embark_date, x2.embark_time); if (!st) return;
      ev('cruise' + i, [['DTSTART', st], ['DTEND', (x2.disembark_date ? icsDT(x2.disembark_date, x2.disembark_time) : '') || st], ['SUMMARY', icsEsc('Cruise: ' + [x2.ship, x2.line].filter(Boolean).join(', '))], ['LOCATION', icsEsc(x2.embark_port || '')], ['DESCRIPTION', icsEsc([x2.cabin, x2.deck, x2.confirmation ? 'Booking ' + x2.confirmation : ''].filter(Boolean).join(', '))]]);
    });
    if (!lines.length) return;
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Upgrade Travel//Itinerary//EN', 'CALSCALE:GREGORIAN'].concat(lines, ['END:VCALENDAR']).join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: ((it.title || 'Trip').split('/').join(' ').trim() || 'Trip') + '.ics' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) { } a.remove(); }, 500);
  }
  function itinTripCard(it, coveredBookings, opts) {
    opts = opts || {};
    var card = h('article', { class: 'trip-card itin-card' + (opts.own ? ' itin-card--own' : '') });
    var seq = citySeq(it.segments || []);
    var route = seq.length ? seq.map(function (c) { return c.code; }).join(' → ') : '';
    /* the headline destination photo — first stay city, honoring dad's picked city image */
    var destCity = (seq[1] && seq[1].city) || (seq.length ? seq[seq.length - 1].city : '') || ((it.destination || '').split(/,|&| and /)[0] || '').trim();
    if (destCity) {
      var photoAttrs = { class: 'itin-card-photo bv-ph', 'data-city': destCity };
      var override = (it.city_images || {})[destCity];
      if (override) photoAttrs['data-img'] = override;
      card.appendChild(h('div', photoAttrs));
    }
    card.appendChild(h('div', { class: 'trip-top' }, [h('div', null, [h('h4', { class: 'trip-route', text: it.title || it.destination || 'Your trip' }), route ? h('p', { class: 'trip-codes', text: route }) : null]), h('span', { class: 'itin-badge', text: 'Itinerary' })]));
    var chips = [];
    if (opts.own) chips.push(h('span', { class: 'trip-chip trip-chip--you', text: 'Your trip' }));
    var itTtl = tripTypeLabel(it.trip_type); if (itTtl) chips.push(h('span', { class: 'trip-chip trip-chip--type', text: itTtl }));
    if (it.destination) chips.push(h('span', { class: 'trip-chip', text: it.destination }));
    var dates = itinDateRange(it); if (dates) chips.push(h('span', { class: 'trip-chip', text: dates }));
    chips.push(h('span', { class: 'trip-chip', text: paxText(it) }));
    var sv = itinSavings(it); if (sv > 0) chips.push(h('span', { class: 'trip-chip trip-chip--save', text: 'You save ' + money(sv, it.currency) }));
    card.appendChild(h('div', { class: 'trip-meta' }, chips));
    if (it.traveler_names) { var tl = travelerList(it.traveler_names); if (tl.length) card.appendChild(h('p', { class: 'itin-travelers' }, [h('span', { class: 'itin-travelers-k', text: 'Travelers' }), h('span', { text: tl.join(', ') })])); }
    var sum = [], nf = (it.segments || []).length, nh = (it.hotels || []).length, nt = (it.transport || []).length, ne = (it.entertainment || []).length;
    if (nf) sum.push(nf + (nf > 1 ? ' flights' : ' flight'));
    if (nh) sum.push(nh + (nh > 1 ? ' hotels' : ' hotel'));
    if (nt) sum.push(nt + (nt > 1 ? ' transfers' : ' transfer'));
    if (ne) sum.push(ne + (ne > 1 ? ' experiences' : ' experience'));
    if (sum.length) card.appendChild(h('p', { class: 'itin-sum', text: sum.join('  ·  ') }));
    /* flight bookings that belong to this trip fold in as slim rows instead of duplicate cards */
    (coveredBookings || []).forEach(function (b) {
      var bits = [[b.airline, b.flight_number].filter(Boolean).join(' '), b.confirmation_code ? 'Confirmation ' + b.confirmation_code : '', (Number(b.amount_saved) > 0) ? 'You saved ' + money(b.amount_saved, b.currency) : ''].filter(Boolean);
      if (bits.length) card.appendChild(h('p', { class: 'itin-subrow', text: 'Flight booking  ·  ' + bits.join('  ·  ') }));
    });
    var itStamp = cardStamp(it); if (itStamp) card.appendChild(itStamp);
    card.appendChild(h('div', { class: 'itin-card-foot' }, [
      h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { openBeautiful(it); }, text: 'View itinerary' }),
      h('button', { type: 'button', class: 'btn btn-ghost itin-pdf-btn', onclick: function () { openOverlay(itinDoc(it), itinPdfName(it), LD_PDF); }, text: 'View itinerary PDF' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function (e) { downloadItinPDF(it, e.target); }, text: 'Download PDF' }),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { downloadICS(it); }, text: 'Add to calendar' })
    ]));
    return card;
  }
  /* customer invoice — the same editorial paper language as the itinerary */
  function invoiceDoc(inv) {
    var cur = inv.currency;
    var total = Number(inv.total_charged) || 0, paid = Number(inv.amount_paid) || 0, bal = Math.max(total - paid, 0);
    var comp = Number(inv.comparable_total) || 0;
    var doc = h('div', { class: 'ldoc' });
    doc.appendChild(ldMast('Invoice'));
    doc.appendChild(ldCover('Statement of Charges', inv.title || ('Invoice ' + (inv.invoice_number || '')), [
      ['Invoice', inv.invoice_number ? 'No. ' + inv.invoice_number : ''],
      ['Issued', fmtDate(inv.created_at || new Date().toISOString())],
      ['Balance due', (inv.due_date && bal > 0.001) ? fmtDate(inv.due_date) : ''],
      ['Travelers', paxText(inv)],
      ['Ref', inv.booking_reference || '']
    ]));
    var ivDest = ((inv.segments && inv.segments[0] && inv.segments[0].to && inv.segments[0].to.city) || (inv.destination || '').split(',')[0] || '').trim();
    if (ivDest) doc.appendChild(h('section', { class: 'ld-banner ld-banner--doc' }, [h('div', { class: 'ld-banner-img bv-ph', 'data-city': ivDest }), h('div', { class: 'ld-banner-cap' }, [h('div', { class: 'ld-banner-eyebrow', text: 'Your journey to' }), h('h2', { class: 'ld-banner-city', text: ivDest })])]));
    if (inv.segments && inv.segments.length) { doc.appendChild(h('div', { class: 'ld-group-label', text: 'The Routing' })); doc.appendChild(ldRouting(inv)); }
    doc.appendChild(h('div', { class: 'ld-group-label', text: 'The Charges' }));
    var totals = [['Total', money(total, cur), paid <= 0]];
    if (paid > 0) { totals.push(['Paid to date', '− ' + money(paid, cur), false]); totals.push([bal > 0.001 ? 'Balance due' : 'Settled in full', money(bal, cur), true]); }
    doc.appendChild(ldCharges(inv.line_items || [], cur, totals));
    if (comp > total) doc.appendChild(ldSave(comp, total, cur));
    if (bal > 0.001) {
      var s2 = state.settings || {};
      var PAY = { wire: ['Wire / bank transfer', s2.payment_details], stripe: ['Pay by card', s2.pay_stripe], paypal: ['PayPal', s2.pay_paypal], zelle: ['Zelle', s2.pay_zelle] };
      var keys = (inv.payment_methods && inv.payment_methods.length) ? inv.payment_methods : (s2.payment_details ? ['wire'] : []);
      var chosen = keys.map(function (k) { return PAY[k]; }).filter(function (m) { return m && ('' + (m[1] || '')).trim(); });
      if (chosen.length) doc.appendChild(h('div', { class: 'ld-note' }, [h('div', { class: 'ld-sumlabel', text: 'How to pay' })].concat(chosen.map(function (m) {
        var v = ('' + m[1]).trim();
        var isUrl = /^https?:\/\//i.test(v);
        return h('div', { class: 'ld-pay-row' }, [
          h('span', { class: 'ld-pay-k', text: m[0] }),
          isUrl ? h('a', { href: v, target: '_blank', rel: 'noopener', class: 'ld-paylink', text: v }) : h('span', { class: 'ld-pay-v', text: v })
        ]);
      }))));
    }
    if (inv.notes) doc.appendChild(h('div', { class: 'ld-note' }, [h('div', { class: 'ld-sumlabel', text: 'From your specialist' }), h('p', { text: inv.notes })]));
    doc.appendChild(h('p', { class: 'ld-terms', text: (state.settings && state.settings.invoice_terms) || 'Fares and availability are confirmed at time of ticketing. Cancellation and change terms vary by fare and supplier; ask your agent for the rules that apply to this booking.' }));
    doc.appendChild(ldFooter(inv.invoice_number));
    return doc;
  }
  /* customer quote — the same editorial paper language as the itinerary */
  function quoteDoc(q) {
    var cur = q.currency;
    var total = (q.line_items && q.line_items.length) ? q.line_items.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0) : (Number(q.total_charged) || 0);
    var comp = Number(q.comparable_total) || 0;
    var doc = h('div', { class: 'ldoc' });
    doc.appendChild(ldMast('Private Quote'));
    doc.appendChild(ldCover('Prepared For You', q.title || q.destination || 'Your quote', [
      ['Quote', q.quote_number ? 'No. ' + q.quote_number : ''],
      ['Issued', fmtDate(q.created_at || new Date().toISOString())],
      ['Valid until', q.valid_until ? fmtDate(q.valid_until) : ''],
      ['Travelers', paxText(q)],
      ['Ref', q.booking_reference || '']
    ]));
    var qDest = ((q.segments && q.segments[0] && q.segments[0].to && q.segments[0].to.city) || (q.destination || '').split(',')[0] || '').trim();
    if (qDest) doc.appendChild(h('section', { class: 'ld-banner ld-banner--doc' }, [h('div', { class: 'ld-banner-img bv-ph', 'data-city': qDest }), h('div', { class: 'ld-banner-cap' }, [h('div', { class: 'ld-banner-eyebrow', text: 'Your journey to' }), h('h2', { class: 'ld-banner-city', text: qDest })])]));
    if (q.segments && q.segments.length) { doc.appendChild(h('div', { class: 'ld-group-label', text: 'The Routing' })); doc.appendChild(ldRouting(q)); }
    doc.appendChild(h('div', { class: 'ld-group-label', text: 'The Pricing' }));
    doc.appendChild(ldCharges(q.line_items || [], cur, [['Quote total', money(total, cur), true]]));
    if (comp > total) doc.appendChild(ldSave(comp, total, cur));
    if (q.options && q.options.length) {
      doc.appendChild(h('div', { class: 'ld-group-label', text: 'Your Options' }));
      q.options.forEach(function (o) {
        var ot = Number(o.total) || 0, oc = Number(o.comparable) || 0;
        doc.appendChild(h('div', { class: 'ld-note ld-opt' }, [
          h('div', { class: 'ld-sumlabel', text: (o.label || 'Option') + (q.chosen_option === o.label ? '  ·  chosen' : '') }),
          o.desc ? h('p', { class: 'ld-prose', text: o.desc }) : null,
          h('p', { class: 'ld-opt-price', text: money(ot, cur) + (oc > ot ? ', compared to ' + money(oc, cur) + ' booked elsewhere' : '') })
        ]));
      });
    }
    if (q.notes) doc.appendChild(h('div', { class: 'ld-note' }, [h('div', { class: 'ld-sumlabel', text: 'From your specialist' }), h('p', { text: q.notes })]));
    doc.appendChild(h('p', { class: 'ld-terms', text: (state.settings && state.settings.quote_terms) || ('This quote is an estimate' + (q.valid_until ? ', valid until ' + fmtDate(q.valid_until) : '') + '. Fares and availability are confirmed at the time of ticketing and may change until then.') }));
    doc.appendChild(ldFooter(q.quote_number));
    return doc;
  }
  function invoiceCard(inv) {
    var total = Number(inv.total_charged) || 0, paid = Number(inv.amount_paid) || 0, bal = Math.max(total - paid, 0);
    var st = bal <= 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'), stLabel = st === 'paid' ? 'Paid' : st === 'partial' ? 'Part-paid' : 'Due';
    var card = h('article', { class: 'trip-card invoice-card' });
    var route = (inv.segments && inv.segments.length) ? inv.segments.map(function (s) { return s.from.code + ' → ' + s.to.code; }).join('    ') : '';
    card.appendChild(h('div', { class: 'trip-top' }, [h('div', null, [h('h4', { class: 'trip-route', text: inv.title || ('Invoice ' + (inv.invoice_number || '')) }), route ? h('p', { class: 'trip-codes', text: route }) : null]), h('span', { class: 'inv-pay-badge inv-pay--' + st, text: stLabel })]));
    var chips = [h('span', { class: 'trip-chip', text: inv.invoice_number || '' }), h('span', { class: 'trip-chip', text: fmtDate(inv.created_at) })];
    var invTtl = tripTypeLabel(inv.trip_type); if (invTtl) chips.unshift(h('span', { class: 'trip-chip trip-chip--type', text: invTtl }));
    if (inv.destination) chips.unshift(h('span', { class: 'trip-chip', text: inv.destination }));
    card.appendChild(h('div', { class: 'trip-meta' }, chips));
    var mk = [h('div', { class: 'trip-paid' }, [h('span', { text: 'Total' }), h('strong', { text: money(total, inv.currency) })])];
    if (bal > 0) mk.push(h('div', { class: 'trip-saved' }, [h('span', { text: 'Balance due' }), h('strong', { text: money(bal, inv.currency) })]));
    card.appendChild(h('div', { class: 'trip-money' }, mk));
    var invStamp = cardStamp(inv); if (invStamp) card.appendChild(invStamp);
    card.appendChild(h('div', { class: 'itin-card-foot' }, [h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { openOverlay(invoiceDoc(inv), 'Invoice-' + (inv.invoice_number || 'flyupgrade') + '.pdf', LD_PDF); }, text: 'View invoice' })]));
    return card;
  }
  function sectionInvoices() {
    var ivs = state.invoices || [];
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'Invoices' }));
    if (ivs.length) {
      /* top line: what is owed right now, or the quiet all-clear */
      var outstanding = 0, dueDates = [];
      ivs.forEach(function (iv) { var b = Math.max((Number(iv.total_charged) || 0) - (Number(iv.amount_paid) || 0), 0); if (b > 0.001) { outstanding += b; if (iv.due_date) dueDates.push(iv.due_date); } });
      if (outstanding > 0.001) {
        dueDates.sort();
        var pay = state.settings && state.settings.payment_details;
        wrap.appendChild(h('div', { class: 'acct-balance' }, [
          h('div', { class: 'acct-balance-main' }, [
            h('span', { class: 'acct-balance-k', text: 'Balance outstanding' + (dueDates.length ? ' · due by ' + fmtDate(dueDates[0]) : '') }),
            h('span', { class: 'acct-balance-v', text: money(outstanding, (ivs[0] && ivs[0].currency) || 'USD') })
          ]),
          pay ? h('p', { class: 'acct-balance-pay', text: pay }) : null
        ]));
      } else {
        wrap.appendChild(h('p', { class: 'acct-settled', text: 'All invoices settled — thank you.' }));
      }
      wrap.appendChild(h('div', { class: 'trip-list' }, ivs.map(invoiceCard)));
    }
    else wrap.appendChild(h('div', { class: 'acct-empty' }, [emptyIc('invoices'), h('p', null, h('strong', { text: 'No invoices yet.' })), h('p', { text: 'Invoices for your booked trips will appear here.' })]));
    return wrap;
  }

  /* ---------- beautiful itinerary view (showpiece) ---------- */
  var CABIN_PERKS = {
    first: [['Private lie-flat suite', 'Fully enclosed, with turn-down service and premium bedding'], ['À la carte fine dining', 'A chef-designed menu served on your schedule'], ['Suite & lounge privileges', 'Dedicated check-in, fast-track security and flagship lounges'], ['Onboard indulgences', 'Shower spa or onboard bar on select aircraft']],
    business: [['Lie-flat bed', 'Direct-aisle access on most aircraft'], ['Multi-course dining', 'Chef-designed menus with a full bar'], ['Premium lounge access', 'Before every departure'], ['Priority everything', 'Check-in, boarding and baggage']],
    premium: [['Extra space & deep recline', 'A wider seat with generous legroom'], ['Elevated dining', 'Upgraded meals and amenities'], ['Priority boarding', 'Settle in ahead of the cabin']],
    economy: [['Reserved seating', 'Your seats secured together'], ['Full service', 'Meals and checked baggage included']]
  };
  /* curated, airline-specific cabin products (verified) — falls back to the generic set above */
  var CABIN_PRODUCTS = {
    turkish: {
      business: [['Fully lie-flat seat', 'Direct-aisle access in a 1-2-1 cabin on the 787-9 and A350'], ['Flying Chefs & DO&CO dining', 'Restaurant-style à la carte service on long-haul'], ['Turkish Airlines Lounge access', 'Including the flagship lounge in Istanbul'], ['Amenity kit & premium bedding', 'With attentive, dedicated cabin crew']],
      first: [['Private lie-flat suite', 'On select aircraft, with a personal minibar'], ['On-board Flying Chef', 'Multi-course dining on your schedule'], ['Flagship lounge & fast-track', 'The Turkish Airlines Lounge in Istanbul'], ['Priority service throughout', 'Check-in, security and boarding']],
      economy: [['Reserved seating', 'Your seats secured together'], ['DO&CO catering', 'Full meals and complimentary drinks'], ['Generous baggage', 'Checked allowance included']]
    },
    croatia: {
      business: [['Extra space up front', 'A blocked middle seat in the European 3-3 cabin'], ['Complimentary dining', 'A warm meal with full bar service'], ['Lounge access', 'At the departure airport'], ['Priority everything', 'Check-in, security, boarding and baggage']],
      economy: [['Reserved seating', 'Your seats secured together'], ['Snack & drink service', 'Complimentary on board'], ['Checked baggage', 'Allowance included']]
    },
    emirates: {
      first: [['Private suite with doors', 'Fully enclosed, with a personal minibar'], ['Onboard Shower Spa', 'On the A380'], ['À la carte fine dining', 'Served any time, on your schedule'], ['Onboard Lounge & chauffeur', 'Complimentary door-to-door transfers']],
      business: [['Lie-flat seat', 'Direct-aisle access on the A380 and 777'], ['Onboard Lounge', 'Socialise in the air on the A380'], ['Gourmet multi-course dining', 'With a curated wine list'], ['Chauffeur-drive & lounge', 'Complimentary transfers on most fares']],
      economy: [['Reserved seating', 'Your seats secured together'], ['ice entertainment', 'Thousands of channels on demand'], ['Full meal service', 'With generous baggage']]
    },
    qatar: {
      business: [['Qsuite', 'A private suite with a closing door and lie-flat bed'], ['Dine on demand', 'Restaurant-style à la carte, any time'], ['Al Mourjan Lounge in Doha', 'Plus premium lounge access worldwide'], ['Adjustable double & quad', 'Configured for traveling together']],
      first: [['Private first suite', 'On select A380 aircraft'], ['À la carte fine dining', 'Served on your schedule'], ['Al Safwa First Lounge', 'The flagship lounge in Doha'], ['Designer amenities & bedding', 'Turn-down on request']],
      economy: [['Reserved seating', 'Your seats secured together'], ['Oryx One entertainment', 'The latest films and shows'], ['Full meal service', 'With generous baggage']]
    },
    singapore: {
      first: [['Private Suites / First', 'Sliding doors on the A380 Suites'], ['Book the Cook fine dining', 'Chef-designed, on your schedule'], ['The Private Room lounge', 'The flagship in Singapore'], ['Designer amenities & bedding', 'Premium turn-down service']],
      business: [['Lie-flat business seat', 'Among the widest, with direct-aisle access'], ['Book the Cook', 'Pre-order from an extended menu'], ['SilverKris Lounge access', 'Including the flagship in Singapore'], ['Premium bedding & amenities', 'Turn-down on request']]
    }
  };
  function bvAirlineKey(airline) { var a = (airline || '').toLowerCase(); if (a.indexOf('turkish') > -1) return 'turkish'; if (a.indexOf('croatia') > -1) return 'croatia'; if (a.indexOf('emirates') > -1) return 'emirates'; if (a.indexOf('qatar') > -1) return 'qatar'; if (a.indexOf('singapore') > -1) return 'singapore'; return ''; }
  function bvCabinKey(cabin) { var c = (cabin || '').toLowerCase(); if (c.indexOf('first') > -1) return 'first'; if (c.indexOf('business') > -1) return 'business'; if (c.indexOf('premium') > -1) return 'premium'; return 'economy'; }
  function cabinPerks(cabin, airline) { var ck = bvCabinKey(cabin), prod = CABIN_PRODUCTS[bvAirlineKey(airline)]; if (prod && prod[ck]) return prod[ck]; return CABIN_PERKS[ck] || CABIN_PERKS.economy; }
  /* via-cities that are just connections/layovers, not destinations: the leg is flagged as a
     connection, OR the traveler flies onward the same day they arrive (no overnight = no stay) */
  function bvPassthroughCodes(segs) {
    var pass = {};
    (segs || []).forEach(function (s, i) {
      if (!s || !s.from || !s.from.code || i === 0) return;
      var prev = segs[i - 1];
      if (!prev || !prev.to || prev.to.code !== s.from.code) return;
      if (s.connect_from_prev) { pass[s.from.code] = 1; return; }
      var ad = prev.return_date || bvArriveDate(prev);
      if (ad && s.depart_date && s.depart_date <= ad) pass[s.from.code] = 1;
    });
    return pass;
  }
  function citySeq(segs) { segs = segs || []; var layover = bvPassthroughCodes(segs); var seq = [], seen = {}; segs.forEach(function (s) { if (!s.from || !s.to) return;[[s.from.city, s.from.code], [s.to.city, s.to.code]].forEach(function (c) { if (c[0] && !seen[c[1]] && !layover[c[1]]) { seen[c[1]] = 1; seq.push({ city: c[0], code: c[1] }); } }); }); return seq; }
  /* per-city stay dates (arrive → depart) for the journey map */
  function bvArriveDate(s) { if (!s || !s.depart_date) return ''; if (s.arrive_time && s.depart_time && s.arrive_time < s.depart_time) { var dt = new Date(s.depart_date + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); } return s.depart_date; }
  function bvStays(seq, segs) { return seq.map(function (c, k) { if (k === 0) return { arrive: '', depart: '' }; var inSeg = null, outSeg = null, i; for (i = 0; i < segs.length; i++) { if (!inSeg && segs[i].to && segs[i].to.code === c.code) inSeg = segs[i]; } for (i = 0; i < segs.length; i++) { if (segs[i].from && segs[i].from.code === c.code) { outSeg = segs[i]; break; } } return { arrive: bvArriveDate(inSeg), depart: outSeg ? outSeg.depart_date : '' }; }); }
  function bvShortDate(d) { if (!d) return ''; return fmtDate(d).replace(/,?\s*\d{4}$/, ''); }
  /* animated flight-path map for "The Journey" */
  var BV_PLANE = 'M480 192H365.71L260.61 8.06A16 16 0 0 0 246.71 0h-65.5a16 16 0 0 0-15.42 20.42L214.85 192H112l-43.42-57.9a16 16 0 0 0-12.8-6.4H16.71A16.14 16.14 0 0 0 1.55 148.74L32 256 1.55 363.26A16.14 16.14 0 0 0 16.71 384H55.78a16 16 0 0 0 12.8-6.4L112 320h102.85L165.79 491.58A16 16 0 0 0 181.21 512h65.5a16 16 0 0 0 13.9-8.06L365.71 320H480c35.35 0 96-28.65 96-64s-60.65-64-96-64z';
  function sv(tag, attrs, kids) { var el = document.createElementNS('http://www.w3.org/2000/svg', tag); if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { if (c) el.appendChild(c); }); return el; }
  function bvJourney(seq, returnHome, stays) {
    stays = stays || [];
    var n = seq.length, W = 1000, baseY = 160, padX = 120;
    var xs = seq.map(function (c, i) { return n === 1 ? W / 2 : padX + (W - 2 * padX) * (i / (n - 1)); });
    var d = 'M' + xs[0] + ' ' + baseY, i;
    for (i = 1; i < n; i++) { var mx = (xs[i - 1] + xs[i]) / 2; d += ' Q' + mx + ' ' + (baseY - 82) + ' ' + xs[i] + ' ' + baseY; }
    if (returnHome && n >= 2) { var mx2 = (xs[n - 1] + xs[0]) / 2; d += ' Q' + mx2 + ' ' + (baseY - 250) + ' ' + xs[0] + ' ' + baseY; }
    var svg = sv('svg', { class: 'bv-map', 'data-return': returnHome ? '1' : '', viewBox: '0 0 1000 300', preserveAspectRatio: 'xMidYMid meet' });
    svg.appendChild(sv('path', { class: 'bv-map-path-bg', d: d, fill: 'none' }));
    svg.appendChild(sv('path', { class: 'bv-map-path', d: d, fill: 'none' }));
    seq.forEach(function (c, k) {
      svg.appendChild(sv('circle', { class: 'bv-map-halo', cx: xs[k], cy: baseY, r: 15 }));
      svg.appendChild(sv('circle', { class: 'bv-map-dot', cx: xs[k], cy: baseY, r: 6 }));
    });
    svg.appendChild(sv('g', { class: 'bv-plane' }, [sv('g', { transform: 'scale(0.08)' }, [sv('path', { d: BV_PLANE })])]));
    var labels = h('div', { class: 'bv-map-labels' }, seq.map(function (c, k) {
      var st = stays[k] || {};
      var stayEl = (st.arrive || st.depart) ? h('div', { class: 'bv-map-stay' }, [
        st.arrive ? h('span', { class: 'bv-stay-arr', text: bvShortDate(st.arrive) }) : null,
        (st.arrive && st.depart) ? h('span', { class: 'bv-stay-sep', text: ' – ' }) : null,
        st.depart ? h('span', { class: 'bv-stay-dep', text: bvShortDate(st.depart) }) : null
      ]) : null;
      return h('div', { class: 'bv-map-lab', style: 'left:' + (xs[k] / W * 100).toFixed(2) + '%' }, [h('div', { class: 'bv-map-city serif', text: c.city }), h('div', { class: 'bv-map-iata', text: c.code }), stayEl]);
    }));
    return h('div', { class: 'bv-map-wrap' }, [svg, labels]);
  }
  /* ---------- premium rotating globe (journey) ---------- */
  var AIRPORT_LL = {
    IAH: [29.98, -95.34], IAD: [38.95, -77.46], JFK: [40.64, -73.78], EWR: [40.69, -74.17], LGA: [40.78, -73.87], LAX: [33.94, -118.41], SFO: [37.62, -122.38], ORD: [41.98, -87.90], ATL: [33.64, -84.43], MIA: [25.79, -80.29], BOS: [42.36, -71.01], DFW: [32.90, -97.04], SEA: [47.45, -122.31], DEN: [39.86, -104.67], LAS: [36.08, -115.15], YYZ: [43.68, -79.61], YVR: [49.19, -123.18], MEX: [19.44, -99.07],
    LHR: [51.47, -0.46], LGW: [51.15, -0.19], CDG: [49.01, 2.55], AMS: [52.31, 4.76], FRA: [50.03, 8.57], MAD: [40.47, -3.56], BCN: [41.30, 2.08], FCO: [41.80, 12.25], MUC: [48.35, 11.79], ZRH: [47.46, 8.55], VIE: [48.11, 16.57], LIS: [38.77, -9.13], DUB: [53.42, -6.27], CPH: [55.62, 12.65], IST: [41.28, 28.75], ATH: [37.94, 23.95],
    DXB: [25.25, 55.36], DOH: [25.27, 51.61], AUH: [24.43, 54.65], JED: [21.68, 39.16], RUH: [24.96, 46.70], CAI: [30.11, 31.41], MLE: [4.19, 73.53], SEZ: [-4.67, 55.52], MRU: [-20.43, 57.68],
    SIN: [1.36, 103.99], HKG: [22.31, 113.91], NRT: [35.76, 140.39], HND: [35.55, 139.78], ICN: [37.46, 126.44], PEK: [40.08, 116.58], PVG: [31.14, 121.81], BKK: [13.69, 100.75], KUL: [2.75, 101.71], DEL: [28.56, 77.10], BOM: [19.09, 72.87], CMB: [7.18, 79.88], MFM: [22.15, 113.59],
    SYD: [-33.95, 151.18], MEL: [-37.67, 144.84], AKL: [-37.01, 174.79], JNB: [-26.14, 28.25], CPT: [-33.97, 18.60], NBO: [-1.32, 36.93], GRU: [-23.43, -46.47], EZE: [-34.82, -58.54], SCL: [-33.39, -70.79], LIM: [-12.02, -77.11]
  };
  var _geoLL = {};
  function bvCityLL(c, cb) {
    var code = ('' + (c.code || '')).toUpperCase();
    if (AIRPORT_LL[code]) { cb(AIRPORT_LL[code]); return; }
    var key = code + '|' + (c.city || '');
    if (_geoLL[key] !== undefined) { cb(_geoLL[key]); return; }
    fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(c.city || code) + '&limit=1&lang=en')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var f = j && j.features && j.features[0], co = f && f.geometry && f.geometry.coordinates; var ll = co ? [co[1], co[0]] : null; _geoLL[key] = ll; cb(ll); })
      .catch(function () { _geoLL[key] = null; cb(null); });
  }
  function bvGlobe(seq, segs, stays, returnHome) {
    segs = segs || [];
    var layoverCodes = bvPassthroughCodes(segs);
    var stops = [];
    segs.forEach(function (s, i) {
      if (i === 0 && s.from && s.from.code) stops.push({ city: s.from.city, code: s.from.code, arr: null });
      if (s.to && s.to.code && (!stops.length || stops[stops.length - 1].code !== s.to.code)) stops.push({ city: s.to.city, code: s.to.code, arr: s });
    });
    if (stops.length < 2) return h('div');
    stops.forEach(function (st, k) {
      var isLast = k === stops.length - 1, backHome = isLast && stops[0].code === st.code, layover = layoverCodes[st.code] && !isLast;
      if (k === 0) { st.role = 'Departure'; var d0 = segs[0] || {}; st.sub = [d0.depart_date ? fmtDate(d0.depart_date) : '', d0.depart_time ? fmtTime(d0.depart_time) : ''].filter(Boolean).join('  ·  '); }
      else if (backHome) { st.role = 'The journey home'; st.sub = st.arr ? ('Arrives ' + fmtDate(st.arr.return_date || bvArriveDate(st.arr))) : ''; }
      else if (layover) {
        /* the onward leg out of this stop — flagged as a connection or not */
        var nl = null, j;
        for (j = 0; j < segs.length; j++) { if (segs[j].connect_from_prev && segs[j].from && segs[j].from.code === st.code) { nl = segs[j]; break; } }
        if (!nl) { for (j = 0; j < segs.length; j++) { if (segs[j].from && segs[j].from.code === st.code && segs[j] !== st.arr) { nl = segs[j]; break; } } }
        st.role = nl ? bvLayoverWord(nl) : 'Layover';
        var dur = (nl && nl.layover_duration && ('' + nl.layover_duration).trim()) || ((st.arr && nl) ? bvLayoverDur(st.arr, nl) : '');
        st.sub = [st.arr && st.arr.arrive_time ? ('Arrive ' + fmtTime(st.arr.arrive_time)) : '', dur ? (dur + ' on the ground') : ''].filter(Boolean).join('  ·  ');
        st.note = nl && nl.layover_note ? nl.layover_note : '';
      } else {
        st.role = 'Destination'; var arr = st.arr ? (st.arr.return_date || bvArriveDate(st.arr)) : '', out = null;
        for (var m = 0; m < segs.length; m++) { if (segs[m].from && segs[m].from.code === st.code && segs[m] !== st.arr) { out = segs[m]; break; } }
        st.sub = [arr ? ('Arrive ' + fmtDate(arr)) : '', out && out.depart_date ? ('Depart ' + fmtDate(out.depart_date)) : ''].filter(Boolean).join('  ·  ');
      }
    });
    var wrap = h('div', { class: 'bv-globe' });
    var stage = h('div', { class: 'bv-globe-stage' });
    var canvas = document.createElement('canvas'); canvas.className = 'bv-globe-canvas'; stage.appendChild(canvas);
    var cap = h('div', { class: 'bv-globe-cap' });
    var left = h('div', { class: 'bv-globe-left' }, [stage, cap]);
    var panel = h('div', { class: 'bv-globe-panel' });
    var list = h('div', { class: 'bv-glist' });
    stops.forEach(function (st) {
      var detail = []; if (st.sub) detail.push(h('div', { class: 'bv-gli-sub', text: st.sub })); if (st.note) detail.push(h('div', { class: 'bv-gli-note', text: st.note }));
      st._el = h('div', { class: 'bv-gli is-future' }, [h('div', { class: 'bv-gli-role', text: st.role || '' }), h('div', { class: 'bv-gli-city serif', text: st.city || '' }), h('div', { class: 'bv-gli-detail' }, detail)]);
      list.appendChild(st._el);
    });
    panel.appendChild(list);
    wrap.appendChild(left); wrap.appendChild(panel);
    /* trip span in days: first departure to final arrival */
    var days = null;
    try {
      var dep0 = segs[0] && segs[0].depart_date, lastSeg = segs[segs.length - 1];
      var arrN = lastSeg ? (lastSeg.return_date || bvArriveDate(lastSeg) || lastSeg.depart_date) : null;
      if (dep0 && arrN) { var dd = Math.round((new Date(arrN) - new Date(dep0)) / 86400000) + 1; if (dd > 0) days = dd; }
    } catch (e) { days = null; }
    var pending = stops.length, coordsArr = [];
    stops.forEach(function (st, i) { bvCityLL(st, function (ll) { coordsArr[i] = ll; if (--pending === 0) bvGlobeInit(canvas, panel, stops, coordsArr, { cap: cap, flights: segs.length, days: days }); }); });
    return wrap;
  }
  function bvGcMiles(a, b) {
    var r = Math.PI / 180, la1 = a[0] * r, la2 = b[0] * r, dla = (b[0] - a[0]) * r, dlo = (b[1] - a[1]) * r;
    var s = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 3959 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function bvGlobeInit(canvas, panel, stops, coordsArr, extras) {
    /* graceful degrade: no d3 (CDN blocked) or unresolvable coordinates → hide the canvas
       column and present every stop as a full, static list instead of a dead section */
    function globeFallback() {
      var gw = canvas.closest ? canvas.closest('.bv-globe') : null;
      if (gw) gw.classList.add('bv-globe-nomap');
      stops.forEach(function (s) { if (s._el) s._el.className = 'bv-gli is-static'; });
    }
    var ctx = canvas.getContext('2d');
    if (!ctx || !window.d3 || !d3.geoOrthographic) { globeFallback(); return; }
    var GOLD = '201,162,75', CREAM = '245,237,223', INK = '30,19,8', TAU = 6.2831853, GEO = window.UT_GLOBE_GEO || null;
    stops.forEach(function (s, i) { var ll = coordsArr[i]; s.lat = ll ? ll[0] : null; s.lon = ll ? ll[1] : null; s.ll = ll ? [ll[1], ll[0]] : null; });
    if (stops.filter(function (s) { return s.ll; }).length < 2) { globeFallback(); return; }
    /* journey ledger: real great-circle mileage from the resolved coordinates */
    if (extras && extras.cap) {
      var miles = 0, gaps = false;
      for (var di = 0; di < stops.length - 1; di++) {
        var A = coordsArr[di], B = coordsArr[di + 1];
        if (A && B) miles += bvGcMiles(A, B); else gaps = true;
      }
      var capStats = [];
      if (miles > 0 && !gaps) capStats.push([Math.round(miles).toLocaleString('en-US'), 'miles']);
      if (extras.flights) capStats.push(['' + extras.flights, extras.flights === 1 ? 'flight' : 'flights']);
      if (extras.days) capStats.push(['' + extras.days, extras.days === 1 ? 'day' : 'days']);
      capStats.forEach(function (st) { extras.cap.appendChild(h('span', { class: 'bv-gc-stat' }, [h('b', { class: 'serif', text: st[0] }), h('i', { text: st[1] })])); });
    }
    var W = 1, H = 1, R = 1, cx = 0, cy = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    var projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
    var path = d3.geoPath(projection, ctx);
    var grat = d3.geoGraticule ? d3.geoGraticule().step([20, 20])() : null;
    /* ---- navigator's chronometer: everything renders inside a gold-bezeled porthole (radius P).
       The sphere can zoom far past the frame — the porthole clip makes deep zoom cinematic
       instead of clipped-looking. Palette: dusk earth (sapphire ocean, atlas-green land),
       gold instruments. ---- */
    var ADMIN1 = window.UT_GLOBE_ADMIN1 || null, NAVY = '7,15,28';
    var Z_HOLD = 2.35, Z_LOW = 0.82;
    /* starfield: fixed unit positions inside the porthole, drawn behind the sphere */
    var STARS = []; (function () { for (var i = 0; i < 110; i++) { var a = Math.random() * TAU, r = Math.sqrt(Math.random()); STARS.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, s: 0.35 + Math.random() * 0.75, o: 0.06 + Math.random() * 0.3 }); } })();
    var P = 1;
    function resize() { var b = canvas.getBoundingClientRect(); W = b.width || 460; H = b.height || 460; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); P = Math.min(W, H) * 0.465; cx = W / 2; cy = H / 2; }
    function render(rot, arcProg, activeIdx, zoom, ts) {
      var sc = P * (zoom || 1);
      projection.scale(sc).translate([cx, cy]).rotate([rot[0], rot[1], 0]);
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, P, 0, TAU); ctx.clip();
      /* deep space + stars */
      var sp = ctx.createRadialGradient(cx, cy, P * 0.2, cx, cy, P); sp.addColorStop(0, '#0A1526'); sp.addColorStop(1, '#04070E');
      ctx.fillStyle = sp; ctx.fillRect(cx - P, cy - P, P * 2, P * 2);
      if (sc < P * 1.05) { for (var si2 = 0; si2 < STARS.length; si2++) { var st2 = STARS[si2]; ctx.globalAlpha = st2.o; ctx.fillStyle = '#EAF2FF'; ctx.beginPath(); ctx.arc(cx + st2.x * P, cy + st2.y * P, st2.s, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
      /* atmosphere: pale blue breath around the rim (only when the rim is in view) */
      if (sc < P * 1.2) {
        var at = ctx.createRadialGradient(cx, cy, sc * 0.94, cx, cy, sc * 1.14); at.addColorStop(0, 'rgba(126,178,234,0.22)'); at.addColorStop(0.55, 'rgba(126,178,234,0.07)'); at.addColorStop(1, 'rgba(126,178,234,0)');
        ctx.beginPath(); ctx.arc(cx, cy, sc * 1.14, 0, TAU); ctx.fillStyle = at; ctx.fill();
      }
      /* ocean: sapphire, lit from the upper left */
      ctx.beginPath(); path({ type: 'Sphere' });
      var og = ctx.createRadialGradient(cx - sc * 0.42, cy - sc * 0.46, sc * 0.08, cx, cy, sc * 1.04);
      og.addColorStop(0, '#2E6591'); og.addColorStop(0.55, '#16395C'); og.addColorStop(1, '#081C33');
      ctx.fillStyle = og; ctx.fill();
      if (grat) { ctx.beginPath(); path(grat); ctx.strokeStyle = 'rgba(150,190,230,0.10)'; ctx.lineWidth = 0.5; ctx.stroke(); }
      /* land: atlas green with the same light, country borders inked */
      if (GEO) {
        /* one projection pass: the same path fills the land and inks the borders */
        ctx.beginPath(); path(GEO);
        var lg = ctx.createRadialGradient(cx - sc * 0.42, cy - sc * 0.46, sc * 0.08, cx, cy, sc * 1.04);
        lg.addColorStop(0, '#7E9468'); lg.addColorStop(0.55, '#50693F'); lg.addColorStop(1, '#2F4429');
        ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = 'rgba(20,32,16,0.55)'; ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.stroke();
      }
      /* state & province lines surface as you descend (US states, Canadian provinces) */
      var a1 = (zoom - 1.25) / 0.75; a1 = a1 < 0 ? 0 : a1 > 1 ? 1 : a1;
      if (ADMIN1 && a1 > 0) { ctx.beginPath(); path(ADMIN1); ctx.strokeStyle = 'rgba(228,238,215,' + (0.38 * a1).toFixed(3) + ')'; ctx.lineWidth = 0.55; ctx.stroke(); }
      /* sun highlight across the lit quarter */
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.min(sc, P * 1.5), 0, TAU); ctx.clip();
      var hl = ctx.createRadialGradient(cx - sc * 0.48, cy - sc * 0.52, sc * 0.05, cx - sc * 0.2, cy - sc * 0.2, sc * 1.3);
      hl.addColorStop(0, 'rgba(255,248,230,0.17)'); hl.addColorStop(0.4, 'rgba(255,248,230,0.05)'); hl.addColorStop(1, 'rgba(255,248,230,0)');
      ctx.fillStyle = hl; ctx.fillRect(cx - P, cy - P, P * 2, P * 2); ctx.restore();
      /* night falls toward the sphere's rim */
      if (sc < P * 1.35) { var vg = ctx.createRadialGradient(cx, cy, sc * 0.68, cx, cy, sc); vg.addColorStop(0, 'rgba(4,10,22,0)'); vg.addColorStop(0.8, 'rgba(4,10,22,0)'); vg.addColorStop(1, 'rgba(4,10,22,0.88)'); ctx.beginPath(); ctx.arc(cx, cy, sc + 0.6, 0, TAU); ctx.fillStyle = vg; ctx.fill(); }
      var planeAt = null, planeAng = 0;
      for (var ai = 0; ai < stops.length - 1; ai++) {
        var pr = arcProg[ai] || 0; if (pr <= 0 || !stops[ai].ll || !stops[ai + 1].ll) continue;
        var interp = d3.geoInterpolate(stops[ai].ll, stops[ai + 1].ll), coords = [], N = 64;
        for (var q = 0; q <= N; q++) coords.push(interp((q / N) * pr));
        var arcGeo = { type: 'LineString', coordinates: coords };
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (pr < 1) {
          /* the leg in flight: navy halo + white-hot comet */
          ctx.strokeStyle = 'rgba(' + NAVY + ',0.7)'; ctx.lineWidth = 4.8; ctx.beginPath(); path(arcGeo); ctx.stroke();
          ctx.shadowColor = 'rgba(255,210,130,0.98)'; ctx.shadowBlur = 13; ctx.strokeStyle = 'rgba(255,240,208,1)'; ctx.lineWidth = 2.5; ctx.beginPath(); path(arcGeo); ctx.stroke();
        } else {
          /* legs already flown settle into the map as a quiet gold route */
          ctx.strokeStyle = 'rgba(' + NAVY + ',0.5)'; ctx.lineWidth = 2.8; ctx.beginPath(); path(arcGeo); ctx.stroke();
          ctx.shadowColor = 'rgba(' + GOLD + ',0.6)'; ctx.shadowBlur = 4; ctx.strokeStyle = 'rgba(233,197,128,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); path(arcGeo); ctx.stroke();
        }
        ctx.restore();
        if (pr < 1) { var lc = projection(coords[coords.length - 1]), pc = projection(coords[coords.length - 2]); if (lc) { planeAt = lc; if (pc) planeAng = Math.atan2(lc[1] - pc[1], lc[0] - pc[0]); } }
      }
      /* one marker per airport (departure + journey-home share coords), active wins */
      var drawFor = {};
      stops.forEach(function (s, si) { if (!s.ll) return; var k = s.code || si; if (drawFor[k] == null || si === activeIdx) drawFor[k] = si; });
      var ctr = [-rot[0], -rot[1]];
      stops.forEach(function (s, si) {
        if (!s.ll) return;
        if (drawFor[s.code || si] !== si) return;
        /* cities on the far hemisphere would project inside the disc as ghosts — cull them */
        if (d3.geoDistance && d3.geoDistance(s.ll, ctr) > 1.45) return;
        var p = projection(s.ll); if (!p) return; var active = si === activeIdx;
        if (active && ts != null) {
          /* slow pulse ring radiating from the current city */
          var pp = (ts % 2200) / 2200, pr2 = 7 + 17 * pp;
          ctx.save(); ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.55 * (1 - pp)).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p[0], p[1], pr2, 0, TAU); ctx.stroke(); ctx.restore();
        }
        var inPort = Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy)) < P * 0.92;
        ctx.save(); ctx.shadowColor = 'rgba(' + GOLD + ',0.95)'; ctx.shadowBlur = active ? 16 : 8;
        ctx.fillStyle = active ? 'rgba(' + CREAM + ',1)' : 'rgba(' + GOLD + ',0.9)'; ctx.beginPath(); ctx.arc(p[0], p[1], active ? 5 : 2.8, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(' + NAVY + ',0.85)'; ctx.lineWidth = active ? 1.2 : 0.8; ctx.stroke();
        if (active) { ctx.strokeStyle = 'rgba(' + CREAM + ',0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, TAU); ctx.stroke(); }
        ctx.restore();
        if ((active || inPort) && Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy)) < P * 1.05) {
          var deep = zoom > 1.6, ly = p[1] - (active ? (deep ? 34 : 24) : 13);
          ctx.textAlign = 'center'; ctx.lineJoin = 'round';
          ctx.font = active ? ('500 ' + (deep ? 25 : 21) + "px 'Cormorant Garamond',Georgia,serif") : "600 11.5px 'Inter',system-ui,sans-serif";
          ctx.lineWidth = active ? 3.4 : 2.6; ctx.strokeStyle = 'rgba(' + NAVY + ',0.85)'; ctx.strokeText(s.city, p[0], ly);
          ctx.fillStyle = active ? 'rgba(' + CREAM + ',1)' : 'rgba(245,237,223,0.92)'; ctx.fillText(s.city, p[0], ly);
          if (active && deep && s.code) {
            /* the airport itself, letterspaced gold under the city name */
            var iata = ('' + s.code).toUpperCase().split('').join(' ');
            ctx.font = "600 10.5px 'Inter',system-ui,sans-serif";
            ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(' + NAVY + ',0.8)'; ctx.strokeText(iata, p[0], ly + 15);
            ctx.fillStyle = 'rgba(233,197,128,0.95)'; ctx.fillText(iata, p[0], ly + 15);
          }
        }
      });
      if (planeAt) drawPlane(planeAt[0], planeAt[1], planeAng);
      /* instrument depth: soft inner shadow where the world meets the bezel */
      var ish = ctx.createRadialGradient(cx, cy, P - 16, cx, cy, P); ish.addColorStop(0, 'rgba(0,0,0,0)'); ish.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.beginPath(); ctx.arc(cx, cy, P, 0, TAU); ctx.fillStyle = ish; ctx.fill();
      ctx.restore(); /* porthole clip */
      /* the chronometer bezel: twin gold rings + minute ticks */
      ctx.save(); ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(' + GOLD + ',0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, P + 1.2, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + GOLD + ',0.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, P + 5.5, 0, TAU); ctx.stroke();
      for (var tk = 0; tk < 60; tk++) {
        var ta = tk * TAU / 60, card = tk % 15 === 0, len = card ? 8 : 4.5;
        ctx.strokeStyle = 'rgba(' + GOLD + ',' + (card ? 0.75 : 0.32) + ')'; ctx.lineWidth = card ? 1.3 : 0.8;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * (P - 2), cy + Math.sin(ta) * (P - 2)); ctx.lineTo(cx + Math.cos(ta) * (P - 2 - len), cy + Math.sin(ta) * (P - 2 - len)); ctx.stroke();
      }
      ctx.restore();
    }
    function drawPlane(x, y, ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.shadowColor = 'rgba(' + GOLD + ',0.95)'; ctx.shadowBlur = 10; ctx.fillStyle = 'rgba(' + CREAM + ',1)'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-3, 2.2); ctx.lineTo(-2.5, 6.5); ctx.lineTo(-4.8, 6.5); ctx.lineTo(-7, 2.4); ctx.lineTo(-8.6, 2.8); ctx.lineTo(-8.6, -2.8); ctx.lineTo(-7, -2.4); ctx.lineTo(-4.8, -6.5); ctx.lineTo(-2.5, -6.5); ctx.lineTo(-3, -2.2); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(' + NAVY + ',0.6)'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore(); }
    function updateList(idx) { stops.forEach(function (s, i) { if (s._el) s._el.className = 'bv-gli ' + (i < idx ? 'is-past' : i === idx ? 'is-active' : 'is-future'); }); }
    function clampPhi(v) { return v < -62 ? -62 : v > 62 ? 62 : v; }
    function rotOf(k) { return [-(stops[k].lon || 0), clampPhi(-(stops[k].lat || 0))]; }
    var phases = []; stops.forEach(function (st, k) { phases.push({ t: 'hold', k: k, dur: st.role === 'Layover' || st.role === 'Quick connection' ? 1150 : 1700 }); if (k < stops.length - 1) phases.push({ t: 'travel', k: k, dur: 2000 }); });
    var pstart = [], acc0 = 0; phases.forEach(function (p) { pstart.push(acc0); acc0 += p.dur; }); var total = acc0 + 900;
    function ease(f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; }
    function shortest(a, b) { var d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
    var rafId = null, t0 = null, curActive = -1;
    function frame(ts) {
      /* self-heal: init can run before the overlay is in the DOM (rect measures 0 → 460
         fallback), so re-measure whenever the real canvas size drifts from what we drew for */
      var cw = canvas.clientWidth, chh = canvas.clientHeight;
      if (cw && chh && (Math.abs(cw - W) > 1 || Math.abs(chh - H) > 1)) resize();
      if (t0 == null) t0 = ts; var el = (ts - t0) % total, ph = null, pe = 0;
      for (var i = 0; i < phases.length; i++) { if (el < pstart[i] + phases[i].dur) { ph = phases[i]; pe = el - pstart[i]; break; } }
      var arcProg = {}; phases.forEach(function (p, pi) { if (p.t === 'travel') { if (el >= pstart[pi] + p.dur) arcProg[p.k] = 1; else if (el >= pstart[pi]) arcProg[p.k] = ease((el - pstart[pi]) / p.dur); } });
      var rot, active, zoom;
      if (!ph) { rot = rotOf(0); active = 0; zoom = Z_HOLD; }
      else if (ph.t === 'hold') { rot = rotOf(ph.k); active = ph.k; zoom = Z_HOLD; }
      else {
        var ra = rotOf(ph.k), rb = rotOf(ph.k + 1), f = pe / ph.dur, e = ease(f);
        rot = [ra[0] + shortest(ra[0], rb[0]) * e, ra[1] + (rb[1] - ra[1]) * e]; active = f > 0.55 ? ph.k + 1 : ph.k;
        /* climb out of the departure city, cruise over the whole earth, descend into the next */
        zoom = f < 0.42 ? (Z_HOLD - (Z_HOLD - Z_LOW) * ease(f / 0.42)) : f > 0.58 ? (Z_LOW + (Z_HOLD - Z_LOW) * ease((f - 0.58) / 0.42)) : Z_LOW;
      }
      if (active !== curActive) { curActive = active; updateList(active); }
      render(rot, arcProg, active, zoom, el); rafId = requestAnimationFrame(frame);
    }
    function start() { if (rafId == null) { t0 = null; resize(); rafId = requestAnimationFrame(frame); } }
    function stop() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }
    /* reduced motion: one still frame with the whole route drawn, every stop listed */
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var staticDraw = function () {
        resize();
        var allArcs = {}; for (var ri = 0; ri < stops.length - 1; ri++) allArcs[ri] = 1;
        var mid = stops[Math.floor((stops.length - 1) / 2)];
        render([-(mid.lon || 0), clampPhi(-(mid.lat || 0))], allArcs, -1, 0.95);
      };
      staticDraw();
      setTimeout(staticDraw, 60); /* init can precede DOM attach — redraw once laid out */
      stops.forEach(function (s) { if (s._el) s._el.className = 'bv-gli is-static'; });
      window.addEventListener('resize', staticDraw);
      return;
    }
    resize(); updateList(0); render(rotOf(0), {}, 0, Z_HOLD, 0);
    window.addEventListener('resize', function () { if (rafId != null) resize(); });
    if (window.UT_ITIN_PREVIEW || !window.IntersectionObserver) { start(); }
    else { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); }); }, { threshold: 0.12 }); io.observe(canvas); }
  }
  /* ---------- images: relevance-first, graceful fallback (no keys, CORS-open sources) ----------
     Order per photo: stored image_url → curated map → Wikipedia lead image → Commons scenic search
     (all filtered to reject flags/maps/logos/SVG/portrait), else leave the warm branded gradient. */
  var IMG_BAD = /flag|coat[ _-]?of[ _-]?arms|locator|orthographic|globe|\.svg|logo|seal|emblem|map[ _.]|[ _]map[ _.]|blank|icon|diagram/i;
  function bvBigThumb(u) { return u ? u.replace(/\/(\d+)px-/, '/1600px-') : u; }
  function bvGoodPhoto(u, t) { return !!u && !IMG_BAD.test(u) && !IMG_BAD.test(t || ''); }
  /* curated, hand-verified high-res photos so the marquee destinations + cabins are always perfect */
  var CITY_IMAGES = {
    'maldives': 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Maldives%2C_How_blue_can_it_be_-_Flickr_-_nattu.jpg',
    'dubai': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Dubai_Marina_%28222830069%29.jpeg',
    'istanbul': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Historical_peninsula_and_modern_skyline_of_Istanbul.jpg',
    'london': 'https://upload.wikimedia.org/wikipedia/commons/7/75/London_Skyline_from_Waterloo_Bridge%2C_London%2C_UK_-_Diliff.jpg',
    'houston': 'https://upload.wikimedia.org/wikipedia/commons/6/62/Downtown_Houston%2C_TX_Skyline_-_2018.jpg'
  };
  var CABIN_IMAGES = {
    emirates: { business: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Emirates_business_class_A380.jpg' },
    british_airways: { first: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/British_Airways_BA_First_Class_Seat_Boeing_747.jpg/1920px-British_Airways_BA_First_Class_Seat_Boeing_747.jpg' }
  };
  /* relevant category fallbacks — "another luxury car / another safari" when the exact thing isn't found */
  var CATEGORY_IMAGES = {
    business_cabin: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Business_class_cabin_of_B-7970_%2820230922135151%29.jpg',
    first_cabin: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/British_Airways_BA_First_Class_Seat_Boeing_747.jpg/1920px-British_Airways_BA_First_Class_Seat_Boeing_747.jpg',
    car: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Mercedes-Benz_W223_IAA_2021_1X7A0206.jpg',
    rolls_royce: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Rolls-Royce_Phantom_VIII_Series_I_IMG_9101.jpg',
    seaplane: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/De_Havilland_Canada_DHC-2_Turbine_Beaver_Mk3%2C_Ontario_Minister_Of_Natural_Resources_AN1188783.jpg',
    yacht: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/01_Power_Play_luxury_superyacht_of_millionaire_Jan_Koum%2C_built_by_Damen_Yachting.jpg',
    helicopter: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/New_York_Helicopter_Charter_Inc%2C_N405MR%2C_Bell_206L-4_LongRanger_%2816456584695%29.jpg',
    train: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/El_Transcantabrico_luxury_train_from_the_Luxury_Train_Club_%282367213352%29.jpg',
    jet: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Hawker_4000_cabin_interior_facing_forward.jpg',
    dining: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/DZ6_2628_Cozy_candlelit_dinner_for_two_elegant_Thai_restaurant_setting_with_twinkling_lights_and_a_delicate_orchid_centerpiece.jpg/1920px-DZ6_2628_Cozy_candlelit_dinner_for_two_elegant_Thai_restaurant_setting_with_twinkling_lights_and_a_delicate_orchid_centerpiece.jpg',
    desert: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Rub_al_Khali_002.JPG/1920px-Rub_al_Khali_002.JPG',
    underwater: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Underwater_Tanning_%28231813193%29.jpeg',
    beach: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Negombo_Beach_resort_pool_%28Unsplash%29.jpg'
  };
  /* map free text (transport type, car model, experience name/category) to a fallback bucket */
  function bvCategoryImg(text) {
    var s = ' ' + (text || '').toLowerCase() + ' ';
    if (/rolls|phantom|ghost|bentley|maybach/.test(s)) return CATEGORY_IMAGES.rolls_royce;
    if (/seaplane|float ?plane|water ?plane/.test(s)) return CATEGORY_IMAGES.seaplane;
    if (/yacht|catamaran|sailing|superyacht/.test(s)) return CATEGORY_IMAGES.yacht;
    if (/helicopter|heli /.test(s)) return CATEGORY_IMAGES.helicopter;
    if (/train|rail|express/.test(s)) return CATEGORY_IMAGES.train;
    if (/private jet|jet charter|aircraft charter/.test(s)) return CATEGORY_IMAGES.jet;
    if (/mercedes|benz|s-class|limousine|limo|sedan|chauffeur|private car|car service|transfer|drive/.test(s)) return CATEGORY_IMAGES.car;
    if (/safari|desert|dune|falcon|camel/.test(s)) return CATEGORY_IMAGES.desert;
    if (/snorkel|diving|dive|reef|scuba|underwater|manta|marine/.test(s)) return CATEGORY_IMAGES.underwater;
    if (/din|restaurant|cuisine|tasting|chef|food|brunch|wine|degustation/.test(s)) return CATEGORY_IMAGES.dining;
    if (/beach|lagoon|island|overwater|cruise|resort|spa/.test(s)) return CATEGORY_IMAGES.beach;
    return '';
  }
  var _imgCache = {};
  /* the distinctive words of a subject's name — used to demand the photo is OF the subject */
  var BV_STOP = /^(the|a|an|of|at|in|on|and|de|la|le|el|al|hotel|resort|restaurant|bar|cafe|club|beach|spa)$/i;
  function bvMustWords(name) { return ('' + (name || '')).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s]+/).filter(function (w) { return w.length >= 3 && !BV_STOP.test(w); }); }
  function bvTitleMatches(title, must) {
    if (!must || !must.length) return true;
    var t = title.toLowerCase(), longest = must.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
    if (longest && t.indexOf(longest) > -1) return true;
    var hits = 0; must.forEach(function (w) { if (t.indexOf(w) > -1) hits++; });
    return hits >= 2;
  }
  function wikiSummaryImg(name, cb, descMust) {
    var key = 'wp:' + name + '|' + (descMust ? descMust.source : ''); if (_imgCache[key] !== undefined) { cb(_imgCache[key]); return; }
    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name) + '?redirect=true')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var u = (j && j.originalimage && j.originalimage.source) || (j && j.thumbnail && bvBigThumb(j.thumbnail.source)) || '';
        if (!bvGoodPhoto(u, j && j.title)) u = '';
        /* the article must actually be about the right KIND of thing (a hotel, not a president) */
        if (u && descMust && !descMust.test(((j && j.description) || '') + ' ' + ((j && j.extract) || ''))) u = '';
        /* quality gate: no tiny or extreme-portrait lead images */
        var ow = j && j.originalimage && j.originalimage.width, oh = j && j.originalimage && j.originalimage.height;
        if (u && ow && (ow < 900 || (oh && ow < oh * 0.7))) u = '';
        _imgCache[key] = u; cb(u);
      })
      .catch(function () { _imgCache[key] = ''; cb(''); });
  }
  /* full gated candidate list for a query — feeds both the single-pick resolver and the
     admin review's photo chooser */
  function commonsSearchList(q, cb, must) {
    q = (q || '').trim(); if (!q) { cb([]); return; }
    var ck = 'cml:' + q + '|' + (must ? must.join(',') : ''); if (_imgCache[ck] !== undefined) { cb(_imgCache[ck]); return; }
    fetch('https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(q) + '&gsrlimit=16&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var pages = j && j.query && j.query.pages, cand = [];
        if (pages) Object.keys(pages).map(function (k) { return pages[k]; }).sort(function (a, b) { return (a.index || 0) - (b.index || 0); }).forEach(function (p) {
          var ii = p.imageinfo && p.imageinfo[0], ti = p.title || '';
          if (!ii || !ii.thumburl || !/jpe?g|png/i.test(ii.mime || '')) return;
          if (!bvGoodPhoto(ii.thumburl, ti)) return;
          /* quality gates: sharp originals only, landscape orientation */
          if (!ii.width || ii.width < 1200) return;
          if (ii.height && ii.width < ii.height) return;
          /* subject gate: the filename must name the subject, or this tier fails upward */
          if (must && !bvTitleMatches(ti, must)) return;
          cand.push({ u: ii.thumburl, t: ti.toLowerCase() });
        });
        _imgCache[ck] = cand; cb(cand);
      }).catch(function () { _imgCache[ck] = []; cb([]); });
  }
  function commonsSearchImg(q, cb, hint, must) {
    q = (q || '').trim(); if (!q) { cb(''); return; }
    var ck = 'cm:' + q + '|' + (hint || '') + '|' + (must ? must.join(',') : ''); if (_imgCache[ck] !== undefined) { cb(_imgCache[ck]); return; }
    commonsSearchList(q, function (cand) {
      var url = '';
      if (hint) { var hh = ('' + hint).toLowerCase().split(/[ ,]+/).filter(Boolean); var pref = cand.filter(function (c) { return hh.every(function (w) { return c.t.indexOf(w) > -1; }); }); if (pref.length) url = pref[0].u; }
      if (!url && cand.length) url = cand[0].u;
      _imgCache[ck] = url; cb(url);
    }, must);
  }
  /* try async resolvers in order until one yields a URL */
  /* Pexels via our proxy: licensed, high-resolution, genuinely beautiful photography.
     Preferred for cities and scenes; the accuracy-gated Commons tiers still win for
     photos that must show a SPECIFIC building or venue. */
  var _pexCache = {};
  function pexelsList(q, cb, n) {
    q = (q || '').trim(); if (!q) { cb([]); return; }
    var key = q.toLowerCase() + '|' + (n || 3);
    if (_pexCache[key]) { cb(_pexCache[key]); return; }
    fetch(UT_SB.url + '/functions/v1/photo-search?q=' + encodeURIComponent(q) + '&n=' + (n || 3))
      .then(function (r) { return r.ok ? r.json() : { photos: [] }; })
      .then(function (d) { var ph = (d && d.photos) || []; _pexCache[key] = ph; cb(ph); })
      .catch(function () { cb([]); });
  }
  function pexelsImg(q, cb) { pexelsList(q, function (ph) { cb(ph.length ? ph[0].url : ''); }, 3); }
  function bvWaterfall(fns, cb) { var i = 0; (function nxt() { if (i >= fns.length) { cb(''); return; } fns[i++](function (u) { u ? cb(u) : nxt(); }); })(); }
  /* per-itinerary city photo overrides picked by the agent at review time */
  var _bvCityOverride = {};
  function cityImageURL(city, cb) {
    var key = (city || '').split(',')[0].trim(); if (!key) { cb(''); return; }
    var lk = key.toLowerCase();
    for (var ok in _bvCityOverride) { if (ok.toLowerCase() === lk && _bvCityOverride[ok]) { cb(_bvCityOverride[ok]); return; } }
    bvWaterfall([
      function (c) { pexelsImg(key + ' famous landmark daytime', c); },
      function (c) { c(CITY_IMAGES[lk] || ''); },
      function (c) { wikiSummaryImg(key, c); },
      function (c) { commonsSearchImg(key + ' skyline', c); },
      function (c) { commonsSearchImg(key + ' cityscape', c); },
      function (c) { commonsSearchImg(key, c); }
    ], cb);
  }
  function hotelImageURL(name, loc, addr, cb) {
    name = (name || '').trim(); var city = (loc || '').split(',')[0].trim(), street = (addr || '').split(',')[0].trim();
    var must = bvMustWords(name);
    bvWaterfall([
      /* the building itself: exact name + city, then name + "hotel", then name + street —
         every tier demands the filename actually names the hotel */
      function (c) { name && city ? commonsSearchImg('"' + name + '" ' + city, c, city, must) : c(''); },
      function (c) { name ? commonsSearchImg(name + ' hotel' + (city ? ' ' + city : ''), c, '', must) : c(''); },
      function (c) { name && street ? commonsSearchImg(name + ' ' + street, c, '', must) : c(''); },
      /* Wikipedia only accepts articles that are ABOUT a hotel/building (never a person) */
      function (c) { name ? wikiSummaryImg(name, c, /hotel|resort|tower|skyscraper|building|palace|lodge|casino/i) : c(''); },
      function (c) { name ? pexelsImg(name + ' hotel' + (city ? ' ' + city : ''), c) : c(''); },
      function (c) { city ? pexelsImg('luxury hotel ' + city, c) : c(''); },
      function (c) { city ? commonsSearchImg('luxury hotel resort ' + city, c) : c(''); },
      function (c) { city ? cityImageURL(city, c) : c(''); }
    ], cb);
  }
  function cabinImageURL(airline, aircraft, cabin, cb) {
    var ak = bvAirlineKey(airline), ck = bvCabinKey(cabin);
    if (CABIN_IMAGES[ak] && CABIN_IMAGES[ak][ck]) { cb(CABIN_IMAGES[ak][ck]); return; }
    pexelsImg(ck === 'first' ? 'first class airplane cabin luxury' : 'business class airplane cabin', function (u) {
      cb(u || (ck === 'first' ? CATEGORY_IMAGES.first_cabin : CATEGORY_IMAGES.business_cabin));
    });
  }
  function venueImageURL(name, category, city, addr, cb) {
    var cat = bvCategoryImg((name || '') + ' ' + (category || ''));
    name = (name || '').trim(); var street = (addr || '').split(',')[0].trim();
    var must = bvMustWords(name);
    bvWaterfall([
      /* the exact place at its exact location; filename must name the venue or the tier fails */
      function (c) { name && city ? commonsSearchImg('"' + name + '" ' + city, c, '', must) : c(''); },
      function (c) { name ? commonsSearchImg(name + (city ? ' ' + city : '') + (street ? ' ' + street : ''), c, '', must) : c(''); },
      /* no verified photo of the place itself: a beautiful licensed scene, then curated, then the city */
      function (c) { pexelsImg(((category || name || '') + (city ? ' ' + city : '')).trim(), c); },
      function (c) { c(cat); },
      function (c) { city ? cityImageURL(city, c) : c(''); }
    ], cb);
  }
  function setBvImg(el, url) { el.style.backgroundImage = 'url("' + ('' + url).replace(/["\\\r\n]/g, '') + '")'; el.classList.add('bv-has-img'); }
  /* any Commons ORIGINAL file URL → its 1600px thumbnail (same photo, ~10× lighter, faster LCP) */
  function bvCommonsThumb(u, w) {
    var m = ('' + u).match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^\/?#]+)$/);
    return m ? (m[1] + '/thumb/' + m[2] + '/' + m[3] + '/' + m[4] + '/' + (w || 1600) + 'px-' + m[4]) : u;
  }
  /* preload so a dead/slow URL never blanks a card — thumbnail first, original as backup, else fall through */
  function bvApply(el, url, onfail) {
    if (!url) { if (onfail) onfail(); return; }
    function tryLoad(u, next) { var im = new Image(); im.onload = function () { if (el.isConnected) setBvImg(el, u); }; im.onerror = next; im.src = u; }
    var thumb = bvCommonsThumb(url, 1600);
    if (thumb !== url) tryLoad(thumb, function () { tryLoad(url, function () { if (onfail) onfail(); }); });
    else tryLoad(url, function () { if (onfail) onfail(); });
  }
  /* one entry per photo element: stored data-img wins (with resolver fallback if it fails), else resolve, else keep the warm gradient */
  function bvPhoto(el, resolve) { if (!el) return; var stored = el.getAttribute('data-img'); if (stored) { bvApply(el, stored, function () { resolve(function (u) { bvApply(el, u); }); }); } else { resolve(function (u) { bvApply(el, u); }); } }
  function loadBvImages(ov) {
    Array.prototype.forEach.call(ov.querySelectorAll('[data-city]'), function (el) { bvPhoto(el, function (cb) { cityImageURL(el.getAttribute('data-city'), cb); }); });
    Array.prototype.forEach.call(ov.querySelectorAll('[data-aircraft]'), function (el) { bvPhoto(el, function (cb) { cabinImageURL(el.getAttribute('data-airline'), el.getAttribute('data-aircraft'), el.getAttribute('data-cabin'), cb); }); });
    Array.prototype.forEach.call(ov.querySelectorAll('[data-hotel]'), function (el) { bvPhoto(el, function (cb) { hotelImageURL(el.getAttribute('data-hotel'), el.getAttribute('data-hotel-city') || '', el.getAttribute('data-hotel-addr') || '', cb); }); });
    Array.prototype.forEach.call(ov.querySelectorAll('[data-venue]'), function (el) { bvPhoto(el, function (cb) { venueImageURL(el.getAttribute('data-venue'), el.getAttribute('data-venue-cat') || '', el.getAttribute('data-venue-city') || '', el.getAttribute('data-venue-addr') || '', cb); }); });
  }
  /* ---- admin review bridge: when hosted in the admin app's preview frame, serve gated
     photo candidates for the image rail. Inert on the live customer site. ---- */
  function bvSlotCandidates(slot, done) {
    slot = slot || {};
    var name = (slot.name || '').trim(), city = ((slot.city || '').split(',')[0] || '').trim(), street = ((slot.addr || '').split(',')[0] || '').trim();
    var must = bvMustWords(name), queries = [];
    if (slot.kind === 'hotel') {
      if (name && city) queries.push(['"' + name + '" ' + city, must]);
      if (name) queries.push([name + ' hotel' + (city ? ' ' + city : ''), must]);
      if (name && street) queries.push([name + ' ' + street, must]);
      if (city) queries.push(['luxury hotel resort ' + city, null]);
    } else if (slot.kind === 'venue') {
      if (name && city) queries.push(['"' + name + '" ' + city, must]);
      if (name) queries.push([name + (city ? ' ' + city : '') + (street ? ' ' + street : ''), must]);
      if (city) queries.push([((slot.cat || '') + ' ' + city).trim(), null]);
    } else { /* city */
      var key = city || name;
      if (key) { queries.push([key + ' skyline', null]); queries.push([key + ' cityscape', null]); queries.push([key + ' aerial view', null]); }
    }
    var out = [], seen = {}, qi = 0;
    function finish() { done(out.slice(0, 12)); }
    function commonsNext() {
      if (qi >= queries.length || out.length >= 12) { finish(); return; }
      var qq = queries[qi++];
      commonsSearchList(qq[0], function (cand) {
        (cand || []).forEach(function (c) { if (!seen[c.u] && out.length < 12) { seen[c.u] = 1; out.push({ url: c.u, title: c.t }); } });
        commonsNext();
      }, qq[1]);
    }
    /* licensed Pexels shots lead the rail; accuracy-gated Commons results follow */
    var pexQ = slot.kind === 'hotel' ? ((name ? name + ' hotel ' : 'luxury hotel ') + city).trim()
      : slot.kind === 'venue' ? (((slot.cat || name || '') + ' ' + city).trim() || name)
      : ((city || name) + ' famous landmark daytime');
    pexelsList(pexQ, function (ph) {
      (ph || []).forEach(function (p2) { if (!seen[p2.url] && out.length < 6) { seen[p2.url] = 1; out.push({ url: p2.url, title: p2.alt || 'Pexels' }); } });
      commonsNext();
    }, 6);
  }
  if (window.UT_ITIN_PREVIEW) {
    window.addEventListener('message', function (ev) {
      var d = ev.data || {};
      if (d.type !== 'bv-find-images' || !d.slot) return;
      bvSlotCandidates(d.slot, function (cands) {
        try { (ev.source || window.parent).postMessage({ type: 'bv-image-candidates', reqId: d.reqId || null, candidates: cands }, '*'); } catch (e) { }
      });
    });
  }
  function bvMetaGrid(pairs) { return pairs.length ? h('div', { class: 'bv-item-meta' }, pairs.map(function (m) { return h('div', { class: 'bv-mini' }, [h('div', { class: 'bv-k', text: m[0] }), h('div', { class: 'bv-v', text: m[1] })]); })) : null; }
  /* a codeshare note only matters when the operator differs from the marketing airline */
  function bvCodeshare(s) {
    var op = (s.operated_by || '').trim();
    if (!op || op.toLowerCase() === (s.airline || '').trim().toLowerCase()) return '';
    return op;
  }
  /* curated online check-in pages for the airlines dad books most */
  var AIRLINE_CHECKIN = { 'turkish airlines': 'https://www.turkishairlines.com/en-int/flights/manage-booking/', 'emirates': 'https://www.emirates.com/manage-booking/', 'qatar airways': 'https://www.qatarairways.com/en/manage-booking.html', 'etihad airways': 'https://www.etihad.com/en/manage', 'singapore airlines': 'https://www.singaporeair.com/en_UK/manage-booking/', 'lufthansa': 'https://www.lufthansa.com/us/en/online-check-in', 'swiss': 'https://www.swiss.com/us/en/customer-support/check-in', 'british airways': 'https://www.britishairways.com/travel/managebooking/public/en_us', 'air france': 'https://wwws.airfrance.us/check-in', 'klm': 'https://www.klm.us/check-in', 'american airlines': 'https://www.aa.com/reservation/view/find-your-trip', 'delta air lines': 'https://www.delta.com/mytrips/', 'united airlines': 'https://www.united.com/en/us/checkin', 'cathay pacific': 'https://www.cathaypacific.com/cx/en_US/manage-booking.html', 'ana': 'https://www.ana.co.jp/en/us/plan-book/check-in/', 'japan airlines': 'https://www.jal.co.jp/jp/en/inter/service/checkin/', 'korean air': 'https://www.koreanair.com/booking/check-in', 'aegean airlines': 'https://en.aegeanair.com/travel-info/check-in/', 'air canada': 'https://www.aircanada.com/us/en/aco/home/fly/check-in.html', 'qantas': 'https://www.qantas.com/us/en/travel-info/check-in.html' };
  function bvCheckinURL(airline) { if (!airline) return ''; return AIRLINE_CHECKIN[airline.trim().toLowerCase()] || ''; }
  function bvFlight(s, idx, role, skipPerks) {
    var card = h('div', { class: 'bv-flight' });
    var opby = bvCodeshare(s);
    var ciUrl = bvCheckinURL(s.airline);
    card.appendChild(h('div', { class: 'bv-flight-head' }, [
      role ? h('span', { class: 'bv-flight-role', text: role }) : null,
      h('div', { class: 'bv-al serif', text: s.airline || 'Your flight' }),
      s.cabin ? h('span', { class: 'bv-cab', text: s.cabin }) : null,
      ciUrl ? h('a', { class: 'bv-checkin', href: ciUrl, target: '_blank', rel: 'noopener', title: 'Opens the airline\u2019s official check-in page', text: 'Online check-in' }) : null
    ]));
    if (opby) card.appendChild(h('div', { class: 'bv-opby', text: 'Operated by ' + opby }));
    var body = h('div', { class: 'bv-flight-body' });
    var dt = s.depart_time ? fmtTime(s.depart_time) : '', at = s.arrive_time ? fmtTime(s.arrive_time) : '', ad = s.arrive_date || s.return_date || bvArriveDate(s);
    body.appendChild(h('div', { class: 'bv-timeline' }, [
      h('div', { class: 'bv-tl-end' }, [h('div', { class: 'bv-time' + (dt ? '' : ' bv-time-sm'), text: dt || s.from.city }), h('div', { class: 'bv-code', text: s.from.code }), h('div', { class: 'bv-date', text: s.depart_date ? fmtDate(s.depart_date) : '' })]),
      h('div', { class: 'bv-tl-mid' }, [h('div', { class: 'bv-dur', text: !s.duration ? 'Nonstop' : (/nonstop/i.test(s.duration) ? s.duration : s.duration + '  ·  Nonstop') }), h('div', { class: 'bv-tl-line' }), h('div', { class: 'bv-fno', text: [s.flight_number, s.aircraft].filter(Boolean).join('  ·  ') })]),
      h('div', { class: 'bv-tl-end' }, [h('div', { class: 'bv-time' + (at ? '' : ' bv-time-sm'), text: at || s.to.city }), h('div', { class: 'bv-code', text: s.to.code }), h('div', { class: 'bv-date', text: ad ? fmtDate(ad) : '' })])
    ]));
    body.appendChild(h('div', { class: 'bv-tz-note', text: 'Departure and arrival are shown in each airport’s own local time.' }));
    if (s.notes) body.appendChild(h('div', { class: 'bv-flight-note', text: s.notes }));
    /* fixed 6-cell facts grid — same cells on every flight; airline/cabin live in the header, not here */
    var meta = [
      ['Flight', s.flight_number || '—'],
      ['Aircraft', s.aircraft || '—'],
      ['Terminal', [s.dep_terminal, s.arr_terminal].filter(Boolean).join(' → ') || '—'],
      ['Your seats', seatStr(s.seats) || '—'],
      ['Baggage', bagStr(s.baggage) || '—'],
      ['Confirmation', s.confirmation || '—']
    ];
    if (s.eticket) meta.push(['E-ticket', s.eticket]);
    body.appendChild(h('div', { class: 'bv-flight-meta' }, meta.map(function (m) { return h('div', { class: 'bv-meta-cell' }, [h('div', { class: 'bv-k', text: m[0] }), h('div', { class: 'bv-v', text: m[1] })]); })));
    card.appendChild(body);
    var perks = skipPerks ? [] : cabinPerks(s.cabin, s.airline);
    if (perks.length) card.appendChild(h('div', { class: 'bv-cabin-incl' }, [
      h('h4', { class: 'serif', text: (s.cabin || 'Your cabin') + ' — what’s included' }),
      h('div', { class: 'bv-feat-grid' }, perks.map(function (p) { return h('div', { class: 'bv-feat' }, [h('span', { class: 'bv-feat-ic', text: '✦' }), h('span', null, [h('b', { text: p[0] }), h('span', { class: 'bv-feat-d', text: p[1] })])]); }))
    ]));
    return card;
  }
  /* a layover happens at ONE airport, so arrive + next-depart are in the same local time — a plain diff is correct */
  function bvLayoverDur(prev, next) {
    var ad = prev.arrive_date || prev.return_date || bvArriveDate(prev), aT = prev.arrive_time, dd = next.depart_date, dT = next.depart_time;
    if (!ad || !aT || !dd || !dT) return '';
    var mins = Math.round((new Date(dd + 'T' + dT + ':00') - new Date(ad + 'T' + aT + ':00')) / 60000);
    if (isNaN(mins) || mins <= 0 || mins > 2880) return '';
    var hh = Math.floor(mins / 60), mm = mins % 60;
    return (hh ? hh + 'h' : '') + (hh && mm ? ' ' : '') + (mm ? mm + 'm' : '') || '0m';
  }
  function bvLayoverWord(next) { return next && next.layover_kind === 'connection' ? 'Connection' : 'Layover'; }
  /* a terminal change during the stop, when both terminals are known and differ */
  function bvTerminalChange(prev, next) {
    var a = (prev.arr_terminal || '').trim(), b = (next.dep_terminal || '').trim();
    return (a && b && a.toLowerCase() !== b.toLowerCase()) ? ('Change to Terminal ' + b) : '';
  }
  function bvLayover(prev, next) {
    var city = (prev.to && (prev.to.city || prev.to.code)) || '', dur = (next.layover_duration || '').trim() || bvLayoverDur(prev, next);
    var main = [bvLayoverWord(next), city, dur].filter(Boolean).join('  ·  ');
    var sub = [bvTerminalChange(prev, next), next.layover_note].filter(Boolean);
    return h('div', { class: 'bv-layover' }, [
      sv('svg', { class: 'bv-layover-ic', viewBox: '0 0 24 24', width: '19', height: '19', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'aria-hidden': 'true' }, [sv('circle', { cx: '12', cy: '13', r: '8' }), sv('path', { d: 'M12 9.5v3.5l2.4 2.4' }), sv('path', { d: 'M9.5 2.5h5' })]),
      h('div', { class: 'bv-layover-body' }, [h('div', { class: 'bv-layover-main', text: main })].concat(sub.map(function (t) { return h('div', { class: 'bv-layover-note', text: t }); })))
    ]);
  }
  function bvJourneyCard(legs, role) {
    var first = legs[0].s, last = legs[legs.length - 1].s;
    var vias = legs.slice(0, -1).map(function (o) { return (o.s.to && (o.s.to.city || o.s.to.code)) || ''; }).filter(Boolean);
    var kids = [h('div', { class: 'bv-journey-head' }, [
      role ? h('span', { class: 'bv-journey-role', text: role }) : null,
      h('div', { class: 'bv-journey-route serif', text: ((first.from && (first.from.city || first.from.code)) || '') + '  →  ' + ((last.to && (last.to.city || last.to.code)) || '') }),
      h('div', { class: 'bv-journey-via', text: legs.length + ' flights' + (vias.length ? '  ·  via ' + vias.join(', ') : '') })
    ])];
    /* consecutive legs in the same airline + cabin share one "what's included" block */
    var lastPerkKey = null;
    legs.forEach(function (o, li) {
      if (li > 0) kids.push(bvLayover(legs[li - 1].s, o.s));
      var pk = bvAirlineKey(o.s.airline) + '|' + bvCabinKey(o.s.cabin);
      kids.push(bvFlight(o.s, o.i, null, pk === lastPerkKey));
      lastPerkKey = pk;
    });
    return h('div', { class: 'bv-journey-card' }, kids);
  }
  /* group consecutive legs flagged connect_from_prev into one journey; render each as a single flight or a journey card */
  function bvRenderFlights(list, roleFn) {
    var groups = [], cur = null;
    list.forEach(function (o) {
      if (o.s.connect_from_prev && cur) cur.push(o);
      else { cur = [o]; groups.push(cur); }
    });
    return groups.map(function (g) {
      var role = roleFn ? roleFn(g[0].i) : null;
      return g.length === 1 ? bvFlight(g[0].s, g[0].i, role) : bvJourneyCard(g, role);
    });
  }
  function bvNights(x) { if (!x.checkin_date || !x.checkout_date) return null; var a = new Date(x.checkin_date), b = new Date(x.checkout_date); var n = Math.round((b - a) / 86400000); return n > 0 ? n : null; }
  function bvHotel(x, idx) {
    var nights = bvNights(x);
    var meta = [];
    if (x.checkin_date) meta.push(['Check-in', fmtDate(x.checkin_date) + (x.checkin_time ? '  ·  ' + fmtTime(x.checkin_time) : '')]);
    if (x.checkout_date) meta.push(['Check-out', fmtDate(x.checkout_date) + (x.checkout_time ? '  ·  ' + fmtTime(x.checkout_time) : '')]);
    if (x.room) meta.push(['Room', x.room]);
    if (nights) meta.push(['Nights', String(nights)]);
    if (x.board) meta.push(['Meals', x.board]);
    if (x.rooms) meta.push(['Rooms', x.rooms]);
    if (x.confirmation) meta.push(['Confirmation', x.confirmation]);
    if (x.phone) meta.push(['Hotel phone', x.phone]);
    return h('div', { class: 'bv-item' }, [
      h('div', { class: 'bv-item-photo bv-ph bv-ph-hotel' + (idx % 2), 'data-hotel': x.name || '', 'data-hotel-city': x.location || '', 'data-hotel-addr': x.address || '', 'data-img': x.image_url || null }),
      h('div', { class: 'bv-item-body' }, [
        h('h3', { class: 'bv-item-title serif', text: x.name || 'Your hotel' }),
        x.location ? h('div', { class: 'bv-item-sub', text: x.location + (nights ? '  ·  ' + nights + (nights === 1 ? ' night' : ' nights') : '') }) : null,
        x.address ? h('div', { class: 'bv-item-addr', text: x.address }) : null,
        bvMetaGrid(meta),
        x.notes ? h('div', { class: 'bv-item-note', text: x.notes }) : null,
        bvConf(x)
      ])
    ]);
  }
  function bvTransport(x) {
    var meta = [];
    var when = [x.date ? fmtDate(x.date) : '', fmtTime(x.time)].filter(Boolean).join('  ·  ');
    if (when) meta.push(['When', when]);
    var chauffeur = [x.driver, x.car, x.plate].filter(Boolean).join('  ·  ');
    if (chauffeur) meta.push(['Chauffeur', chauffeur]);
    if (x.company) meta.push(['Provider', x.company]);
    if (x.confirmation) meta.push(['Confirmation', x.confirmation]);
    if (x.phone) meta.push(['Phone', x.phone]);
    return h('div', { class: 'bv-item' }, [
      h('div', { class: 'bv-item-photo bv-ph bv-ph-car', 'data-venue': x.car || x.type || 'private transfer', 'data-venue-cat': [x.type, x.car].filter(Boolean).join(' ') || 'chauffeur', 'data-venue-city': ((x.to || x.from || '').split(',').pop() || '').trim(), 'data-img': x.image_url || null }),
      h('div', { class: 'bv-item-body' }, [
        h('h3', { class: 'bv-item-title serif', text: x.type || 'Private transfer' }),
        (x.from || x.to) ? h('div', { class: 'bv-item-sub', text: [x.from, x.to].filter(Boolean).join('  →  ') }) : null,
        bvMetaGrid(meta),
        x.notes ? h('div', { class: 'bv-item-note', text: x.notes }) : null,
        bvConf(x)
      ])
    ]);
  }
  function bvEnt(x) {
    var meta = [];
    var when = [x.date ? fmtDate(x.date) : '', fmtTime(x.time)].filter(Boolean).join('  ·  ');
    if (when) meta.push(['When', when]);
    if (x.location || x.address) meta.push(['Where', [x.location, x.address].filter(Boolean).join('  ·  ')]);
    if (x.party) meta.push(['Party size', x.party]);
    if (x.confirmation) meta.push(['Confirmation', x.confirmation]);
    if (x.phone) meta.push(['Phone', x.phone]);
    return h('div', { class: 'bv-item' }, [
      h('div', { class: 'bv-item-photo bv-ph bv-ph-exp', 'data-venue': x.name || '', 'data-venue-cat': x.category || '', 'data-venue-city': ((x.location || '').split(',').pop() || '').trim(), 'data-venue-addr': x.address || '', 'data-img': x.image_url || null }),
      h('div', { class: 'bv-item-body' }, [
        x.category ? h('span', { class: 'bv-cab', text: x.category }) : null,
        h('h3', { class: 'bv-item-title serif', text: x.name || 'Experience' }),
        bvMetaGrid(meta),
        x.notes ? h('div', { class: 'bv-item-note', text: x.notes }) : null,
        bvConf(x)
      ])
    ]);
  }
  /* booking confirmation (QR / barcode / email image) the traveler shows at the venue */
  function bvConf(x) {
    if (!x || !x.confirmation_image) return null;
    var img = h('img', { class: 'bv-conf-img', src: x.confirmation_image, alt: 'Booking confirmation', loading: 'lazy' });
    img.addEventListener('click', function () { bvLightbox(x.confirmation_image); });
    return h('div', { class: 'bv-conf' }, [h('div', { class: 'bv-conf-k', text: 'Your ticket · show this at the venue' }), img, h('div', { class: 'bv-conf-hint', text: 'Tap to enlarge' })]);
  }
  function bvLightbox(url) {
    var ov = h('div', { class: 'bv-lightbox' }, [h('img', { src: url, alt: '' })]);
    ov.addEventListener('click', function () { ov.remove(); });
    document.body.appendChild(ov);
  }
  function bvChapterHead(num, c) {
    return h('div', { class: 'bv-chapter-hero bv-ph bv-ph-0' }, [
      /* the photo lives on its own layer so the color grade never touches the caption */
      h('div', { class: 'bv-chapter-hero-img', 'data-city': c.city || '' }),
      h('div', { class: 'bv-chapter-hero-grad' }),
      h('div', { class: 'bv-chapter-hero-cap' }, [
        h('span', { class: 'bv-chapter-num', text: 'Destination ' + num }),
        h('h2', { class: 'serif bv-chapter-city', text: c.city }),
        h('span', { class: 'bv-chapter-iata', text: c.code })
      ])
    ]);
  }
  function bvGroupLabel(t) { return h('div', { class: 'bv-chapter-group', text: t }); }
  function bvWordMatch(hay, needle) { if (!hay || !needle) return false; var esc = ('' + needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); try { return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)', 'i').test('' + hay); } catch (e) { return ('' + hay).toLowerCase().indexOf(('' + needle).toLowerCase()) > -1; } }
  function bvMatchCity(str, c) { if (!str || !c) return false; if (c.city && bvWordMatch(str, c.city)) return true; if (c.code && bvWordMatch(str, c.code)) return true; return false; }
  function beautifulItin(it) {
    _bvCityOverride = (it && it.city_images) || {};
    var segs = it.segments || [], seq = citySeq(segs);
    var root = h('div', { class: 'bv-root' });
    /* hero */
    var totalPax = (it.pax_adults || 0) + (it.pax_children || 0) + (it.pax_infants || 0) || (it.passengers || 1);
    var heroOrigin = seq[0] || (segs[0] && segs[0].from) || {};
    var heroStats = [['Departure', it.start_date ? fmtDate(it.start_date) : (segs[0] && segs[0].depart_date ? fmtDate(segs[0].depart_date) : '—')], ['Return', it.end_date ? fmtDate(it.end_date) : '—'], ['Travelers', paxWordCap(totalPax)], ['Cabin', (segs[0] && segs[0].cabin) || '—'], ['Departing from', heroOrigin.city ? (heroOrigin.city + (heroOrigin.code ? '  ·  ' + heroOrigin.code : '')) : '—']];
    var p = state.profile || {};
    var dests = seq.slice(1).map(function (c) { return c.city; }), uniqD = [];
    dests.forEach(function (c) { if (c && uniqD.indexOf(c) < 0) uniqD.push(c); });
    if (!uniqD.length && seq.length) uniqD.push(seq[seq.length - 1].city);
    if (!uniqD.length && it.destination) uniqD.push(it.destination);
    var heroBg = uniqD.length >= 2
      ? h('div', { class: 'bv-hero-slides' }, uniqD.slice(0, 6).map(function (c) { return h('div', { class: 'bv-hero-slide', 'data-city': c }); }))
      : h('div', { class: 'bv-hero-bg', 'data-city': uniqD[0] || '' });
    root.appendChild(h('header', { class: 'bv-hero' }, [
      heroBg,
      h('div', { class: 'bv-wrap bv-hero-top' }, [
        h('div', { class: 'bv-mast' }, [h('span', { class: 'bv-mast-mark', 'aria-hidden': 'true' }), h('span', { class: 'bv-brand serif', text: agencyName() })]),
        h('div', { class: 'bv-mast-r' }, [h('span', { class: 'bv-hero-tag', text: 'Private Itinerary' }), it.itinerary_number ? h('span', { class: 'bv-hero-no', text: 'No. ' + it.itinerary_number }) : null])
      ]),
      h('div', { class: 'bv-wrap bv-hero-mid' }, [
        h('div', { class: 'bv-hero-prepared' }, [h('span', { class: 'bv-prep-k', text: 'Prepared exclusively for' }), h('span', { class: 'bv-prep-n', text: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'you' })]),
        it.traveler_names ? h('div', { class: 'bv-party', text: travelerList(it.traveler_names).join('   ·   ') }) : null,
        h('h1', { class: 'bv-hero-title serif' }, uniqD.length ? joinGold((heroOrigin.city && uniqD.indexOf(heroOrigin.city) < 0 ? [heroOrigin.city] : []).concat(uniqD)) : [it.title || it.destination || 'Your journey']),
        h('div', { class: 'bv-hero-sub' }, heroStats.map(function (st) { return h('div', { class: 'bv-hkpi' }, [h('div', { class: 'bv-k', text: st[0] }), h('div', { class: 'bv-v', text: st[1] })]); }))
      ]),
      h('div', { class: 'bv-wrap bv-scroll-cue' }, [h('span', { class: 'bv-cue-dot' }), h('span', { text: 'Scroll to view your journey' })])
    ]));
    /* savings */
    var total = Number(it.total_charged), comp = Number(it.comparable_total);
    if (total > 0 && comp > total) {
      var saved = comp - total, pct = Math.round((saved / comp) * 100);
      root.appendChild(h('section', { class: 'bv-savings bv-pad' }, [h('div', { class: 'bv-wrap' }, [
        h('div', { class: 'bv-lead' }, [h('div', { class: 'bv-eyebrow', text: 'Your Advantage' }), h('div', { class: 'bv-save-figure serif' }, [h('span', { class: 'bv-pre', text: curSymbol(it.currency) }), h('span', { class: 'bv-save-num', 'data-val': saved, text: formatThousands(saved) })]), h('div', { class: 'bv-save-cap', text: 'Saved versus published fares' })]),
        h('div', { class: 'bv-bars' }, [
          h('div', { class: 'bv-bar-row' }, [h('div', { class: 'bv-bar-label' }, [h('span', { text: 'Published / retail price' }), h('span', { class: 'bv-amt', text: money(comp, it.currency) })]), h('div', { class: 'bv-track' }, [h('div', { class: 'bv-fill bv-retail' })])]),
          h('div', { class: 'bv-bar-row' }, [h('div', { class: 'bv-bar-label' }, [h('span', { text: 'Your price through ' + agencyName() }), h('span', { class: 'bv-amt bv-gold', text: money(total, it.currency) })]), h('div', { class: 'bv-track' }, [h('div', { class: 'bv-fill bv-paid', style: 'width:' + Math.max(8, Math.round(total / comp * 100)) + '%' })])])
        ]),
        h('div', { class: 'bv-save-pills' }, [h('div', { class: 'bv-pill' }, [h('b', { text: pct + '%' }), ' below retail']), h('div', { class: 'bv-pill' }, [h('b', { text: String(segs.length || 1) }), (segs.length === 1 ? ' premium flight secured' : ' premium flights secured')])])
      ])]));
    }
    /* journey route */
    if (seq.length >= 2) {
      var returnHome = segs.length && segs[segs.length - 1].to && segs[0].from && segs[segs.length - 1].to.code === segs[0].from.code;
      root.appendChild(h('section', { class: 'bv-pad bv-journey' }, [h('div', { class: 'bv-wrap' }, [secHead('The Journey', it.title || 'Your itinerary', it.destination ? ('Every detail across ' + it.destination + ', handled door to door.') : 'Every detail, handled door to door.'), bvGlobe(seq, segs, bvStays(seq, segs), returnHome)])]));
    }
    /* body — smart chronological city chapters for multi-city, category layout otherwise */
    var origin = seq[0] || {};
    function bvSegTime(s) { return (s.depart_date || '9999-99-99') + 'T' + (s.depart_time || '00:00'); }
    var haveDates = segs.length > 0 && segs.every(function (s) { return s.depart_date; });
    var chron = segs.map(function (s, i) { return { s: s, i: i }; });
    if (haveDates) chron.sort(function (a, b) { var ta = bvSegTime(a.s), tb = bvSegTime(b.s); return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i; });
    /* walk flights in date order; a city becomes a chapter only when you actually stay (overnight) — return connections fall through to the journey home */
    var chapters = [], pending = [];
    chron.forEach(function (o, k) {
      var s = o.s, to = s.to || {}; pending.push(o);
      if (!to.code) return;
      var next = null, j; for (j = k + 1; j < chron.length; j++) { if (chron[j].s.from && chron[j].s.from.code === to.code) { next = chron[j].s; break; } }
      var arr = bvArriveDate(s), dep = next ? next.depart_date : '', isHome = to.code === origin.code, isStay;
      if (haveDates && arr && dep) isStay = !isHome && dep > arr;
      else isStay = !isHome && (!next || (it.hotels || []).some(function (x) { return bvMatchCity(x.location, to) || bvMatchCity(x.address, to); }));
      if (isStay) { chapters.push({ city: to, flights: pending }); pending = []; }
    });
    var homeSegs = pending;
    if (chapters.length >= 2) {
      var usedH = [], usedT = [], usedE = [];
      chapters.forEach(function (ch, ci) {
        var c = ch.city, kids = [bvChapterHead(ci + 1, c), bvGroupLabel('Getting there')];
        kids = kids.concat(bvRenderFlights(ch.flights, null));
        var ho = []; (it.hotels || []).forEach(function (x, hi) { if (usedH.indexOf(hi) < 0 && (bvMatchCity(x.location, c) || bvMatchCity(x.address, c))) { usedH.push(hi); ho.push(bvHotel(x, hi)); } });
        if (ho.length) { kids.push(bvGroupLabel('Where you stay')); kids = kids.concat(ho); }
        var tr = []; (it.transport || []).forEach(function (x, ti) { if (usedT.indexOf(ti) < 0 && bvMatchCity((x.from || '') + ' ' + (x.to || ''), c)) { usedT.push(ti); tr.push(bvTransport(x)); } });
        if (tr.length) { kids.push(bvGroupLabel('Getting around')); kids = kids.concat(tr); }
        var en = []; (it.entertainment || []).forEach(function (x, ei) { if (usedE.indexOf(ei) < 0 && bvMatchCity(x.location, c)) { usedE.push(ei); en.push(bvEnt(x)); } });
        if (en.length) { kids.push(bvGroupLabel('Dining & experiences')); kids = kids.concat(en); }
        root.appendChild(h('section', { class: 'bv-pad bv-chapter' }, [h('div', { class: 'bv-wrap' }, kids)]));
      });
      if (homeSegs.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('The Journey Home', 'Back to ' + (origin.city || 'home'), '')].concat(bvRenderFlights(homeSegs, null)))]));
      var leftH = (it.hotels || []).filter(function (x, hi) { return usedH.indexOf(hi) < 0; });
      if (leftH.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead("Where You'll Stay", 'Your stays', '')].concat(leftH.map(bvHotel)))]));
      var leftT = (it.transport || []).filter(function (x, ti) { return usedT.indexOf(ti) < 0; });
      if (leftT.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Ground & Transfers', 'Door to door', '')].concat(leftT.map(bvTransport)))]));
      var leftE = (it.entertainment || []).filter(function (x, ei) { return usedE.indexOf(ei) < 0; });
      if (leftE.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Experiences & Dining', 'Reserved for you', '')].concat(leftE.map(bvEnt)))]));
    } else {
      if (segs.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('In the Air', segs.length === 1 ? 'Your flight' : 'Your flights', '')].concat(bvRenderFlights(segs.map(function (s, i) { return { s: s, i: i }; }), function (i) { return segRole(it.trip_type, i, segs.length); })))]));
      if (it.hotels && it.hotels.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead("Where You'll Stay", it.hotels.length === 1 ? 'Your stay' : 'Your stays', '')].concat(it.hotels.map(bvHotel)))]));
      if (it.transport && it.transport.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Ground & Transfers', 'Door to door', '')].concat(it.transport.map(bvTransport)))]));
      if (it.entertainment && it.entertainment.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Experiences & Dining', 'Reserved for you', '')].concat(it.entertainment.map(bvEnt)))]));
    }
    if (it.cruises && it.cruises.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('The Voyage', it.cruises.length === 1 ? 'Your cruise' : 'Your cruises', '')].concat(it.cruises.map(bvCruise)))]));
    var bvDayNotes = (it.day_notes || []).slice().sort(function (a, b) { return ('' + (a.date || '')).localeCompare('' + (b.date || '')); });
    if (bvDayNotes.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Day by Day', 'Your days, planned', '')].concat(bvDayNotes.map(bvDay)))]));
    if (it.documents && it.documents.length) root.appendChild(h('section', { class: 'bv-pad' }, [h('div', { class: 'bv-wrap' }, [secHead('Your Documents', 'Everything you might be asked for', 'Tap to open. Keep these handy at check-in and border control.'), h('div', { class: 'bv-docs' }, it.documents.map(bvDoc))])]));
    /* footer */
    root.appendChild(h('footer', { class: 'bv-footer' }, [h('div', { class: 'bv-wrap' }, [
      h('div', { class: 'bv-brand serif', text: agencyName() }),
      h('div', { class: 'bv-spec' }, [(state.settings && state.settings.agency_phone) ? state.settings.agency_phone : '', h('br'), 'One specialist, yours from first call to boarding.']),
      it.notes ? h('p', { class: 'bv-fine', text: it.notes }) : null,
      h('p', { class: 'bv-fine bv-disclaimer', text: itinDisclaimer() }),
      h('p', { class: 'bv-fine', text: 'Itinerary ' + (it.itinerary_number || '') })
    ])]));
    return root;
  }
  function bvCruise(x) {
    var meta = [];
    var emb = [x.embark_port, x.embark_date ? fmtDate(x.embark_date) : '', x.embark_time ? fmtTime(x.embark_time) : ''].filter(Boolean).join('  ·  ');
    var dis = [x.disembark_port, x.disembark_date ? fmtDate(x.disembark_date) : '', x.disembark_time ? fmtTime(x.disembark_time) : ''].filter(Boolean).join('  ·  ');
    if (emb) meta.push(['Embarks', emb]);
    if (dis) meta.push(['Disembarks', dis]);
    if (x.cabin) meta.push(['Suite', x.cabin]);
    if (x.deck) meta.push(['Deck and cabin', x.deck]);
    if (x.confirmation) meta.push(['Booking', x.confirmation]);
    if (x.phone) meta.push(['Phone', x.phone]);
    return h('div', { class: 'bv-item' }, [
      h('div', { class: 'bv-item-photo bv-ph bv-ph-cruise', 'data-venue': (x.ship || x.line || 'luxury cruise ship'), 'data-venue-cat': 'cruise ship', 'data-venue-city': '', 'data-img': x.image_url || null }),
      h('div', { class: 'bv-item-body' }, [
        x.line ? h('span', { class: 'bv-cab', text: x.line }) : null,
        h('h3', { class: 'bv-item-title serif', text: x.ship || 'Your cruise' }),
        bvMetaGrid(meta),
        x.notes ? h('div', { class: 'bv-item-note', text: x.notes }) : null,
        bvConf(x)
      ])
    ]);
  }
  function bvDay(x) {
    return h('div', { class: 'bv-day' }, [
      h('div', { class: 'bv-day-date', text: x.date ? fmtDate(x.date) : '' }),
      h('div', { class: 'bv-day-body' }, [
        x.title ? h('h3', { class: 'bv-day-title serif', text: x.title }) : null,
        x.body ? h('p', { class: 'bv-day-text', text: x.body }) : null
      ])
    ]);
  }
  function bvDoc(x) {
    return h('a', { class: 'bv-doc', href: x.url, target: '_blank', rel: 'noopener' }, [
      sv('svg', { class: 'bv-doc-ic', viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, [sv('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }), sv('polyline', { points: '14 2 14 8 20 8' })]),
      h('span', { text: x.name || 'Document' })
    ]);
  }
  function secHead(eyebrow, title, sub) { var k = [h('span', { class: 'bv-eyebrow', text: eyebrow }), h('h2', { class: 'serif', text: title })]; if (sub) k.push(h('p', { text: sub })); return h('div', { class: 'bv-sec-head' }, k); }
  function joinGold(arr) { var out = []; arr.forEach(function (a, i) { if (i > 0) out.push(h('span', { class: 'bv-gold', text: ' → ' })); out.push(h('span', { class: 'bv-city', text: a })); }); return out; }
  function paxWordCap(n) { var w = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']; return (n >= 0 && n <= 10) ? w[n] : String(n); }
  function formatThousands(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
  var _gsapLoading = null;
  function ensureGSAP(cb) {
    if (window.gsap && window.ScrollTrigger && window.MotionPathPlugin) { if (cb) cb(); return; }
    if (!_gsapLoading) {
      _gsapLoading = new Promise(function (resolve) {
        function load(src, then) { var s = document.createElement('script'); s.src = src; s.onload = then; s.onerror = then; document.head.appendChild(s); }
        load('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', function () { load('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', function () { load('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/MotionPathPlugin.min.js', resolve); }); });
      });
    }
    _gsapLoading.then(function () { if (cb) cb(); });
  }
  function animateBeautiful(ov) {
    if (!window.gsap) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var g = window.gsap, ST = window.ScrollTrigger;
    if (ST) g.registerPlugin(ST);
    g.from(ov.querySelectorAll('.bv-hero-prepared, .bv-hero-title, .bv-hero-sub .bv-hkpi, .bv-scroll-cue'), { y: 28, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.12 });
    if (!ST) return;
    ov.querySelectorAll('.bv-sec-head, .bv-flight, .bv-hotel, .bv-chauffeur, .bv-exp').forEach(function (el) {
      g.from(el, { y: 44, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, scroller: ov, start: 'top 86%' } });
    });
    var mapEl = ov.querySelector('.bv-map');
    if (mapEl) {
      var pathEl = mapEl.querySelector('.bv-map-path'), planeEl = mapEl.querySelector('.bv-plane'), MP = window.MotionPathPlugin;
      var jsection = mapEl.closest('.bv-journey') || mapEl;
      var labs = ov.querySelectorAll('.bv-map-lab'), stayEls = ov.querySelectorAll('.bv-stay-arr, .bv-stay-sep, .bv-stay-dep');
      g.from(labs, { opacity: 0, y: 12, duration: 0.6, stagger: 0.12, ease: 'power2.out', scrollTrigger: { trigger: jsection, scroller: ov, start: 'top 78%' } });
      g.from(mapEl.querySelectorAll('.bv-map-dot, .bv-map-halo'), { opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out', scrollTrigger: { trigger: jsection, scroller: ov, start: 'top 78%' } });
      if (pathEl && pathEl.getTotalLength) {
        var len = pathEl.getTotalLength();
        if (MP && planeEl) {
          g.registerPlugin(MP);
          var dots = mapEl.querySelectorAll('.bv-map-dot'), SAMP = 600, pts = [], si;
          for (si = 0; si <= SAMP; si++) pts.push(pathEl.getPointAtLength(len * si / SAMP));
          var nodeFrac = [];
          Array.prototype.forEach.call(dots, function (dot) {
            var cx = +dot.getAttribute('cx'), cy = +dot.getAttribute('cy'), best = 0, bd = 1e18, sj;
            for (sj = 0; sj <= SAMP; sj++) { var dx = pts[sj].x - cx, dy = pts[sj].y - cy, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = sj; } }
            nodeFrac.push(best / SAMP);
          });
          var bounds = nodeFrac.slice();
          if (mapEl.getAttribute('data-return') === '1') bounds.push(1);
          g.set(pathEl, { strokeDasharray: len, strokeDashoffset: len });
          g.set(planeEl, { opacity: 0 });
          var tl = g.timeline({ scrollTrigger: { trigger: jsection, scroller: ov, start: 'top 66%' } });
          tl.set(planeEl, { motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5], autoRotate: true, start: 0, end: 0.0001 } }, 0);
          tl.to(planeEl, { opacity: 1, duration: 0.4 }, 0);
          var t = 0.3, legDur = 1.05, dwell = 0.7;
          for (var bi = 1; bi < bounds.length; bi++) {
            var from = bounds[bi - 1], to = bounds[bi], nodeIdx = (bi < nodeFrac.length) ? bi : 0;
            tl.to(pathEl, { strokeDashoffset: len * (1 - to), duration: legDur, ease: 'power1.inOut' }, t);
            tl.to(planeEl, { motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5], autoRotate: true, start: from, end: to }, duration: legDur, ease: 'power1.inOut' }, t);
            t += legDur;
            (function (lab, pos) { if (!lab) return; var arr = lab.querySelector('.bv-stay-arr'); if (arr) tl.to(arr, { opacity: 1, duration: 0.45, ease: 'power2.out' }, pos); })(labs[nodeIdx], t);
            t += dwell;
            (function (lab, pos) { if (!lab) return; var dep = lab.querySelector('.bv-stay-dep'), sep = lab.querySelector('.bv-stay-sep'); var arr2 = [sep, dep].filter(Boolean); if (arr2.length) tl.to(arr2, { opacity: 1, duration: 0.45, ease: 'power2.out' }, pos); })(labs[nodeIdx], t);
            t += 0.2;
          }
        } else {
          g.set(pathEl, { strokeDasharray: len, strokeDashoffset: 0 });
          g.set(stayEls, { opacity: 1 });
        }
      }
    }
    var sav = ov.querySelector('.bv-savings');
    if (sav) {
      var num = ov.querySelector('.bv-save-num');
      if (num) { var tgt = parseFloat(num.getAttribute('data-val')) || 0; ST.create({ trigger: sav, scroller: ov, start: 'top 72%', once: true, onEnter: function () { var o = { n: 0 }; g.to(o, { n: tgt, duration: 1.6, ease: 'power2.out', onUpdate: function () { num.textContent = Math.round(o.n).toLocaleString('en-US'); } }); } }); }
      ov.querySelectorAll('.bv-fill').forEach(function (f) { var w = f.style.width || '100%'; g.fromTo(f, { width: 0 }, { width: w, duration: 1.3, ease: 'power2.out', scrollTrigger: { trigger: sav, scroller: ov, start: 'top 72%' } }); });
      var pills = ov.querySelector('.bv-save-pills');
      if (pills) g.from(ov.querySelectorAll('.bv-pill'), { y: 20, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: pills, scroller: ov, start: 'top 90%' } });
    }
  }
  /* a change request goes straight to the specialist: a task in the admin and a Telegram ping */
  function openChangeRequest(it) {
    if (document.getElementById('cr-overlay')) return;
    var ta = h('textarea', { class: 'acct-input cr-text', rows: '4', placeholder: 'Tell us what you would like to change. Dates, rooms, seats, anything.' });
    var msg = h('p', { class: 'cr-msg', text: '' });
    var send = h('button', { type: 'button', class: 'btn btn-primary', text: 'Send to my specialist' });
    var ov = h('div', { id: 'cr-overlay', class: 'cr-overlay', 'data-lenis-prevent': '' }, [
      h('div', { class: 'cr-box' }, [
        h('h3', { class: 'cr-title serif', text: 'Request a change' }),
        h('p', { class: 'cr-sub', text: 'Your specialist gets this immediately and will confirm every change with you before anything is rebooked.' }),
        ta, msg,
        h('div', { class: 'cr-actions' }, [send, h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { ov.remove(); }, text: 'Cancel' })])
      ])
    ]);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    send.addEventListener('click', function () {
      var text = (ta.value || '').trim();
      if (text.length < 5) { msg.textContent = 'Add a few words about what you would like changed.'; msg.className = 'cr-msg err'; return; }
      send.disabled = true; send.textContent = 'Sending…';
      sb.functions.invoke('change-request', { body: { itinerary_id: it.id, message: text } }).then(function (r) {
        var err = (r.error && r.error.message) || (r.data && r.data.error);
        if (err) { send.disabled = false; send.textContent = 'Send to my specialist'; msg.textContent = 'Could not send: ' + err; msg.className = 'cr-msg err'; return; }
        msg.textContent = '';
        ov.querySelector('.cr-box').textContent = '';
        ov.querySelector('.cr-box').appendChild(h('div', { class: 'cr-done' }, [
          h('h3', { class: 'cr-title serif', text: 'Sent.' }),
          h('p', { class: 'cr-sub', text: 'Your specialist has it and will be in touch shortly.' }),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { ov.remove(); }, text: 'Done' })
        ]));
      }).catch(function () { send.disabled = false; send.textContent = 'Send to my specialist'; msg.textContent = 'Could not send. Please try again.'; msg.className = 'cr-msg err'; });
    });
    document.body.appendChild(ov);
    ta.focus();
  }
  function openBeautiful(it) {
    closeBeautiful();
    var bar = h('div', { class: 'bv-bar no-print' }, [
      state.uid ? h('button', { type: 'button', class: 'bv-bar-pdf', onclick: function () { openChangeRequest(it); }, text: 'Request a change' }) : null,
      h('button', { type: 'button', class: 'bv-bar-pdf', onclick: function () { closeBeautiful(); openOverlay(itinDoc(it), itinPdfName(it), LD_PDF); }, text: 'View PDF' }),
      h('button', { type: 'button', class: 'bv-bar-close', onclick: closeBeautiful, 'aria-label': 'Close', text: '×' })
    ]);
    var ov = h('div', { class: 'bv-overlay', id: 'bv-overlay', 'data-lenis-prevent': '' }, [bar, beautifulItin(it)]);
    document.body.appendChild(ov);
    document.body.classList.add('acct-modal-open');
    loadBvImages(ov);
    startSlideshow(ov);
    ensureGSAP(function () { animateBeautiful(ov); });
  }
  function startSlideshow(ov) {
    var slides = ov.querySelectorAll('.bv-hero-slide');
    if (!slides.length) return;
    slides[0].classList.add('is-active');
    if (slides.length < 2) return;
    var i = 0;
    ov._bvTimer = setInterval(function () {
      if (!ov.isConnected) { clearInterval(ov._bvTimer); return; }
      slides[i].classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
    }, 5200);
  }
  function closeBeautiful() { var o = document.getElementById('bv-overlay'); if (o) { if (o._bvTimer) clearInterval(o._bvTimer); o.remove(); } if (!document.getElementById('acct-overlay')) document.body.classList.remove('acct-modal-open'); }

  function sectionProfile() {
    var p = state.profile;
    var titles = [{ v: '', l: 'Title' }, { v: 'Mr', l: 'Mr' }, { v: 'Mrs', l: 'Mrs' }, { v: 'Ms', l: 'Ms' }, { v: 'Miss', l: 'Miss' }, { v: 'Dr', l: 'Dr' }, { v: 'Prof', l: 'Prof' }];
    var genders = [{ v: '', l: 'Select' }, { v: 'Male', l: 'Male' }, { v: 'Female', l: 'Female' }, { v: 'Other', l: 'Other' }];
    var rels = [{ v: '', l: 'Select' }, { v: 'Spouse (wife)', l: 'Spouse (wife)' }, { v: 'Spouse (husband)', l: 'Spouse (husband)' }, { v: 'Parent (mother)', l: 'Parent (mother)' }, { v: 'Parent (father)', l: 'Parent (father)' }, { v: 'Sibling', l: 'Sibling' }, { v: 'Other', l: 'Other' }];
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'Profile' }));
    var photoActions = [h('label', { class: 'btn btn-ghost acct-photo-btn', for: 'acct-photo-file' }, [p.avatar_url ? 'Change photo' : 'Upload photo'])];
    if (p.avatar_url) photoActions.push(h('button', { type: 'button', class: 'acct-photo-remove', 'data-action': 'removeavatar', text: 'Remove' }));
    wrap.appendChild(panel('Profile photo', 'Add a clear headshot so your agent recognises you.', [
      h('div', { class: 'acct-photo-row' }, [
        avatarNode(p, 'acct-photo-preview'),
        h('div', { class: 'acct-photo-side' }, [
          h('div', { class: 'acct-photo-actions' }, photoActions),
          h('input', { type: 'file', id: 'acct-photo-file', class: 'acct-photo-file', accept: 'image/jpeg,image/png,image/webp' }),
          h('p', { class: 'acct-photo-hint', text: 'JPG, PNG or WebP, up to 5 MB.' }),
          h('p', { class: 'acct-photo-status', 'aria-live': 'polite' })
        ])
      ])
    ]));
    wrap.appendChild(panel('Personal details', 'Used on your bookings and itineraries — match your passport exactly.', [saveForm([
      h('div', { class: 'acct-row2' }, [
        customSelect('Title', 'title', p.title, titles),
        customSelect('Gender', 'gender', p.gender, genders)
      ]),
      h('div', { class: 'acct-row3' }, [
        field('First name', { name: 'first_name', type: 'text', value: p.first_name || '', required: true, readonly: true, 'data-noaf': '1' }),
        field('Middle name', { name: 'middle_name', type: 'text', value: p.middle_name || '', readonly: true, 'data-noaf': '1' }),
        field('Last name', { name: 'last_name', type: 'text', value: p.last_name || '', required: true, readonly: true, 'data-noaf': '1' })
      ]),
      h('div', { class: 'acct-row2' }, [
        field('Date of birth', { name: 'date_of_birth', type: 'text', class: 'acct-date', 'data-dob': '1', value: p.date_of_birth || '', placeholder: 'Select a date' }),
        field('Phone', { name: 'phone', type: 'tel', class: 'acct-phone', value: p.phone || '', autocomplete: 'tel' })
      ]),
      field('Email', { type: 'email', value: p.email || '', disabled: true }, 'Email can’t be changed here.')
    ])]));
    var addrIso = (p.address_country || state.ipCountry || 'US').toUpperCase();
    wrap.appendChild(panel('Address', 'For billing and your itineraries.', [saveForm([
      customSelect('Country', 'address_country', addrIso, countryOpts()),
      field('Street address', { name: 'address_line', type: 'text', value: p.address_line || '', autocomplete: 'address-line1' }),
      h('div', { class: 'acct-addr-dyn' }, addrDynamic(addrIso, p))
    ])]));
    var relOther = field('Please specify relationship', { name: 'emergency_contact_relationship_other', type: 'text', value: p.emergency_contact_relationship_other || '' });
    relOther.className = 'acct-other';
    relOther.hidden = (p.emergency_contact_relationship !== 'Other');
    wrap.appendChild(panel('Emergency contact', null, [saveForm([
      h('div', { class: 'acct-row3' }, [
        field('Contact name', { name: 'emergency_contact_name', type: 'text', value: p.emergency_contact_name || '' }),
        field('Contact phone', { name: 'emergency_contact_phone', type: 'tel', class: 'acct-phone', value: p.emergency_contact_phone || '' }),
        customSelect('Relationship', 'emergency_contact_relationship', p.emergency_contact_relationship, rels)
      ]),
      relOther
    ])]));
    wrap.appendChild(panelDocuments());
    wrap.appendChild(panelPreferences());
    return wrap;
  }
  /* travel documents + flying preferences now live inside Profile (one less tab each) */
  function panelDocuments() {
    var p = state.profile;
    return panel('Passport & trusted traveler', 'We use these to ticket your flights faster. Stored privately, visible only to you.', [saveForm([
      h('div', { class: 'acct-row2' }, [
        field('Passport number', { name: 'passport_number', type: 'text', value: p.passport_number || '' }),
        field('Passport expiry', { name: 'passport_expiry', type: 'text', class: 'acct-date', value: p.passport_expiry || '', placeholder: 'Select a date' })
      ]),
      h('div', { class: 'acct-row2' }, [
        field('Nationality', { name: 'nationality', type: 'text', value: p.nationality || '' }),
        field('Country of residence', { name: 'country_of_residence', type: 'text', value: p.country_of_residence || '' })
      ]),
      h('div', { class: 'acct-row2' }, [
        field('Known Traveler Number', { name: 'known_traveler_number', type: 'text', value: p.known_traveler_number || '' }, 'TSA PreCheck / Global Entry'),
        field('Redress number', { name: 'redress_number', type: 'text', value: p.redress_number || '' })
      ])
    ])]);
  }
  function panelPreferences() {
    var p = state.profile;
    var cabin = [{ v: '', l: 'No preference' }, { v: 'First Class', l: 'First Class' }, { v: 'Business Class', l: 'Business Class' }, { v: 'Premium Economy', l: 'Premium Economy' }, { v: 'Economy', l: 'Economy' }];
    var seat = [{ v: '', l: 'No preference' }, { v: 'Window', l: 'Window' }, { v: 'Aisle', l: 'Aisle' }];
    var meal = [{ v: '', l: 'No preference' }, { v: 'Standard', l: 'Standard' }, { v: 'Vegetarian', l: 'Vegetarian' }, { v: 'Vegan', l: 'Vegan' }, { v: 'Kosher', l: 'Kosher' }, { v: 'Halal', l: 'Halal' }, { v: 'Gluten-free', l: 'Gluten-free' }, { v: 'Diabetic', l: 'Diabetic' }];
    return panel('Flying preferences', 'We’ll apply these whenever we book you.', [saveForm([
      h('div', { class: 'acct-row3' }, [
        customSelect('Cabin preference', 'cabin_pref', p.cabin_pref, cabin),
        customSelect('Seat preference', 'seat_pref', p.seat_pref, seat),
        customSelect('Meal preference', 'meal_pref', p.meal_pref, meal)
      ]),
      field('Frequent flyer / loyalty numbers', { name: 'frequent_flyer', type: 'text', value: p.frequent_flyer || '' }, 'e.g. Emirates Skywards 1234567, AA AAdvantage 7654321')
    ])]);
  }
  function sectionSecurity() {
    var p = state.profile;
    var wrap = h('div', { class: 'acct-section' });
    wrap.appendChild(h('h2', { class: 'acct-h2', text: 'Account & security' }));
    wrap.appendChild(panel('Email', null, [
      h('p', { class: 'acct-readline', text: p.email || '' }),
      h('p', { class: 'acct-hint', text: 'Email verification is coming soon — you’ll be able to verify right here.' })
    ]));
    var pwForm = h('form', { class: 'acct-form has-pwcheck', 'data-action': 'changepw', novalidate: true }, pwBlock('Update password', true));
    wrap.appendChild(panel('Change password', null, [pwForm]));
    wrap.appendChild(h('section', { class: 'acct-panel acct-signout-panel' }, [h('button', { class: 'btn btn-ghost', 'data-action': 'signout', text: 'Sign out' })]));
    return wrap;
  }
  /* documents/preferences hashes still work — they now live inside Profile */
  var RENDER = { overview: sectionOverview, trips: sectionTrips, quotes: sectionQuotes, invoices: sectionInvoices, profile: sectionProfile, documents: sectionProfile, preferences: sectionProfile, security: sectionSecurity };

  /* ---------- dashboard shell ---------- */
  function currentSec() { var s = (location.hash || '').replace('#', ''); if (s === 'documents' || s === 'preferences') s = 'profile'; return RENDER[s] ? s : 'overview'; }
  function renderContent() {
    var sec = currentSec();
    var area = document.getElementById('acct-content');
    if (area) {
      Array.prototype.forEach.call(area.querySelectorAll('.acct-date'), function (el) { if (el._flatpickr) el._flatpickr.destroy(); });
      Array.prototype.forEach.call(area.querySelectorAll('.acct-phone'), function (el) { if (el._iti) { el._iti.destroy(); el._iti = null; } });
      area.textContent = ''; area.appendChild(RENDER[sec]()); area.scrollTop = 0; initPickers(area); initPhones(area);
    }
    var nav = document.getElementById('acct-nav');
    if (nav) Array.prototype.forEach.call(nav.querySelectorAll('[data-sec]'), function (a) { a.classList.toggle('is-active', a.getAttribute('data-sec') === sec); });
  }
  function viewDashboard() {
    var p = state.profile;
    var navLinks = SECTIONS.map(function (s) { return h('a', { href: '#' + s[0], 'data-sec': s[0], text: s[1] }); });
    var aside = h('aside', { class: 'acct-nav', id: 'acct-nav' }, [
      h('div', { class: 'acct-nav-user' }, [
        avatarNode(p),
        h('div', null, [
          h('span', { class: 'acct-nav-name', text: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Your account' }),
          h('span', { class: 'acct-nav-email', text: p.email || '' }),
          p.account_number ? h('span', { class: 'acct-nav-num' }, ['Account no. ', h('b', { text: p.account_number })]) : null
        ])
      ]),
      h('nav', null, navLinks),
      specialistCard()
    ]);
    mount(h('div', { class: 'acct-shell' }, [aside, h('div', { class: 'acct-content', id: 'acct-content' })]));
    renderContent();
  }
  /* the promise of the whole business (a real person) visible on every tab */
  function specialistCard() {
    var sset = state.settings || {}, phone = sset.agency_phone || '';
    return h('div', { class: 'acct-specialist' }, [
      h('span', { class: 'acct-spec-eyebrow', text: 'Your specialist' }),
      h('p', { class: 'acct-spec-line', text: 'A real person plans, prices and books everything for you. Replies within hours.' }),
      phone ? h('a', { class: 'btn btn-primary acct-spec-call', href: 'tel:' + phone.replace(/[^+\d]/g, '') }, [
        h('span', { class: 'acct-spec-call-k', text: 'Call' }),
        h('span', { class: 'acct-spec-call-n', text: phone })
      ]) : null
    ]);
  }
  /* mirror the Supabase account into a WordPress user (idempotent, token-verified server-side) */
  async function syncWpUser(sess) {
    try {
      if (!sess || !sess.access_token || !sess.user) return;
      var key = 'ut_wp_synced_' + sess.user.id;
      if (sessionStorage.getItem(key)) return;
      var r = await fetch('/wp-json/upgrade/v1/sync-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: sess.access_token }) });
      if (r.ok) sessionStorage.setItem(key, '1');
    } catch (e) {}
  }
  /* ---------- data ---------- */
  function viewDashError() {
    mount(h('div', { class: 'acct-card acct-loading' }, [
      h('h2', { class: 'acct-title', text: 'We couldn’t load your account' }),
      h('p', { class: 'acct-sub', text: 'Something went wrong reaching your account. Please check your connection and try again.' }),
      h('button', { type: 'button', class: 'btn btn-primary', style: 'margin-top:8px; width:auto', onclick: function () { loadDashboard(); }, text: 'Try again' })
    ]));
  }
  async function loadDashboard() {
    viewLoading();
    var sess = (await sb.auth.getSession()).data.session;
    if (!sess) { viewAuth('signin'); return; }
    syncWpUser(sess);
    var uid = sess.user.id;
    state.uid = uid; state.email = sess.user.email || '';
    try {
      var pr = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (pr.error) throw pr.error;
      state.profile = pr.data || { id: uid, email: sess.user.email };
      if (!state.profile.email) state.profile.email = sess.user.email;
      var br = await sb.from('bookings').select('*').order('depart_at', { ascending: false, nullsFirst: false });
      if (br.error) throw br.error;
      state.bookings = br.data || [];
      var qr = await sb.from('quotes').select('*').order('created_at', { ascending: false });
      if (qr.error) throw qr.error;
      state.quotes = qr.data || [];
      var itr = await sb.from('itineraries').select('*').order('start_date', { ascending: false, nullsFirst: false });
      if (itr.error) throw itr.error;
      state.itineraries = itr.data || [];
      if (state.itineraries.length) ensureGSAP();
      if (state.itineraries.length || (state.quotes && state.quotes.length) || (state.invoices && state.invoices.length)) ensureHtml2pdf(function () { });
      var ivr = await sb.from('invoices').select('*').order('created_at', { ascending: false });
      if (ivr.error) throw ivr.error;
      state.invoices = ivr.data || [];
      var setr = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
      state.settings = (setr && setr.data) || {}; /* non-critical: default silently */
    } catch (e) {
      viewDashError();
      return;
    }
    try { localStorage.setItem('ut_acct', JSON.stringify({ name: ((state.profile.first_name || '') + ' ' + (state.profile.last_name || '')).trim(), email: state.profile.email || '', num: state.profile.account_number || '', avatar: state.profile.avatar_url || '' })); if (window.utPopulateAccount) window.utPopulateAccount(); } catch (e) {}
    viewDashboard();
  }
  function doSignOut() {
    var go = function () { try { localStorage.removeItem('ut_acct'); } catch (e) {} sb.auth.signOut().then(function () { window.location.href = '/'; }); };
    if (window.utConfirmSignout) window.utConfirmSignout(go); else if (window.confirm('Are you sure you want to sign out?')) go();
  }
  async function setAvatar(url) {
    var sess = (await sb.auth.getSession()).data.session; if (!sess) return false;
    var up = await sb.from('profiles').update({ avatar_url: url || null }).eq('id', sess.user.id);
    if (up.error) return false;
    state.profile.avatar_url = url || '';
    try { var a = JSON.parse(localStorage.getItem('ut_acct') || '{}'); a.avatar = url || ''; localStorage.setItem('ut_acct', JSON.stringify(a)); if (window.utPopulateAccount) window.utPopulateAccount(); } catch (e) {}
    var nav = document.querySelector('.acct-nav-user .acct-avatar');
    if (nav) { nav.textContent = ''; nav.classList.remove('acct-avatar--img'); if (url) { nav.classList.add('acct-avatar--img'); nav.appendChild(h('img', { src: url, alt: '' })); } else { nav.textContent = initials(state.profile); } }
    renderContent();
    return true;
  }
  async function uploadAvatar(file, statusEl) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type || '')) { if (statusEl) statusEl.textContent = 'Please choose a JPG, PNG or WebP image.'; return; }
    if (file.size > 5 * 1024 * 1024) { if (statusEl) statusEl.textContent = 'Image must be under 5 MB.'; return; }
    var sess = (await sb.auth.getSession()).data.session; if (!sess) return;
    if (statusEl) statusEl.textContent = 'Uploading…';
    var path = sess.user.id + '/avatar';
    var up = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (up.error) { if (statusEl) statusEl.textContent = up.error.message || 'Upload failed. Please try again.'; return; }
    var pub = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    await setAvatar(pub + (pub.indexOf('?') > -1 ? '&' : '?') + 'v=' + Date.now());
  }
  async function removeAvatar() {
    var sess = (await sb.auth.getSession()).data.session; if (!sess) return;
    await sb.storage.from('avatars').remove([sess.user.id + '/avatar']);
    await setAvatar('');
  }

  /* ---------- actions ---------- */
  async function handleSubmit(form) {
    var action = form.getAttribute('data-action');
    var f = Object.fromEntries(new FormData(form).entries());
    if (action === 'signin') {
      setBusy(form, true, 'Signing in…'); msg(form, '');
      var r = await sb.auth.signInWithPassword({ email: (f.email || '').trim(), password: f.password });
      if (r.error) { setBusy(form, false); msg(form, r.error.message || 'Could not sign in.', 'err'); return; }
      loadDashboard();
    } else if (action === 'signup') {
      var pe = pwError(f.password, f.password2); if (pe) { msg(form, pe, 'err'); return; }
      setBusy(form, true, 'Creating…'); msg(form, '');
      var suEmail = (f.email || '').trim();
      var s = await sb.auth.signUp({ email: suEmail, password: f.password, options: { emailRedirectTo: ACCOUNT_URL, data: { first_name: (f.first_name || '').trim(), last_name: (f.last_name || '').trim() } } });
      /* the email may already have an account (created by our travel desk or an earlier visit):
         signUp then errors OR silently returns a user with no identities and sends nothing —
         in both cases hand them a set-password link so they can get straight in */
      var suExisting = (s.error && /already.*registered/i.test(s.error.message || '')) ||
        (!s.error && s.data && s.data.user && s.data.user.identities && s.data.user.identities.length === 0);
      if (suExisting) {
        await sb.auth.resetPasswordForEmail(suEmail, { redirectTo: ACCOUNT_URL });
        setBusy(form, false);
        msg(form, 'Good news — this email already has an account with us. We’ve emailed you a secure link to set your password.', 'ok');
        return;
      }
      setBusy(form, false);
      if (s.error) { msg(form, s.error.message || 'Could not create account.', 'err'); return; }
      if (s.data && s.data.session) { loadDashboard(); return; }
      msg(form, 'Almost there — check your email to confirm your account, then sign in.', 'ok');
    } else if (action === 'forgot') {
      setBusy(form, true, 'Sending…'); msg(form, '');
      await sb.auth.resetPasswordForEmail((f.email || '').trim(), { redirectTo: ACCOUNT_URL });
      setBusy(form, false); msg(form, 'If that email has an account, a reset link is on its way.', 'ok');
    } else if (action === 'recover' || action === 'changepw') {
      var pe2 = pwError(f.password, f.password2); if (pe2) { msg(form, pe2, 'err'); return; }
      setBusy(form, true, 'Updating…'); msg(form, '');
      if (action === 'changepw') {
        var psess = (await sb.auth.getSession()).data.session;
        if (!psess) { viewAuth('signin'); return; }
        var chk = await sb.auth.signInWithPassword({ email: psess.user.email, password: f.current_password || '' });
        if (chk.error) { setBusy(form, false); msg(form, 'Current password is incorrect.', 'err'); return; }
      }
      var u = await sb.auth.updateUser({ password: f.password });
      setBusy(form, false);
      if (u.error) { msg(form, u.error.message || 'Could not update password.', 'err'); return; }
      if (action === 'changepw') {
        msg(form, 'Password updated.', 'ok'); form.reset();
        Array.prototype.forEach.call(form.querySelectorAll('.acct-reqs li'), function (li) { li.classList.remove('is-met'); });
        var cw = form.querySelector('.acct-confirm'); if (cw) cw.hidden = true;
      } else loadDashboard();
    } else if (action === 'savefields') {
      var sess = (await sb.auth.getSession()).data.session;
      if (!sess) { viewAuth('signin'); return; }
      var upd = {};
      SAVE_FIELDS.forEach(function (k) { if (k in f) { var v = f[k]; upd[k] = (v === '') ? null : v; } });
      ['phone', 'emergency_contact_phone'].forEach(function (pk) {
        var inp = form.querySelector('[name=' + pk + ']');
        if (inp && inp._iti) { upd[pk] = inp._iti.getNumber() || null; }
      });
      setBusy(form, true, 'Saving…'); msg(form, '');
      var up = await sb.from('profiles').update(upd).eq('id', sess.user.id);
      setBusy(form, false);
      if (up.error) { msg(form, up.error.message || 'Could not save.', 'err'); return; }
      Object.assign(state.profile, upd);
      msg(form, 'Changes saved', 'ok');
      (function (mb) { setTimeout(function () { if (mb && mb.classList.contains('ok')) { mb.style.display = 'none'; mb.textContent = ''; } }, 3500); })(form.querySelector('.acct-msg'));
      var nm = document.querySelector('.acct-nav-name'); if (nm) nm.textContent = ((state.profile.first_name || '') + ' ' + (state.profile.last_name || '')).trim() || 'Your account';
      var av = document.querySelector('.acct-nav-user .acct-avatar'); if (av && !state.profile.avatar_url) av.textContent = initials(state.profile);
    }
  }

  /* ---------- events ---------- */
  root.addEventListener('submit', function (e) { if (e.target && e.target.classList && e.target.classList.contains('acct-form')) { e.preventDefault(); handleSubmit(e.target); } });
  root.addEventListener('input', function (e) { var form = e.target.closest ? e.target.closest('.acct-form.has-pwcheck') : null; if (form && (e.target.name === 'password' || e.target.name === 'password2')) updatePwUI(form); });
  root.addEventListener('focusin', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-noaf')) e.target.removeAttribute('readonly'); });
  root.addEventListener('change', function (e) { if (e.target && e.target.classList && e.target.classList.contains('acct-photo-file')) { var f = e.target.files && e.target.files[0]; if (f) uploadAvatar(f, document.querySelector('.acct-photo-status')); } });
  root.addEventListener('click', function (e) {
    var sbtn = e.target.closest('.ut-select-btn');
    if (sbtn) { e.preventDefault(); var w = sbtn.closest('.ut-select'); var wasOpen = w.classList.contains('is-open'); closeAllSelects(); if (!wasOpen) { w.classList.add('is-open'); sbtn.setAttribute('aria-expanded', 'true'); } return; }
    var sopt = e.target.closest('.ut-select-opt');
    if (sopt) {
      var w2 = sopt.closest('.ut-select'), hid = w2.querySelector('input[type=hidden]');
      hid.value = sopt.getAttribute('data-val'); w2.querySelector('.ut-select-val').textContent = sopt.textContent;
      Array.prototype.forEach.call(w2.querySelectorAll('.ut-select-opt'), function (o) { o.classList.toggle('is-sel', o === sopt); });
      if (hid.name === 'emergency_contact_relationship') { var fm = w2.closest('form'); var oth = fm && fm.querySelector('.acct-other'); if (oth) oth.hidden = (hid.value !== 'Other'); }
      if (hid.name === 'address_country') {
        var afm = w2.closest('form'), dyn = afm && afm.querySelector('.acct-addr-dyn');
        if (dyn) {
          var cur = { address_city: (afm.querySelector('[name=address_city]') || {}).value || '', address_postal: (afm.querySelector('[name=address_postal]') || {}).value || '' };
          dyn.textContent = ''; dyn.appendChild(addrDynamic(hid.value, Object.assign({}, state.profile, cur)));
        }
      }
      closeAllSelects(); return;
    }
    var t = e.target.closest('[data-mode]'); if (t) { e.preventDefault(); viewAuth(t.getAttribute('data-mode')); return; }
    var a = e.target.closest('[data-action=signout]'); if (a) { e.preventDefault(); doSignOut(); }
    var rmav = e.target.closest('[data-action=removeavatar]'); if (rmav) { e.preventDefault(); removeAvatar(); return; }
    var aq = e.target.closest('[data-action=acceptquote]'); if (aq) { e.preventDefault(); decideQuote(aq.getAttribute('data-id'), 'accepted', aq.getAttribute('data-opt') || null); return; }
    var dq = e.target.closest('[data-action=declinequote]'); if (dq) { e.preventDefault(); decideQuote(dq.getAttribute('data-id'), 'declined'); return; }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.ut-select')) closeAllSelects(); });
  window.addEventListener('hashchange', function () { if (state.profile && document.getElementById('acct-content')) { renderContent(); return; } if (location.hash === '#signup' || location.hash === '#signin') viewAuth(location.hash.slice(1)); });

  /* ---------- init ---------- */
  /* dev-only preview: render the beautiful view straight from injected sample data (never set in production) */
  if (window.UT_ITIN_PREVIEW) {
    state.settings = window.UT_ITIN_PREVIEW.settings || {}; state.profile = window.UT_ITIN_PREVIEW.profile || {};
    var pvIt = window.UT_ITIN_PREVIEW.itinerary;
    /* mode 'doc' shows the printable Loya document (with working PDF download); default is the showpiece */
    if (window.UT_ITIN_PREVIEW.mode === 'doc') openOverlay(itinDoc(pvIt), 'Itinerary-' + (pvIt.itinerary_number || 'flyupgrade') + '.pdf', LD_PDF);
    else openBeautiful(pvIt);
    return;
  }
  /* magic share link: /account/?trip=<token> renders the itinerary read-only, no sign-in needed */
  var shareToken = (function () { try { return new URLSearchParams(location.search).get('trip') || ''; } catch (e) { return ''; } })();
  if (shareToken && /^[0-9a-f-]{36}$/i.test(shareToken)) {
    viewLoading();
    ensureGSAP(function () { });
    fetch(UT_SB.url + '/functions/v1/shared-itinerary?t=' + encodeURIComponent(shareToken))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.itinerary) { viewAuth('signin'); return; }
        state.settings = d.settings || {}; state.profile = d.profile || {};
        openBeautiful(d.itinerary);
        viewAuth('signin'); /* behind the overlay, so closing the itinerary lands somewhere sane */
      })
      .catch(function () { viewAuth('signin'); });
    return;
  }
  /* seed from the URL so a password-reset link can't lose a race to getSession() and land on the dashboard */
  var recovering = ('' + (location.hash || '') + (location.search || '')).indexOf('type=recovery') > -1;
  sb.auth.onAuthStateChange(function (event) { if (event === 'PASSWORD_RECOVERY') { recovering = true; viewRecovery(); } });
  fetchIpCountry();
  viewLoading();
  sb.auth.getSession().then(function (res) { if (recovering) { viewRecovery(); return; } if (res.data && res.data.session) loadDashboard(); else viewAuth(location.hash === '#signup' ? 'signup' : 'signin'); });
})();
