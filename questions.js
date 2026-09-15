// AI Literacy questionnaire — bilingual question bank.
// Each question belongs to one rubric (category): "general" | "technique" | "ethique".
// "difficulty" is 1..3 (used to flavour ordering); within a rubric questions are
// randomised on the client. "correct" is the correct option key and is NEVER sent
// to the browser (scoring happens server-side).

const RUBRICS = {
  general: {
    key: 'general',
    label: { en: 'General Knowledge', fr: 'Culture générale' },
    blurb: {
      en: 'The big picture: what AI is and what it can (and cannot) do.',
      fr: "La vue d'ensemble : ce qu'est l'IA et ce qu'elle peut (ou non) faire.",
    },
    emoji: '🌍',
  },
  technique: {
    key: 'technique',
    label: { en: 'Technical', fr: 'Technique' },
    blurb: {
      en: 'Under the hood: tokens, prompting and how models actually work.',
      fr: "Sous le capot : tokens, prompts et le fonctionnement réel des modèles.",
    },
    emoji: '⚙️',
  },
  ethique: {
    key: 'ethique',
    label: { en: 'Ethics & Society', fr: 'Éthique & société' },
    blurb: {
      en: 'The tricky stuff: bias, privacy, copyright, disinformation and the law.',
      fr: "Le terrain glissant : biais, vie privée, droit d'auteur, désinformation et la loi.",
    },
    emoji: '⚖️',
  },
};

const QUESTIONS = [
  // ---------------- GENERAL ----------------
  {
    id: 'q1', rubric: 'general', difficulty: 1, correct: 'A',
    q: {
      en: 'Which of the following best describes "Generative AI"?',
      fr: "Laquelle de ces descriptions correspond le mieux à l'IA générative ?",
    },
    options: [
      { key: 'A', en: 'AI that creates new content like text, images, or music by learning from existing data.', fr: "Une IA qui crée un contenu nouveau comme du texte, des images ou de la musique en ayant appris à partir de données." },
      { key: 'B', en: 'An AI system designed to enhance the speed and accuracy of data retrieval in search engines.', fr: "Un système d'IA créé pour améliorer la vitesse et la précision de la récupération de données par des moteurs de recherche." },
      { key: 'C', en: 'A form of artificial intelligence that focuses on translating languages in real-time.', fr: "Une forme d'intelligence artificielle spécialisée dans la traduction en temps réel." },
      { key: 'D', en: 'AI technology used primarily for managing and organizing large databases.', fr: "Des technologies d'IA utilisées pour organiser de larges bases de données." },
    ],
  },
  {
    id: 'q2', rubric: 'general', difficulty: 1, correct: 'B',
    q: {
      en: 'Which of the following statements best describes an LLM (Large Language Model)?',
      fr: 'Laquelle de ces descriptions correspond le mieux aux LLM (grands modèles de langage) ?',
    },
    options: [
      { key: 'A', en: 'It generates text by analyzing and summarizing large volumes of web content.', fr: "Ils génèrent du texte en analysant et synthétisant des grands volumes de contenus en ligne." },
      { key: 'B', en: 'It generates text by predicting the next word based on the context of previous words.', fr: "Ils génèrent du texte en prédisant le prochain mot à partir du contexte des mots précédents." },
      { key: 'C', en: 'It generates text by translating input text into multiple languages simultaneously.', fr: "Ils génèrent du texte en traduisant simultanément un texte donné en plusieurs langues." },
      { key: 'D', en: 'It generates text by using pre-defined templates and filling in the blanks.', fr: "Ils génèrent du texte en remplissant des textes à trou pré-définis." },
    ],
  },
  {
    id: 'q3', rubric: 'general', difficulty: 2, correct: 'D',
    q: {
      en: 'Which of the following tasks can Generative AI perform with a high degree of accuracy?',
      fr: 'Quelle tâche peut être réalisée avec un suffisamment haut degré de précision par des IA génératives ?',
    },
    options: [
      { key: 'A', en: 'Predicting stock market trends.', fr: "Prédire l'évolution de la bourse." },
      { key: 'B', en: 'Making ethical decisions in complex scenarios.', fr: "Prendre des décisions éthiques dans des scénarios complexes." },
      { key: 'C', en: 'Diagnosing rare diseases.', fr: "Diagnostiquer de rares maladies." },
      { key: 'D', en: 'Generating human-like text based on prompts.', fr: "Générer des textes qui ressemblent à ceux produits par des humains à partir de prompts." },
    ],
  },
  {
    id: 'q8', rubric: 'general', difficulty: 2, correct: 'C',
    q: {
      en: 'Which of the following is NOT a requirement for an AI to be considered artificial general intelligence (AGI)?',
      fr: "Quelle caractéristique n'est PAS nécessaire pour qu'une IA puisse être qualifiée d'intelligence artificielle générale/forte ?",
    },
    options: [
      { key: 'A', en: 'The ability to learn and adapt to new tasks without human intervention.', fr: "La capacité à apprendre et à s'adapter à de nouvelles tâches sans intervention humaine." },
      { key: 'B', en: 'The capability to perform tasks across various domains with human-like proficiency.', fr: "La capacité à réaliser des tâches dans de nombreux domaines avec un niveau de compétence semblable à celle d'un humain." },
      { key: 'C', en: 'The ability to predict future events with perfect accuracy.', fr: "La capacité à prédire des événements futurs avec une précision parfaite." },
      { key: 'D', en: 'The capacity to understand and generate natural language.', fr: "La capacité de comprendre et générer du langage naturel." },
    ],
  },
  {
    id: 'q19', rubric: 'general', difficulty: 2, correct: 'D',
    q: {
      en: 'While reviewing a video of a well-known public figure making controversial statements, which characteristic confirms the video was NOT generated by AI?',
      fr: "En regardant une vidéo d'une personnalité publique connue qui tient des propos polémiques, quel élément peut confirmer que la vidéo n'est PAS générée par IA ?",
    },
    options: [
      { key: 'A', en: "The public figure's voice sounds like themselves.", fr: "La voix de la personnalité semble bien correspondre." },
      { key: 'B', en: 'The video has a professional and polished appearance.', fr: "La vidéo a une apparence professionnelle et lissée." },
      { key: 'C', en: 'The video is high-quality with smooth transitions.', fr: "La vidéo est de haute qualité et les transitions sont fluides." },
      { key: 'D', en: 'None of the above.', fr: "Aucune des affirmations précédentes." },
    ],
  },

  // ---------------- TECHNIQUE ----------------
  {
    id: 'q7', rubric: 'technique', difficulty: 1, correct: 'A',
    q: {
      en: 'What does the term "token" refer to in the context of a large language model (LLM)?',
      fr: 'À quoi le terme "token" fait-il référence dans le cas des grands modèles de langage ?',
    },
    options: [
      { key: 'A', en: 'A token is a unit of text, such as a word or a subword, that the model processes individually.', fr: "Un token est une unité de texte, comme un mot ou une partie de mot, que le modèle traite individuellement." },
      { key: 'B', en: 'A token is a unique identifier assigned to each user interacting with the language model.', fr: "Un token est un identifiant unique associé à chaque utilisateur qui interagit avec le modèle." },
      { key: 'C', en: 'A token is a security measure used to authenticate API requests to the language model.', fr: "Un token est une mesure de sécurité utilisée pour identifier les requêtes API au modèle." },
      { key: 'D', en: 'A token is a reward given to users for contributing valuable data to train the language model.', fr: "Un token est une récompense donnée à un utilisateur ayant contribué à fournir des données de qualité pour l'entraînement d'un modèle." },
    ],
  },
  {
    id: 'q5', rubric: 'technique', difficulty: 2, correct: 'C',
    q: {
      en: 'Which of the following is a potential challenge when using prompt-based development for text generation?',
      fr: "Quel problème peut-on rencontrer lorsque l'on veut créer de bons prompts ?",
    },
    options: [
      { key: 'A', en: 'The language model can only generate binary outputs.', fr: "Les modèles de langage ne génèrent que des réponses binaires." },
      { key: 'B', en: 'The need for extensive labelled data to train the model.', fr: "Le besoin d'un grand nombre de données étiquetées pour entraîner le modèle." },
      { key: 'C', en: 'Crafting a prompt that accurately captures the desired context and nuances.', fr: "Définir un prompt qui capture précisément le contexte désiré et les nuances." },
      { key: 'D', en: 'The requirement for complex feature engineering.', fr: "Le besoin de concevoir manuellement des caractéristiques complexes." },
    ],
  },
  {
    id: 'q11', rubric: 'technique', difficulty: 2, correct: 'D',
    q: {
      en: 'When you use generative AI to create revision sheets, which of the following strategies is least likely to be effective?',
      fr: "Quand vous utilisez l'IA générative pour créer des fiches de révision, quelle stratégie a le moins de chances d'être efficace ?",
    },
    options: [
      { key: 'A', en: 'Giving the AI information about your level.', fr: "Fournir à l'IA des informations sur votre niveau." },
      { key: 'B', en: 'Asking the AI to include specific concepts or knowledge.', fr: "Demander à l'IA d'inclure certains concepts/savoirs en particulier." },
      { key: 'C', en: 'Giving the AI your entire course.', fr: "Fournir à l'IA votre cours entier." },
      { key: 'D', en: 'Entering a very brief description of the task and not describing the technical concepts, so as not to exceed the context window (the maximum amount of information an AI can hold on to within a conversation).', fr: "Renseigner une description très succincte de la tâche et ne pas fournir de description des concepts techniques pour ne pas dépasser la fenêtre de contexte (quantité maximale d'informations qu'une IA peut retenir dans la conversation)." },
    ],
  },
  {
    id: 'q12', rubric: 'technique', difficulty: 2, correct: 'B',
    q: {
      en: 'Your school built a chatbot to answer various questions, but it regularly gives unsuitable information about timetables. What is the best strategy to fix this?',
      fr: "Votre établissement scolaire a développé un chatbot qui répond à diverses questions, mais il donne régulièrement des informations inadaptées par rapport aux emplois du temps. Quelle est la meilleure stratégie pour résoudre ce problème ?",
    },
    options: [
      { key: 'A', en: 'Set up a tool with which students can flag this unsuitable information when it appears.', fr: "Mettre en place un outil avec lequel les étudiants pourront signaler ces informations inadaptées lorsqu'elles se manifestent." },
      { key: 'B', en: "Schedule regular updates of the chatbot's training data to include the latest timetable changes.", fr: "Mettre en place des mises à jour régulières des données d'entraînement du chatbot pour inclure les dernières modifications des emplois du temps." },
      { key: 'C', en: 'Set up a system that escalates timetable questions to humans.', fr: "Mettre en place un système qui permet de faire remonter à des humains les questions concernant l'emploi du temps." },
      { key: 'D', en: "Evaluate the chatbot's performance to identify areas for improvement.", fr: "Évaluer les performances du chatbot pour identifier des axes d'amélioration." },
    ],
  },
  {
    id: 'q22', rubric: 'technique', difficulty: 2, correct: 'D',
    q: {
      en: 'In a hospital, an accurate AI that recommends treatments is not used by doctors because they feel they cannot tell how the AI reaches its recommendations. Which core issue does this illustrate?',
      fr: "Dans un hôpital, une IA spécialisée dans la recommandation de traitement n'est pas utilisée par les médecins parce qu'ils estiment ne pas pouvoir savoir comment l'IA aboutit à ses recommandations. Quel problème est illustré dans cet exemple ?",
    },
    options: [
      { key: 'A', en: 'The AI model uses obsolete training data.', fr: "Le modèle d'IA utilise des données d'entraînement obsolètes." },
      { key: 'B', en: 'The training dataset lacks sufficient diversity.', fr: "Les données d'entraînement manquent de diversité." },
      { key: 'C', en: 'The treatment recommendations are incorrect.', fr: "Les recommandations de traitement sont incorrectes." },
      { key: 'D', en: 'AI models behave as a black box (explainability problem).', fr: "Les modèles d'IA posent des problèmes d'explicabilité (boîte noire)." },
    ],
  },
  {
    id: 'q13', rubric: 'technique', difficulty: 3, correct: 'C',
    q: {
      en: 'You have a large dataset of emails and want to build an app that answers questions based on it. Which need is best served by using RAG (retrieval-augmented generation, i.e. generation augmented with external sources) in this situation?',
      fr: "Vous avez un grand jeu de données composé de mails et vous voulez construire une application qui réponde à des questions en se basant dessus. À quel besoin répond le mieux l'usage de RAG (génération augmentée par sources externes) dans cette situation ?",
    },
    options: [
      { key: 'A', en: 'You need to generate creative texts based on the email content.', fr: "Vous avez besoin de générer des textes créatifs basés sur le contenu des mails." },
      { key: 'B', en: 'You want the model to answer questions even if it has never seen similar ones before.', fr: "Vous voulez que le modèle soit capable de répondre à des questions même s'il n'en a jamais vu de similaires par le passé." },
      { key: 'C', en: 'You need answers to questions that require specific information from different parts of the email dataset.', fr: "Vous avez besoin de réponses à des questions qui nécessitent des informations spécifiques à différentes parties des mails du jeu de données." },
      { key: 'D', en: 'You want to reduce the size of the language model to save computational resources.', fr: "Vous souhaitez réduire la taille du modèle de langage pour économiser des ressources." },
    ],
  },
  {
    id: 'q4', rubric: 'technique', difficulty: 3, correct: 'B',
    q: {
      en: 'In the context of Generative AI, what is "zero-shot learning"?',
      fr: "Concernant les IA génératives, à quoi correspond le \"zero-shot learning\" ?",
    },
    options: [
      { key: 'A', en: 'Training a model without any data.', fr: "Entraîner un modèle sans données." },
      { key: 'B', en: 'The ability of a model to perform a task without any task-specific training.', fr: "La capacité d'un modèle à réaliser une tâche sans y avoir été spécifiquement entraîné." },
      { key: 'C', en: "A method of reducing the model's training time to zero.", fr: "Une méthode qui permet de réduire le temps d'entraînement à zéro." },
      { key: 'D', en: 'A technique for generating synthetic training data.', fr: "Une technique qui permet de générer des données d'entraînement artificielles." },
    ],
  },

  // ---------------- ETHIQUE ----------------
  {
    id: 'q24', rubric: 'ethique', difficulty: 1, correct: 'B',
    q: {
      en: 'Should we impose restrictions on the outputs of generative AI technologies?',
      fr: "Faut-il imposer des restrictions sur les contenus que peuvent générer les IA ?",
    },
    options: [
      { key: 'A', en: 'Yes, to reduce the computational resources required to run these technologies.', fr: "Oui, pour réduire la quantité de calculs nécessaire à l'exécution d'une tâche de génération." },
      { key: 'B', en: 'Yes, to prevent the dissemination of harmful or misleading content.', fr: "Oui, pour éviter la diffusion de contenus blessants ou malintentionnés." },
      { key: 'C', en: 'No, as it would hinder technological innovation and creativity.', fr: "Non, car cela restreindrait les innovations et la créativité." },
      { key: 'D', en: 'No, because users should have the freedom to access all generated content.', fr: "Non, car les utilisateurs doivent avoir la liberté de générer n'importe quel contenu." },
    ],
  },
  {
    id: 'qL1', rubric: 'ethique', difficulty: 1, correct: 'A',
    q: {
      en: 'What is the general objective of the European regulation on AI systems (AI Act 2024)?',
      fr: "Quel est l'objectif général du Règlement européen sur les systèmes d'IA (AI Act 2024) ?",
    },
    options: [
      { key: 'A', en: 'To frame AI so that it is safe, transparent and respectful of fundamental rights.', fr: "Encadrer l'IA afin qu'elle soit sûre, transparente et respectueuse des droits fondamentaux." },
      { key: 'B', en: 'To replace the General Data Protection Regulation (GDPR).', fr: "Remplacer le règlement général sur la protection des données (RGPD)." },
      { key: 'C', en: 'To ban all AI innovation in the European Union.', fr: "Interdire toute innovation en IA dans l'Union Européenne." },
      { key: 'D', en: 'To regulate only physical industrial robots.', fr: "Réglementer uniquement les robots physiques industriels." },
    ],
  },
  {
    id: 'q16', rubric: 'ethique', difficulty: 1, correct: 'C',
    q: {
      en: 'As a student using a large language model (LLM) to gather information for an assignment, how should you relate to the information it generates?',
      fr: "En tant qu'étudiant utilisant un grand modèle de langage (LLM) pour récolter des informations pour un devoir, comment devriez-vous vous rapporter aux informations que le modèle génère ?",
    },
    options: [
      { key: 'A', en: "The LLM's answers are always more trustworthy than anything on the internet, so you can use them without further checking.", fr: "La réponse d'un LLM sera toujours plus fiable que les informations trouvables sur internet, donc vous pouvez les utiliser sans plus de vérification." },
      { key: 'B', en: "The LLM's answers are generally more trustworthy than internet sources, but you should still verify them with other reliable sources.", fr: "Les réponses d'un LLM sont généralement plus fiables que les informations trouvables sur internet, mais vous devriez tout de même les vérifier avec d'autres sources fiables." },
      { key: 'C', en: "The LLM's answers are not necessarily more trustworthy than internet sources, and you should cross-check them with other credible references.", fr: "Les réponses d'un LLM ne sont pas nécessairement plus fiables que les informations trouvables sur internet, il faut les vérifier à partir d'autres sources fiables." },
      { key: 'D', en: "The LLM's answers are less trustworthy than internet sources because it relies on outdated information.", fr: "Les réponses d'un LLM sont moins fiables que les informations trouvables sur internet puisqu'elles reposent sur des informations dépassées." },
    ],
  },
  {
    id: 'q18', rubric: 'ethique', difficulty: 2, correct: 'C',
    q: {
      en: 'A generative AI produced a summary of a research paper stating: "the study found that increased screen time is directly correlated with decreased attention spans in children aged 8-12." Which step will make you the most confident in the result?',
      fr: "Une IA générative a réalisé un résumé d'un article scientifique déclarant : \"l'étude a trouvé qu'un temps d'écran prolongé est directement corrélé avec une baisse de l'attention chez les enfants de 8-12 ans.\" Quelle étape vous permettra d'être le plus sûr du résultat ?",
    },
    options: [
      { key: 'A', en: 'Accept the summary directly as accurate because AI tools are generally reliable.', fr: "Valider directement le résumé car les IA sont généralement fiables." },
      { key: 'B', en: "Ask the AI to provide more details about the study's methodology and results.", fr: "Demander à l'IA davantage de détails sur la méthode et les résultats de l'étude." },
      { key: 'C', en: 'Cross-check the summary with the original research paper.', fr: "Vérifier les informations avec l'article scientifique directement." },
      { key: 'D', en: 'Use another AI tool to generate a summary for comparison and evaluate the consistency between both.', fr: "Utiliser une autre IA pour générer un résumé afin de les comparer et de vérifier la cohérence entre les deux." },
    ],
  },
  {
    id: 'q21', rubric: 'ethique', difficulty: 2, correct: 'D',
    q: {
      en: 'When a generative AI system is used to screen job applications, what issue might arise concerning the quality and fairness of hiring decisions?',
      fr: "Lorsqu'un système d'IA générative est utilisé pour sélectionner des candidatures, quelle problématique probable concerne la qualité et l'impartialité des décisions de recrutement ?",
    },
    options: [
      { key: 'A', en: "The AI system cannot analyze applicants' unique achievements and extracurricular activities.", fr: "Le système d'IA n'a pas la capacité d'analyser les compétences uniques des candidats et les activités extrascolaires." },
      { key: 'B', en: 'The AI system could misinterpret minor formatting differences in resumes.', fr: "Le système d'IA peut mal interpréter les différences mineures de mise en forme dans les CV." },
      { key: 'C', en: 'The AI system might not effectively handle applications submitted in various languages.', fr: "Le système d'IA peut ne pas prendre en compte des candidatures soumises dans différentes langues." },
      { key: 'D', en: 'The AI system could reinforce existing biases found in historical hiring data.', fr: "Le système d'IA peut renforcer les biais présents dans les données de recrutement sur lesquelles il est entraîné." },
    ],
  },
  {
    id: 'q23', rubric: 'ethique', difficulty: 2, correct: 'A',
    q: {
      en: 'You generate an AI image to illustrate your slides for an oral presentation. Can this use raise copyright issues?',
      fr: "Vous générez une image par IA pour illustrer votre diaporama pour un oral. Est-ce que cet usage peut soulever des problématiques de droit d'auteur ?",
    },
    options: [
      { key: 'A', en: 'Yes, AI-generated images can draw on the style of artists whose works — though protected by copyright — were used to train the models.', fr: "Oui, les images générées par IA peuvent s'inspirer du style d'artistes dont les créations, pourtant protégées par le droit des créateurs, ont été utilisées pour entraîner les modèles." },
      { key: 'B', en: "Yes, and it is even always possible to trace back to the model's training data from the content it generates.", fr: "Oui, il est d'ailleurs toujours possible de remonter aux données d'entraînement du modèle à partir des productions qu'il génère." },
      { key: 'C', en: 'No, all the images used to train the AI are copyright-free.', fr: "Non, toutes les images qui ont servi à l'entraînement de l'IA sont libres de droit." },
      { key: 'D', en: 'No, AI outputs are original and cannot be considered counterfeits.', fr: "Non, les productions d'IA sont originales et ne peuvent pas être considérées comme des contrefaçons." },
    ],
  },
  {
    id: 'q25', rubric: 'ethique', difficulty: 2, correct: 'C',
    q: {
      en: 'Sending personal information to cloud-based generative AI tools has little privacy concern.',
      fr: "Partager des informations personnelles avec des IA génératives en ligne soulève peu de préoccupations en matière de confidentialité.",
    },
    options: [
      { key: 'A', en: 'True, as this information is encrypted using sophisticated algorithms during transmission.', fr: "Vrai, puisque ces informations sont cryptées grâce à des algorithmes sophistiqués lors de la transmission." },
      { key: 'B', en: 'True, as generative AI tools are black-box systems and cannot output personal information even if trained on it.', fr: "Vrai, puisque les IA génératives fonctionnent comme des boîtes noires qui ne peuvent pas générer des informations personnelles même si elles sont entraînées dessus." },
      { key: 'C', en: 'False, as generative AI tools train on unencrypted data and can output private information due to their probabilistic nature.', fr: "Faux, puisque les IA génératives sont entraînées sur des données non cryptées et peuvent les générer en réponse grâce à leur nature probabiliste." },
      { key: 'D', en: 'False, as advancements in quantum computing can easily decipher the encrypted data.', fr: "Faux, puisque les avancées concernant les ordinateurs quantiques peuvent facilement décrypter des données cryptées." },
    ],
  },
  {
    id: 'qL2', rubric: 'ethique', difficulty: 3, correct: 'B',
    q: {
      en: 'Which principle mainly structures the European regulation on AI systems (AI Act 2024)?',
      fr: "Quel principe structure principalement le Règlement européen sur les systèmes d'IA (AI Act 2024) ?",
    },
    options: [
      { key: 'A', en: 'A total ban on AI deployed for commercial purposes.', fr: "Une interdiction totale de l'IA déployée à des fins commerciales." },
      { key: 'B', en: 'Legal requirements according to risk levels per use case.', fr: "Des exigences légales selon les niveaux de risque par cas d'usage." },
      { key: 'C', en: 'Automatic authorisation of all open-source AI.', fr: "Une autorisation automatique de toutes les IA open source." },
      { key: 'D', en: 'Regulation limited to personal data.', fr: "Une réglementation limitée aux données personnelles." },
    ],
  },
];

// Rubric display order (shown to the participant up front).
const RUBRIC_ORDER = ['general', 'technique', 'ethique'];

module.exports = { RUBRICS, RUBRIC_ORDER, QUESTIONS };
