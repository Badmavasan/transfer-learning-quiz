// UI strings (the questionnaire content itself is bilingual in questions.js).
window.I18N = {
  en: {
    brand: 'AI Literacy',
    footer: 'AI Literacy scientific study · anonymous · mouse & timing recorded · data stored in France and deleted after the study.',

    // Welcome
    welcome_title: 'How AI-literate are you, really? 🤖',
    welcome_lead: 'A short, playful quiz about Artificial Intelligence — and a fun persona waiting for you at the end.',
    welcome_desc_1: 'You will answer about twenty multiple-choice questions split into three themes: General Knowledge, Technical, and Ethics & Society. There are no trick scores and nothing to revise — just answer honestly.',
    welcome_desc_2: 'This is a scientific research study. While you answer, we record your mouse movements and the time you spend on each question. Everything is anonymous: we never ask for your email, and you are identified only by a random code.',
    welcome_privacy: 'Your data is collected solely for this scientific study, stored securely in France, and permanently deleted once the research is complete. Any questions? Contact {email}.',
    welcome_desc_3: 'At the end you unlock your AI-literacy persona. Will you be the Algorithm Sage 🧙, the Buzzword Parrot 🦜, or the Mad Tinkerer 🔧?',
    welcome_ack: 'I have read the above and I agree to take part.',
    welcome_start: 'Get my code & start →',
    welcome_or: 'Already have a code?',
    welcome_code_ph: 'Enter your code (e.g. K7P2QM)',
    welcome_reconnect: 'Reconnect',
    welcome_ack_required: 'Please tick the box to continue.',
    welcome_code_unknown: 'We don\'t recognise that code. Check it and try again.',

    // Code reveal
    code_title: 'Here is your personal code 🔑',
    code_lead: 'Write it down! You can use it to pause and come back later, or to see your persona again.',
    code_copy: 'Copy code',
    code_copied: 'Copied!',
    code_continue: 'Continue →',

    // Info
    info_title: 'First, a little about you',
    info_lead: 'This helps us understand who is taking the quiz. Nothing here identifies you personally.',
    info_first: 'First name',
    info_last: 'Last name',
    info_age: 'Age',
    info_level: 'What are you studying right now?',
    info_level_choose: 'Choose…',
    info_filiere: 'Which field / filière are you in?',
    info_filiere_ph: 'e.g. Computer Science, Law, Biology…',
    info_next: 'Start the quiz →',
    info_required: 'Please fill in all the fields.',

    level_highschool: 'High school',
    level_license: "Bachelor's / Licence",
    level_master: "Master's",
    level_engineering: "Engineering school (cycle d'ingénieur)",
    level_medecine: 'Medicine',
    level_phd: 'PhD / Doctorate',
    level_other: 'Other',

    // Rubric overview
    overview_title: 'Three themes, one you 🎯',
    overview_lead: 'The quiz is split into three rubrics. You\'ll go through them one at a time, and within each one the questions appear in a random order.',
    overview_start: 'Let\'s go →',
    overview_questions: 'questions',

    // Rubric intro
    rubric_intro_now: 'Now entering',
    rubric_intro_begin: 'Begin this section →',
    rubric_progress: 'Theme {cur} of {total}',

    // Question
    q_progress: 'Question {cur} / {total}',
    q_section_progress: '{cur} / {total} in this theme',
    q_next: 'Next →',
    q_finish: 'See my persona →',
    q_pick: 'Pick an answer to continue.',

    // Result
    result_kicker: 'Your AI-literacy persona is…',
    result_scores: 'Your scores',
    result_total: 'Overall',
    result_again: 'See my code again',
    result_share_note: 'Keep your code to revisit this persona anytime.',
    result_high: 'Strong',
    result_low: 'Growing',
    result_thanks: 'Thanks for taking part! 💜',
    loading: 'Loading…',
  },

  fr: {
    brand: 'Littératie IA',
    footer: "Étude scientifique sur la littératie en IA · anonyme · souris et temps enregistrés · données stockées en France et supprimées après l'étude.",

    welcome_title: 'Quel est votre vrai niveau en IA ? 🤖',
    welcome_lead: "Un petit quiz ludique sur l'intelligence artificielle — et un profil amusant qui vous attend à la fin.",
    welcome_desc_1: "Vous répondrez à une vingtaine de questions à choix multiples réparties en trois thèmes : Culture générale, Technique, et Éthique & société. Aucune note piège, rien à réviser — répondez simplement honnêtement.",
    welcome_desc_2: "Il s'agit d'une étude scientifique. Pendant que vous répondez, nous enregistrons vos mouvements de souris et le temps passé sur chaque question. Tout est anonyme : nous ne demandons jamais votre e-mail, vous êtes identifié uniquement par un code aléatoire.",
    welcome_privacy: "Vos données sont collectées uniquement pour cette étude scientifique, stockées de manière sécurisée en France, et définitivement supprimées une fois la recherche terminée. Une question ? Contactez {email}.",
    welcome_desc_3: "À la fin, vous débloquez votre profil de littératie en IA. Serez-vous le Sage de l'Algorithme 🧙, le Perroquet à Buzzwords 🦜, ou le Bricoleur Fou 🔧 ?",
    welcome_ack: "J'ai lu ce qui précède et j'accepte de participer.",
    welcome_start: 'Obtenir mon code & commencer →',
    welcome_or: 'Vous avez déjà un code ?',
    welcome_code_ph: 'Entrez votre code (ex. K7P2QM)',
    welcome_reconnect: 'Se reconnecter',
    welcome_ack_required: 'Veuillez cocher la case pour continuer.',
    welcome_code_unknown: 'Ce code est introuvable. Vérifiez-le et réessayez.',

    code_title: 'Voici votre code personnel 🔑',
    code_lead: "Notez-le ! Il vous permet de faire une pause et de revenir plus tard, ou de revoir votre profil.",
    code_copy: 'Copier le code',
    code_copied: 'Copié !',
    code_continue: 'Continuer →',

    info_title: "D'abord, un peu à propos de vous",
    info_lead: "Cela nous aide à comprendre qui passe le quiz. Rien ici ne vous identifie personnellement.",
    info_first: 'Prénom',
    info_last: 'Nom',
    info_age: 'Âge',
    info_level: "Que faites-vous comme études actuellement ?",
    info_level_choose: 'Choisir…',
    info_filiere: 'Dans quelle filière êtes-vous ?',
    info_filiere_ph: 'ex. Informatique, Droit, Biologie…',
    info_next: 'Commencer le quiz →',
    info_required: 'Veuillez remplir tous les champs.',

    level_highschool: 'Lycée',
    level_license: 'Licence',
    level_master: 'Master',
    level_engineering: "Cycle d'ingénieur",
    level_medecine: 'Médecine',
    level_phd: 'Doctorat',
    level_other: 'Autre',

    overview_title: 'Trois thèmes, un seul vous 🎯',
    overview_lead: "Le quiz est divisé en trois rubriques. Vous les parcourez une par une, et à l'intérieur de chacune les questions apparaissent dans un ordre aléatoire.",
    overview_start: "C'est parti →",
    overview_questions: 'questions',

    rubric_intro_now: 'Vous entrez dans',
    rubric_intro_begin: 'Commencer cette section →',
    rubric_progress: 'Thème {cur} sur {total}',

    q_progress: 'Question {cur} / {total}',
    q_section_progress: '{cur} / {total} dans ce thème',
    q_next: 'Suivant →',
    q_finish: 'Voir mon profil →',
    q_pick: 'Choisissez une réponse pour continuer.',

    result_kicker: 'Votre profil de littératie en IA est…',
    result_scores: 'Vos scores',
    result_total: 'Total',
    result_again: 'Revoir mon code',
    result_share_note: 'Gardez votre code pour revoir ce profil quand vous voulez.',
    result_high: 'Solide',
    result_low: 'En progression',
    result_thanks: 'Merci pour votre participation ! 💜',
    loading: 'Chargement…',
  },
};
