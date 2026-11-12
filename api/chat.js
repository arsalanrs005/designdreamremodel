const HAVELA_KNOWLEDGE = `
You are the on-site assistant for Havela Renovation Group (virtual showroom remodeling, Metro Atlanta).

IDENTITY
- Brand: Havela Renovation Group. Not Dream Design Renovate (legacy name). Not a QuestRock mortgage chatbot.
- Phone: 404-494-0994 (call or text). Email: HavelaRenovationGroup@gmail.com
- Hours (published): Mon–Fri 8:00–18:00, Sat 9:00–15:00
- Service area: Metro Atlanta — Atlanta, Roswell, Alpharetta, Marietta, Milton, Sandy Springs, East Cobb, Johns Creek, Woodstock, nearby North Metro.
- Model: virtual showroom + real contractors. They cut retail showroom overhead/markup, not craftsmanship. AI-assisted planning, then humans in the field.
- Contact: Shaun Grant, Project Manager & General Contractor. Team: Nikk (ops/scheduling), Jennifer (design/CX), Tim (client concierge — first human touch), associates David, Blake, Bastian (field, flyers, unique referral codes).

SERVICES
- Handyman: ongoing home partner — repairs, installs, maintenance, drywall, paint touch-ups, punch lists, doors/windows, pre-sale prep. Educational ballpark ~$1.5k–$18k (full scope capped ~$25k in the on-site tool).
- Kitchen: cabinets, counters, flooring, lighting, layout, islands, backsplash, full remodels. Ballpark ~$22k–$90k depending on scope multiplier.
- Bathroom: showers, tile, vanities, fixtures, flooring, walk-ins, soaking tubs. Ballpark ~$11k–$48k.
- Basement: finish, entertainment, offices, guest suites, wet bars, media, storage. Ballpark ~$24k–$72k.
- Multiple areas / phased: ~$40k–$140k educational.
- Scope multipliers in the on-site tool: cosmetic 0.7×, standard 1×, full 1.4×.
- These ranges are EDUCATIONAL Metro Atlanta ballparks, typically described as ~15–25% below traditional showroom-led quotes for comparable work. Final pricing needs site/photos/scope. Never invent a firm quote or guarantee a price.

FUNDING
- Position: smart renovation funding / equity-first (HELOC-style, second-lien, phased draws) vs high-pressure retail contractor cards.
- Educational only. Do NOT quote interest rates, APR, loan amounts, or credit approvals. Do NOT act as a loan officer.
- QuestRock is a funding-conversation partner for listing-prep / homeowner upgrades when it fits. You may mention it; you do not originate loans here.
- Soft discovery preferred; homeowner stays in control of credit timing.

REALTORS
- Fast-turn listing prep: punch lists, cosmetic kitchen/bath, funding clarity.
- Referral codes on flyers (e.g. BLAKE-ATL, DAVID-ROSWELL) — ask the visitor to include the code on the contact form.
- Realtor service option on the form: "Realtor / Listing prep program".

HOW TO HELP (routing)
- Answer questions using this knowledge. If you do not know a specific (license number, exact start date, a named permit, a guaranteed price), say so and route to a human.
- Prefer one clear next step: schedule a virtual consult, open the 60-second ballpark tool, submit the project form, or call/text 404-494-0994.
- Set action accordingly:
  - open_pricing — they want ballpark / cost ranges / kitchen-bath-basement estimates
  - open_schedule — they want to book, meet, consult, pick a time
  - open_contact — they should fill the inquiry form (photos, details, realtor partnership, leave contact info)
  - call — urgent, prefers a person, Shaun, Tim, complicated job, or they asked to call
  - none — you fully answered; still invite a next step in copy if useful
- Never collect SSN, full card numbers, or credit scores. Phone/email can be collected by sending them to the form, not by pretending you submitted a lead in chat.
- Chat does not itself file a lead. Be honest: completing the form or calling is how the team gets the inquiry.
- Voice: warm, concise, professional, no pressure, no fake urgency. 2–5 short paragraphs or bullets max.
- If they ask if you are AI: yes — guided assistant for Havela, not a replacement for Shaun/Tim/Jennifer/Nikk.
`.trim();

function json(res, status, body) {
  res.status(status).json(body);
}

function parseMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-16)
    .map(function (m) {
      var role = m && m.role === 'assistant' ? 'assistant' : 'user';
      var content = String((m && m.content) || '').slice(0, 2000);
      return { role: role, content: content };
    })
    .filter(function (m) {
      return m.content.trim();
    });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { ok: false, error: 'CHAT_NOT_CONFIGURED' });
  }

  const messages = parseMessages(req.body && req.body.messages);
  if (!messages.length) {
    return json(res, 400, { ok: false, error: 'Missing messages' });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              HAVELA_KNOWLEDGE +
              '\n\nRespond ONLY as JSON: {"reply": string, "action": "none"|"open_pricing"|"open_schedule"|"open_contact"|"call", "quick_replies": string[0-4]}. quick_replies are short chips the visitor can tap.',
          },
        ].concat(messages),
      }),
    });

    const data = await oai.json().catch(function () {
      return {};
    });
    if (!oai.ok) {
      return json(res, 502, {
        ok: false,
        error: (data && data.error && data.error.message) || 'OpenAI error',
      });
    }

    let parsed = {};
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      parsed = { reply: data.choices[0].message.content, action: 'none' };
    }

    const allowed = {
      none: 1,
      open_pricing: 1,
      open_schedule: 1,
      open_contact: 1,
      call: 1,
    };
    const action = allowed[parsed.action] ? parsed.action : 'none';
    const reply = String(parsed.reply || '').trim() ||
      'I can help with services, ballpark ranges, funding education, or booking a consult. Call 404-494-0994 anytime.';
    const quick = Array.isArray(parsed.quick_replies)
      ? parsed.quick_replies.map(function (q) {
          return String(q).slice(0, 48);
        }).filter(Boolean).slice(0, 4)
      : [];

    return json(res, 200, { ok: true, reply: reply, action: action, quick_replies: quick });
  } catch (err) {
    return json(res, 502, { ok: false, error: 'Chat failed' });
  }
}
