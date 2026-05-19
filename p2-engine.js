
// ── PHASE 2: CONVERSION ENGINE ──
var DDR_CONFIG = {
  phone: '4044940994',
  calendlyUrl: '',
  contactApiUrl: '/api/contact',
  formspreeId: ''
};

(function mergePublicConfig() {
  var pub = typeof window !== 'undefined' && window.DDR_PUBLIC_CONFIG;
  if (!pub) return;
  if (pub.calendlyUrl) DDR_CONFIG.calendlyUrl = pub.calendlyUrl;
  if (pub.contactApiUrl) DDR_CONFIG.contactApiUrl = pub.contactApiUrl;
  if (pub.formspreeId) DDR_CONFIG.formspreeId = pub.formspreeId;
  if (pub.questRockUrl) DDR_CONFIG.questRockUrl = pub.questRockUrl;
})();

var p2State = { mode: 'wizard', step: 0, category: '', scope: '', budget: '', timeline: '', scheduleDate: '', scheduleSlot: '', contactName: '', contactPhone: '' };
var p2WizardSteps = 5;
var speechRec = null;
var speechTarget = null;
var speechBtnId = null;

var P2_CATEGORIES = {
  handyman: { label: 'Handyman', sub: 'Repairs, punch lists, ongoing home partner', service: 'Handyman Services' },
  kitchen: { label: 'Kitchen', sub: 'Layout, cabinets, surfaces, lighting', service: 'Kitchen Design & Remodeling' },
  bath: { label: 'Bathroom', sub: 'Refresh through full gut remodel', service: 'Bathroom Design & Remodeling' },
  basement: { label: 'Basement', sub: 'Finish, entertainment, in-law suites', service: 'Basement Design & Remodeling' },
  multiple: { label: 'Multiple areas', sub: 'Phased or bundled renovation program', service: 'Multiple Services' }
};

var P2_BASE_RANGES = {
  handyman: [1500, 18000],
  kitchen: [22000, 90000],
  bath: [11000, 48000],
  basement: [24000, 72000],
  multiple: [40000, 140000]
};

var P2_SCOPE_MULT = { cosmetic: 0.7, standard: 1, full: 1.4 };
var P2_TIMELINE_NOTE = { asap: 'Priority scheduling may affect lead times.', '1mo': '', '1-3': '', '3-6': '', planning: 'Great for design-first virtual showroom planning.' };

var CHAT_GREETING = 'Hi — I\'m the Dream Design Renovate virtual assistant. Ask about ballpark pricing, our handyman-through-basement services, smart project funding, or booking a consult. No showroom markup, no pressure.';
var CHAT_QUICK = ['Ballpark pricing', 'Kitchen cost range', 'How funding works', 'Book a consultation', 'Talk to Shaun'];

function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function saveIntake(extra) {
  var data = Object.assign({
    category: p2State.category,
    scope: p2State.scope,
    budget: p2State.budget,
    timeline: p2State.timeline,
    scheduleDate: p2State.scheduleDate,
    scheduleSlot: p2State.scheduleSlot,
    range: computeBallpark()
  }, extra || {});
  try { sessionStorage.setItem('ddr_intake', JSON.stringify(data)); } catch (e) {}
  return data;
}

function loadIntake() {
  try {
    var raw = sessionStorage.getItem('ddr_intake');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function applyIntakeToForm() {
  var data = loadIntake();
  if (!data) return;
  var svc = document.getElementById('cf-service');
  var cat = P2_CATEGORIES[data.category];
  if (svc && cat) svc.value = cat.service;
  var bud = document.getElementById('cf-budget');
  if (bud && data.budget) {
    var map = { under5: 'Under $5,000', '5-15': '$5,000 – $15,000', '15-30': '$15,000 – $30,000', '30-60': '$30,000 – $60,000', '60plus': '$60,000+', flex: 'Not Sure / Flexible' };
    if (map[data.budget]) bud.value = map[data.budget];
  }
  var tl = document.getElementById('cf-timeline');
  if (tl && data.timeline) {
    var tmap = { asap: 'ASAP', '1mo': 'Within 1 Month', '1-3': '1–3 Months', '3-6': '3–6 Months', planning: 'Planning Ahead' };
    if (tmap[data.timeline]) tl.value = tmap[data.timeline];
  }
  var det = document.getElementById('cf-details');
  if (det && data.range) {
    var note = 'Ballpark from pricing tool: ' + data.range.label + ' (' + data.range.low + ' – ' + data.range.high + ').';
    if (data.scheduleDate && data.scheduleSlot) note += ' Preferred consult: ' + data.scheduleDate + ' ' + data.scheduleSlot + '.';
    if (!det.value.trim()) det.value = note;
    else if (det.value.indexOf('Ballpark from pricing tool') === -1) det.value = note + '\n\n' + det.value;
  }
}

function computeBallpark() {
  var base = P2_BASE_RANGES[p2State.category] || [10000, 50000];
  var mult = P2_SCOPE_MULT[p2State.scope] || 1;
  var low = Math.round(base[0] * mult);
  var high = Math.round(base[1] * mult);
  if (p2State.category === 'handyman' && p2State.scope === 'full') { high = Math.min(high, 25000); }
  return {
    low: formatMoney(low),
    high: formatMoney(high),
    label: (P2_CATEGORIES[p2State.category] || {}).label || 'Project',
    disclaimer: 'Educational ballpark for Metro Atlanta. Final pricing depends on site visit, materials, and scope — typically 15–25% below traditional showroom-led quotes for comparable work.'
  };
}

function openPricingWizard() {
  p2State = { mode: 'wizard', step: 0, category: '', scope: '', budget: '', timeline: '', scheduleDate: '', scheduleSlot: '', contactName: '', contactPhone: '' };
  document.getElementById('p2ModalTitle').textContent = 'Get your ballpark range';
  document.getElementById('p2ModalSub').textContent = '60 seconds · no obligation · real contractor ranges for Metro Atlanta';
  openP2Modal();
  renderP2Step();
}

function openScheduleOnly() {
  p2State = { mode: 'schedule', step: 0, category: '', scope: '', budget: '', timeline: '', scheduleDate: '', scheduleSlot: '', contactName: '', contactPhone: '' };
  document.getElementById('p2ModalTitle').textContent = 'Schedule a virtual consultation';
  document.getElementById('p2ModalSub').textContent = 'Pick a time that works — we confirm by text or call within one business day.';
  openP2Modal();
  renderP2Step();
}

function openP2Modal() {
  document.getElementById('p2Overlay').classList.add('open');
  document.getElementById('p2Modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeP2Modal() {
  document.getElementById('p2Overlay').classList.remove('open');
  document.getElementById('p2Modal').classList.remove('open');
  document.body.style.overflow = '';
}

function p2TotalSteps() {
  return p2State.mode === 'schedule' ? 2 : p2WizardSteps + 1;
}

function renderP2Progress() {
  var total = p2TotalSteps();
  var html = '';
  for (var i = 0; i < total; i++) {
    var cls = i < p2State.step ? 'done' : (i === p2State.step ? 'active' : '');
    html += '<span class="' + cls + '"></span>';
  }
  document.getElementById('p2Progress').innerHTML = html;
}

function renderP2Step() {
  renderP2Progress();
  var body = document.getElementById('p2Body');
  var back = document.getElementById('p2BackBtn');
  var next = document.getElementById('p2NextBtn');
  back.style.display = p2State.step > 0 ? 'inline-flex' : 'none';

  if (p2State.mode === 'schedule') {
    if (p2State.step === 0) {
      body.innerHTML =
        '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">' +
        (DDR_CONFIG.calendlyUrl
          ? 'Book a live slot on our calendar, or choose a preferred window below.'
          : 'Select a preferred date and time window (Mon–Fri).') +
        '</p>' +
        buildScheduleHtml();
      next.textContent = DDR_CONFIG.calendlyUrl ? 'Continue with preference' : 'Continue';
      setTimeout(initCalendlyEmbed, 120);
    } else {
      body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">We\'ll confirm this slot by phone or text.</p>' +
        '<div class="form-group"><label>YOUR NAME</label><input type="text" id="p2-name" value="' + escAttr(p2State.contactName) + '" placeholder="First and last name"/></div>' +
        '<div class="form-group"><label>PHONE *</label><input type="tel" id="p2-phone" value="' + escAttr(p2State.contactPhone) + '" placeholder="(404) 000-0000"/></div>' +
        '<p style="font-size:13px;color:var(--warm-gray);margin-top:12px">Selected: <strong>' + escHtml(p2State.scheduleDate) + '</strong> · <strong>' + escHtml(p2State.scheduleSlot) + '</strong></p>';
      next.textContent = 'Confirm consultation';
    }
    return;
  }

  if (p2State.step === 0) {
    var grid = '';
    Object.keys(P2_CATEGORIES).forEach(function(key) {
      var c = P2_CATEGORIES[key];
      var sel = p2State.category === key ? ' selected' : '';
      grid += '<button type="button" class="p2-cat-btn' + sel + '" data-cat="' + key + '" onclick="p2SelectCategory(\'' + key + '\')"><strong>' + c.label + '</strong><span>' + c.sub + '</span></button>';
    });
    body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">What are you planning?</p><div class="p2-cat-grid">' + grid + '</div>';
    next.textContent = 'Continue';
  } else if (p2State.step === 1) {
    body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">How extensive is the work?</p><div class="p2-scope-row">' +
      scopeChip('cosmetic', 'Refresh / cosmetic') +
      scopeChip('standard', 'Standard remodel') +
      scopeChip('full', 'Full transformation') +
      '</div>';
    next.textContent = 'Continue';
  } else if (p2State.step === 2) {
    body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">What budget range are you exploring?</p><div class="p2-budget-grid">' +
      budgetOpt('under5', 'Under $5,000', 'Handyman & small projects') +
      budgetOpt('5-15', '$5,000 – $15,000', 'Focused room updates') +
      budgetOpt('15-30', '$15,000 – $30,000', 'Mid-scope remodels') +
      budgetOpt('30-60', '$30,000 – $60,000', 'Major single-room or phased work') +
      budgetOpt('60plus', '$60,000+', 'Full kitchen, bath, or multi-area') +
      budgetOpt('flex', 'Flexible / not sure', 'We\'ll help you prioritize') +
      '</div>';
    next.textContent = 'Continue';
  } else if (p2State.step === 3) {
    body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">When would you like to start?</p><div class="p2-scope-row">' +
      timelineChip('asap', 'ASAP') +
      timelineChip('1mo', 'Within 1 month') +
      timelineChip('1-3', '1–3 months') +
      timelineChip('3-6', '3–6 months') +
      timelineChip('planning', 'Planning ahead') +
      '</div>';
    next.textContent = 'See my range';
  } else if (p2State.step === 4) {
    var r = computeBallpark();
    body.innerHTML = '<div class="p2-result"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--gold-dark);font-weight:700">Estimated ballpark</div>' +
      '<div class="p2-result-range">' + r.low + ' – ' + r.high + '</div>' +
      '<p style="font-size:15px;color:var(--charcoal);margin-bottom:12px">' + escHtml(r.label) + ' · ' + escHtml((P2_SCOPE_MULT[p2State.scope] ? p2State.scope : 'standard')) + ' scope</p>' +
      '<p class="p2-result-note">' + r.disclaimer + '</p></div>';
    next.textContent = 'Schedule consultation';
  } else if (p2State.step === 5) {
    body.innerHTML = '<p style="font-size:14px;color:var(--warm-gray);margin-bottom:16px">Pick a preferred virtual consultation time.</p>' + buildScheduleHtml() +
      '<div class="form-group" style="margin-top:20px"><label>PHONE (optional)</label><input type="tel" id="p2-phone" value="' + escAttr(p2State.contactPhone) + '" placeholder="For confirmation text"/></div>';
    next.textContent = 'Save & continue to form';
    setTimeout(initCalendlyEmbed, 120);
  }
}

function scopeChip(val, label) {
  var sel = p2State.scope === val ? ' selected' : '';
  return '<button type="button" class="p2-chip' + sel + '" data-val="' + val + '" onclick="p2SelectScope(\'' + val + '\')">' + label + '</button>';
}
function timelineChip(val, label) {
  var sel = p2State.timeline === val ? ' selected' : '';
  return '<button type="button" class="p2-chip' + sel + '" onclick="p2SelectTimeline(\'' + val + '\')">' + label + '</button>';
}
function budgetOpt(val, title, sub) {
  var sel = p2State.budget === val ? ' selected' : '';
  return '<label class="p2-budget-opt' + sel + '" onclick="p2SelectBudget(\'' + val + '\')"><input type="radio" name="p2budget" ' + (sel ? 'checked' : '') + '/><div><strong>' + title + '</strong><span>' + sub + '</span></div></label>';
}

function p2SelectCategory(k) { p2State.category = k; document.querySelectorAll('.p2-cat-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.cat === k); }); }
function p2SelectScope(v) { p2State.scope = v; renderP2Step(); }
function p2SelectTimeline(v) { p2State.timeline = v; renderP2Step(); }
function p2SelectBudget(v) { p2State.budget = v; renderP2Step(); }

function buildCalendlySection() {
  if (!DDR_CONFIG.calendlyUrl) return '';
  return (
    '<div class="p2-calendly-wrap">' +
    '<div id="p2CalendlyEmbed" style="min-width:100%;height:min(520px,55vh)"></div>' +
    '<p class="p2-calendly-or">— or pick a preferred window below —</p></div>'
  );
}

function initCalendlyEmbed() {
  if (!DDR_CONFIG.calendlyUrl || !window.Calendly) return;
  var parent = document.getElementById('p2CalendlyEmbed');
  if (!parent) return;
  parent.innerHTML = '';
  window.Calendly.initInlineWidget({
    url: DDR_CONFIG.calendlyUrl,
    parentElement: parent,
    utm: { utmSource: 'dreamdesignrenovate' }
  });
}

function buildScheduleHtml() {
  var days = getNextWeekdays(12);
  var html = buildCalendlySection();
  html += '<div class="p2-schedule-grid" id="p2Days">';
  days.forEach(function(d) {
    var sel = p2State.scheduleDate === d.key ? ' selected' : '';
    html += '<button type="button" class="p2-slot' + sel + '" data-date="' + d.key + '" onclick="p2SelectDate(\'' + d.key + '\')">' + d.label + '<small>' + d.sub + '</small></button>';
  });
  html += '</div><p style="font-size:13px;color:var(--warm-gray);margin-bottom:10px">Time window</p><div class="p2-scope-row" id="p2Slots">';
  ['Morning (9–11)', 'Midday (11–1)', 'Afternoon (1–4)', 'Evening (4–6)'].forEach(function(slot) {
    var sel = p2State.scheduleSlot === slot ? ' selected' : '';
    html += '<button type="button" class="p2-chip' + sel + '" onclick="p2SelectSlot(\'' + slot.replace(/'/g, "\\'") + '\')">' + slot + '</button>';
  });
  html += '</div>';
  return html;
}

function getNextWeekdays(n) {
  var out = [];
  var d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    var day = d.getDay();
    if (day === 0 || day === 6) continue;
    var key = d.toISOString().slice(0, 10);
    out.push({
      key: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      sub: d.toLocaleDateString('en-US', { year: 'numeric' })
    });
  }
  return out;
}

function p2SelectDate(key) { p2State.scheduleDate = key; renderP2Step(); }
function p2SelectSlot(slot) { p2State.scheduleSlot = slot; renderP2Step(); }

function p2PrevStep() {
  if (p2State.step > 0) { p2State.step--; renderP2Step(); }
}

function p2NextStep() {
  if (p2State.mode === 'schedule') {
    if (p2State.step === 0) {
      if (!p2State.scheduleDate || !p2State.scheduleSlot) {
        if (DDR_CONFIG.calendlyUrl) {
          p2State.scheduleDate = p2State.scheduleDate || 'Calendly';
          p2State.scheduleSlot = p2State.scheduleSlot || 'Booked via calendar';
        } else {
          alert('Please pick a date and time window.');
          return;
        }
      }
      p2State.step = 1;
      renderP2Step();
      return;
    }
    var phoneEl = document.getElementById('p2-phone');
    var nameEl = document.getElementById('p2-name');
    p2State.contactPhone = phoneEl ? phoneEl.value.trim() : '';
    p2State.contactName = nameEl ? nameEl.value.trim() : '';
    if (!p2State.contactPhone) { alert('Please add a phone number so we can confirm.'); return; }
    saveIntake({ source: 'schedule-only' });
    closeP2Modal();
    showPage('contact');
    applyIntakeToForm();
    alert('Consultation request saved. Complete the form if you\'d like to add photos or details — we\'ll confirm your slot soon.');
    return;
  }

  if (p2State.step === 0 && !p2State.category) { alert('Choose a project type to continue.'); return; }
  if (p2State.step === 1 && !p2State.scope) { alert('Select a scope level.'); return; }
  if (p2State.step === 2 && !p2State.budget) { alert('Select a budget range.'); return; }
  if (p2State.step === 3 && !p2State.timeline) { alert('Select a timeline.'); return; }

  if (p2State.step === 4) {
    p2State.step = 5;
    renderP2Step();
    return;
  }

  if (p2State.step === 5) {
    if (!p2State.scheduleDate || !p2State.scheduleSlot) {
      if (DDR_CONFIG.calendlyUrl) {
        p2State.scheduleDate = p2State.scheduleDate || 'Calendly';
        p2State.scheduleSlot = p2State.scheduleSlot || 'Booked via calendar';
      } else {
        alert('Pick a consultation date and time window, or call us at 404-494-0994.');
        return;
      }
    }
    var ph = document.getElementById('p2-phone');
    if (ph) p2State.contactPhone = ph.value.trim();
    saveIntake({ source: 'pricing-wizard' });
    closeP2Modal();
    showPage('contact');
    applyIntakeToForm();
    return;
  }

  if (p2State.step < 4) {
    p2State.step++;
    renderP2Step();
  }
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

// ── CHAT ──
function toggleChat(open) {
  var panel = document.getElementById('chatPanel');
  var on = open === true || (open !== false && !panel.classList.contains('open'));
  panel.classList.toggle('open', on);
  panel.setAttribute('aria-hidden', on ? 'false' : 'true');
  if (on && !panel.dataset.inited) {
    panel.dataset.inited = '1';
    addChatMessage('bot', CHAT_GREETING);
    renderChatQuick();
  }
  if (on) setTimeout(function() { document.getElementById('chatInput').focus(); }, 200);
}

function renderChatQuick() {
  var el = document.getElementById('chatQuick');
  el.innerHTML = '';
  CHAT_QUICK.forEach(function(q) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    b.onclick = function() { handleChatQuick(q); };
    el.appendChild(b);
  });
}

function addChatMessage(role, text) {
  var box = document.getElementById('chatMessages');
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendChatMessage() {
  var input = document.getElementById('chatInput');
  var text = (input.value || '').trim();
  if (!text) return;
  input.value = '';
  addChatMessage('user', text);
  setTimeout(function() { addChatMessage('bot', getChatReply(text)); }, 400);
}

function handleChatQuick(q) {
  addChatMessage('user', q);
  setTimeout(function() {
    if (q.indexOf('Ballpark') !== -1 || q.indexOf('Kitchen') !== -1) {
      addChatMessage('bot', 'Opening our 60-second pricing questionnaire — real Metro Atlanta ranges without showroom markup.');
      setTimeout(openPricingWizard, 600);
    } else if (q.indexOf('Book') !== -1) {
      addChatMessage('bot', 'Opening consultation scheduling…');
      setTimeout(openScheduleOnly, 600);
    } else if (q.indexOf('Talk to Shaun') !== -1) {
      addChatMessage('bot', 'Call or text 404-494-0994 anytime. I can also take you to the contact form.');
      setTimeout(function() { showPage('contact'); toggleChat(false); }, 800);
    } else {
      addChatMessage('bot', getChatReply(q));
    }
  }, 350);
}

function getChatReply(msg) {
  var m = msg.toLowerCase();
  if (/price|cost|ballpark|budget|how much|quote|estimate/.test(m)) {
    return 'Most homeowners start with our instant ballpark tool (about 60 seconds). Kitchen refreshes often land mid-five figures; baths mid-four to low-five; handyman programs vary widely. Want me to open the questionnaire?';
  }
  if (/kitchen/.test(m)) return 'Kitchen work through our virtual showroom typically runs roughly $22k–$90k depending on cabinets, layout changes, and finishes — often less overhead than a traditional design center. I can launch the ballpark tool filtered for kitchens.';
  if (/bath|bathroom/.test(m)) return 'Bathroom projects usually range from about $11k for focused updates to $48k+ for full transformations. We scope virtually first so you are not paying for a brick-and-mortar showroom.';
  if (/basement/.test(m)) return 'Finished basements in our market often fall between $24k and $72k depending on bath additions, egress, and AV. We can walk through layout options in a virtual consult.';
  if (/handyman|repair|punch/.test(m)) return 'Handyman is our ongoing home-partner program — ideal for punch lists, installs, and small upgrades. Many visits bundle into efficient routes; ballpark starts around $1.5k for defined scopes.';
  if (/fund|financ|heloc|equity|loan|pay/.test(m)) return 'We guide smart renovation funding — often equity-first (HELOC-style) rather than high-pressure retail contractor cards. Visit Project funding on the site or mention it in your inquiry; we keep it educational, not salesy.';
  if (/showroom|virtual|overhead|markup|model/.test(m)) return 'We eliminated expensive showrooms and unnecessary overhead — not quality. You get AI-assisted virtual design, real contractors, and transparent conversations instead of retail markups.';
  if (/schedule|book|appointment|consult|meet/.test(m)) { setTimeout(openScheduleOnly, 500); return 'Opening consultation scheduling — pick a date and time window that works for you.'; }
  if (/human|shaun|person|talk|call|phone/.test(m)) return 'Absolutely — call or text 404-494-0994 or email dreamdesignrenovate@gmail.com. I can also take you to the contact form with your details pre-filled if you have used the pricing tool.';
  if (/area|location|atlanta|roswell|serve/.test(m)) return 'We serve Metro Atlanta including Roswell, Alpharetta, Marietta, Milton, Sandy Springs, and East Cobb.';
  if (/ai|chat|bot/.test(m)) return 'I am a guided assistant built for fast answers — not a replacement for Shaun and the team. For site-specific advice, a short virtual consult is best.';
  if (/open|start|questionnaire|wizard|yes|sure|please/.test(m) && /price|tool|ballpark/.test(m)) { setTimeout(openPricingWizard, 500); return 'Opening the ballpark pricing questionnaire now…'; }
  return 'Good question. For specifics on your home, the fastest path is our ballpark tool or a quick call at 404-494-0994. Try asking about kitchen costs, funding, or booking a consult — or tap a suggestion below.';
}

function initPhase2() {
  var chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
  }
}

// ── VOICE INPUT ──
function toggleVoiceInput(inputId, btnId) {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Try Chrome or Safari on a device with a microphone.');
    return;
  }
  var input = document.getElementById(inputId);
  var btn = document.getElementById(btnId);
  if (speechRec && speechBtnId === btnId) {
    speechRec.stop();
    return;
  }
  speechRec = new SpeechRecognition();
  speechRec.continuous = true;
  speechRec.interimResults = true;
  speechRec.lang = 'en-US';
  speechTarget = input;
  speechBtnId = btnId;
  var base = input.value ? input.value + ' ' : '';
  speechRec.onresult = function(ev) {
    var transcript = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      transcript += ev.results[i][0].transcript;
    }
    input.value = base + transcript;
  };
  speechRec.onend = function() {
    if (btn) btn.classList.remove('listening');
    speechRec = null;
  };
  speechRec.onerror = function() {
    if (btn) btn.classList.remove('listening');
    speechRec = null;
  };
  try {
    speechRec.start();
    if (btn) btn.classList.add('listening');
  } catch (err) {
    alert('Could not start microphone. Check permissions and try again.');
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeP2Modal();
    toggleChat(false);
    closeLightbox();
  }
});
