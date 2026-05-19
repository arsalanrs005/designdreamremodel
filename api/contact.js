function formatInquiryMessage(body) {
  const lines = [
    '--- Dream Design Renovate inquiry ---',
    'Service: ' + (body.service || '—'),
    'Budget: ' + (body.budget || '—'),
    'Timeline: ' + (body.timeline || '—'),
    'Address: ' + (body.streetAddress || '—'),
    'Referral code: ' + (body.referralCode || '—'),
  ];
  if (body.scheduleDate && body.scheduleSlot) {
    lines.push('Preferred consult: ' + body.scheduleDate + ' · ' + body.scheduleSlot);
  }
  if (body.intakeSummary) {
    lines.push('', 'Pricing / intake:', body.intakeSummary);
  }
  lines.push('', 'Project details:', body.projectDetails || '—');
  return lines.join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const projectDetails = (body.projectDetails || '').trim();

  if (!firstName || !lastName || !email || !phone || !projectDetails) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const fullName = firstName + ' ' + lastName;
  const message = formatInquiryMessage(body);
  const subject =
    'DDR inquiry: ' + (body.service || 'General') + ' — ' + fullName;

  const formspreeId = process.env.FORMSPREE_FORM_ID;
  const web3Key = process.env.WEB3FORMS_ACCESS_KEY;

  if (formspreeId) {
    try {
      const fsRes = await fetch('https://formspree.io/f/' + formspreeId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email,
          phone,
          service: body.service,
          budget: body.budget,
          timeline: body.timeline,
          address: body.streetAddress,
          message,
          _subject: subject,
        }),
      });
      const data = await fsRes.json().catch(function () {
        return {};
      });
      if (fsRes.ok) {
        return res.status(200).json({ ok: true, provider: 'formspree' });
      }
      return res.status(502).json({
        ok: false,
        error: data.error || 'Form delivery failed',
      });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'Form delivery failed' });
    }
  }

  if (web3Key) {
    try {
      const wRes = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: web3Key,
          name: fullName,
          email,
          phone,
          subject,
          message,
          from_name: 'Dream Design Renovate Website',
        }),
      });
      const wData = await wRes.json().catch(function () {
        return {};
      });
      if (wRes.ok && wData.success) {
        return res.status(200).json({ ok: true, provider: 'web3forms' });
      }
      return res.status(502).json({
        ok: false,
        error: wData.message || 'Form delivery failed',
      });
    } catch (err) {
      return res.status(502).json({ ok: false, error: 'Form delivery failed' });
    }
  }

  return res.status(503).json({
    ok: false,
    error: 'FORM_NOT_CONFIGURED',
    hint: 'Set FORMSPREE_FORM_ID or WEB3FORMS_ACCESS_KEY in Vercel environment variables.',
  });
}
