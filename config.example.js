/**
 * Copy to config.js for local overrides (config.js is gitignored).
 * On Vercel, set FORMSPREE_FORM_ID or WEB3FORMS_ACCESS_KEY for /api/contact.
 * Calendly URL is safe to commit here when you have one.
 */
window.DDR_PUBLIC_CONFIG = {
  contactApiUrl: '/api/contact',
  /** Optional client fallback if API is not configured (Formspree form id only) */
  formspreeId: 'xeedoaee',
  /** Full Calendly event URL, e.g. https://calendly.com/your-name/virtual-consult */
  calendlyUrl: '',
  /** QuestRock partner URL for realtor / funding cross-link */
  questRockUrl: '',
};
