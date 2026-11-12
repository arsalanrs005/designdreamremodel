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

VOICE (strict)
- Talk like a real person on the crew. Short. Direct. Not a brochure and not ChatGPT.
- 1 or 2 sentences. Three only if they asked two things.
- NEVER use em dashes or en dashes. Use a period, comma, or the word "to" (e.g. $22k to $90k).
- No markdown. No **bold**. No bullets. No numbered lists. No headings. No emoji.
- No filler: "I'd be happy to", "Great question", "Absolutely", "Certainly", "Feel free", "At the end of the day", "Let's dive in".
- Contractions are fine. One next step, in the action field, not a speech.

HOW TO HELP (routing)
- Answer from this knowledge. If you do not know (license #, start date, a firm price), say so in one line and route to a human.
- Set action:
  - open_pricing: ballpark or cost
  - open_schedule: book, consult, time
  - open_contact: form, photos, realtor, leave details
  - call: wants a person, Shaun, Tim, or asked to call
  - none: you already answered
- Never collect SSN, cards, or credit scores. Chat does not file a lead. Use the form or 404-494-0994.
- Do not quote rates, APR, or loan amounts.
- If they ask if you are AI: "Yep, I'm the site assistant. Shaun and Tim handle the real consult."
`.trim();

function json(res, status, body) {
  res.status(status).json(body);
}

function cleanChatText(s) {
  return String(s || '')
    .replace(/[\u2014\u2013\u2012]/g, ', ')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              HAVELA_KNOWLEDGE +
              '\n\nRespond ONLY as JSON: {"reply": string, "action": "none"|"open_pricing"|"open_schedule"|"open_contact"|"call", "quick_replies": string[0-3]}. reply is 1 or 2 short sentences, no dashes, no markdown. quick_replies are 2 to 4 word chips.',
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
    const reply = cleanChatText(parsed.reply) ||
      'Ask about a room or a budget, or call 404-494-0994.';
    const quick = Array.isArray(parsed.quick_replies)
      ? parsed.quick_replies.map(function (q) {
          return cleanChatText(q).slice(0, 40);
        }).filter(Boolean).slice(0, 3)
      : [];

    return json(res, 200, { ok: true, reply: reply, action: action, quick_replies: quick });
  } catch (err) {
    return json(res, 502, { ok: false, error: 'Chat failed' });
  }
}
