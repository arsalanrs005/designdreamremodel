function getPublicConfig() {
  return window.DDR_PUBLIC_CONFIG || {};
}

function collectContactPayload() {
  var intake = typeof loadIntake === 'function' ? loadIntake() : null;
  var intakeSummary = '';
  if (intake) {
    intakeSummary = [
      intake.category ? 'Category: ' + intake.category : '',
      intake.scope ? 'Scope: ' + intake.scope : '',
      intake.budget ? 'Budget band: ' + intake.budget : '',
      intake.timeline ? 'Timeline: ' + intake.timeline : '',
      intake.range
        ? 'Ballpark: ' + intake.range.low + ' – ' + intake.range.high
        : '',
      intake.source ? 'Source: ' + intake.source : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return {
    firstName: (document.getElementById('cf-first') || {}).value || '',
    lastName: (document.getElementById('cf-last') || {}).value || '',
    phone: (document.getElementById('cf-phone') || {}).value || '',
    email: (document.getElementById('cf-email') || {}).value || '',
    service: (document.getElementById('cf-service') || {}).value || '',
    streetAddress: (document.getElementById('cf-address') || {}).value || '',
    projectDetails: (document.getElementById('cf-details') || {}).value || '',
    budget: (document.getElementById('cf-budget') || {}).value || '',
    timeline: (document.getElementById('cf-timeline') || {}).value || '',
    scheduleDate: intake && intake.scheduleDate ? intake.scheduleDate : '',
    scheduleSlot: intake && intake.scheduleSlot ? intake.scheduleSlot : '',
    intakeSummary: intakeSummary,
    referralCode: (document.getElementById('cf-referral') || {}).value || '',
  };
}

function validateContactPayload(payload) {
  if (!payload.firstName.trim()) return 'Please enter your first name.';
  if (!payload.lastName.trim()) return 'Please enter your last name.';
  if (!payload.phone.trim()) return 'Please enter your phone number.';
  if (!payload.email.trim() || payload.email.indexOf('@') === -1) {
    return 'Please enter a valid email address.';
  }
  if (!payload.service) return 'Please select a service.';
  if (!payload.projectDetails.trim()) return 'Please describe your project.';
  return '';
}

function showFormError(msg) {
  var el = document.getElementById('formError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function postJson(url, payload) {
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  var data = {};
  try {
    data = await res.json();
  } catch (e) {}
  return { res: res, data: data };
}

async function submitViaFormspree(formId, payload, files) {
  var fd = new FormData();
  fd.append('name', payload.firstName + ' ' + payload.lastName);
  fd.append('email', payload.email);
  fd.append('phone', payload.phone);
  fd.append('service', payload.service);
  fd.append('budget', payload.budget);
  fd.append('timeline', payload.timeline);
  fd.append('address', payload.streetAddress);
  if (payload.referralCode) fd.append('referral_code', payload.referralCode);
  fd.append(
    'message',
    payload.intakeSummary
      ? payload.intakeSummary + '\n\n' + payload.projectDetails
      : payload.projectDetails
  );
  fd.append(
    '_subject',
    'DDR inquiry: ' + (payload.service || 'General')
  );
  if (files) {
    for (var i = 0; i < files.length; i++) {
      fd.append('photos', files[i]);
    }
  }
  var res = await fetch('https://formspree.io/f/' + formId, {
    method: 'POST',
    body: fd,
    headers: { Accept: 'application/json' },
  });
  var data = {};
  try {
    data = await res.json();
  } catch (e) {}
  return { res: res, data: data };
}

async function deliverInquiry(payload) {
  var cfg = getPublicConfig();
  var apiUrl = cfg.contactApiUrl || '/api/contact';
  var filesInput = document.getElementById('cf-photos');
  var files =
    filesInput && filesInput.files && filesInput.files.length
      ? filesInput.files
      : null;

  if (files && cfg.formspreeId) {
    var fsFile = await submitViaFormspree(cfg.formspreeId, payload, files);
    if (fsFile.res.ok) return { ok: true };
    throw new Error(
      (fsFile.data && fsFile.data.error) || 'Could not upload with photos.'
    );
  }

  var attempt = await postJson(apiUrl, payload);
  if (attempt.res.ok && attempt.data.ok) return { ok: true };

  if (attempt.res.status === 503 && cfg.formspreeId) {
    var fs = await submitViaFormspree(cfg.formspreeId, payload, null);
    if (fs.res.ok) return { ok: true };
    throw new Error(
      (fs.data && fs.data.error) || 'Could not send your inquiry.'
    );
  }

  if (attempt.data.error === 'FORM_NOT_CONFIGURED' && cfg.formspreeId) {
    var fs2 = await submitViaFormspree(cfg.formspreeId, payload, null);
    if (fs2.res.ok) return { ok: true };
  }

  var err =
    (attempt.data && attempt.data.error) ||
    (attempt.data && attempt.data.hint) ||
    'Could not send your inquiry. Call 404-494-0994 or email dreamdesignrenovate@gmail.com.';
  throw new Error(err);
}

function showFormSuccess(payload) {
  document.getElementById('contactForm').style.display = 'none';
  var success = document.getElementById('formSuccess');
  success.style.display = 'block';
  showFormError('');

  if (payload.scheduleDate && payload.scheduleSlot) {
    var extra = success.querySelector('.intake-schedule-note');
    if (!extra) {
      extra = document.createElement('p');
      extra.className = 'intake-schedule-note';
      extra.style.cssText = 'margin-top:12px;font-size:13px;color:var(--warm-gray)';
      success.appendChild(extra);
    }
    extra.textContent =
      'Preferred consultation: ' +
      payload.scheduleDate +
      ' · ' +
      payload.scheduleSlot +
      '.';
  }

  try {
    sessionStorage.removeItem('ddr_intake');
  } catch (e) {}
}

async function submitForm() {
  var btn = document.querySelector('#contactForm .submit-btn');
  var payload = collectContactPayload();
  var validationError = validateContactPayload(payload);
  if (validationError) {
    showFormError(validationError);
    return;
  }

  showFormError('');
  var prevLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    await deliverInquiry(payload);
    showFormSuccess(payload);
  } catch (err) {
    showFormError(
      err.message ||
        'Something went wrong. Please call 404-494-0994.'
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel || 'Send project inquiry';
    }
  }
}
