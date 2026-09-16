'use strict';

// Transactional email bodies, in the teacher's own language. Plain text is the
// real message; the HTML part is the same words with a button.

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shell(title, intro, buttonLabel, url, outro) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#eef3f8;
  font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0d2b45;line-height:1.55">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;
    border:1px solid rgba(21,101,160,.2);border-radius:16px"><tr><td style="padding:28px">
    <h1 style="margin:0 0 14px;font-size:21px;color:#1668a7">${esc(title)}</h1>
    <p style="margin:0 0 20px;font-size:15px">${esc(intro)}</p>
    <p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#1668a7;color:#fff;
      font-weight:700;font-size:15px;text-decoration:none;padding:13px 22px;border-radius:12px">${esc(buttonLabel)}</a></p>
    <p style="margin:0 0 6px;font-size:13px;color:#5a7184">${esc(outro)}</p>
    <p style="margin:0;font-size:12px;color:#5a7184;word-break:break-all">${esc(url)}</p>
  </td></tr></table></body></html>`;
}

const TEXTS = {
  verify: {
    fr: {
      subject: 'Confirmez votre adresse : Littératie IA',
      title: 'Confirmez votre adresse',
      intro: "Vous venez de créer un compte enseignant sur la plateforme Littératie IA. Confirmez cette adresse pour activer votre compte.",
      button: 'Confirmer mon adresse',
      outro: "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : aucun compte ne sera activé.",
    },
    en: {
      subject: 'Confirm your address: AI Literacy',
      title: 'Confirm your address',
      intro: 'You have just created a teacher account on the AI Literacy platform. Confirm this address to activate it.',
      button: 'Confirm my address',
      outro: 'This link expires in 24 hours. If you did not ask for this, ignore this message. No account will be activated.',
    },
  },
  reset: {
    fr: {
      subject: 'Réinitialiser votre mot de passe : Littératie IA',
      title: 'Réinitialiser votre mot de passe',
      intro: "Vous avez demandé un nouveau mot de passe pour votre compte enseignant. Choisissez-en un nouveau via le lien ci-dessous.",
      button: 'Choisir un nouveau mot de passe',
      outro: "Ce lien expire dans 1 heure et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
    },
    en: {
      subject: 'Reset your password: AI Literacy',
      title: 'Reset your password',
      intro: 'You asked for a new password for your teacher account. Pick a new one using the link below.',
      button: 'Choose a new password',
      outro: 'This link expires in 1 hour and can be used once. If you did not ask for this, ignore this message. Your current password still works.',
    },
  },
};

function build(kind, lang, url) {
  const c = (TEXTS[kind] || {})[lang === 'en' ? 'en' : 'fr'];
  return {
    subject: c.subject,
    text: `${c.title}\n\n${c.intro}\n\n${url}\n\n${c.outro}\n`,
    html: shell(c.title, c.intro, c.button, url, c.outro),
  };
}

module.exports = { build };
