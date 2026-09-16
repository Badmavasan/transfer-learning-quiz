// Lycée tracks, used by the "about you" screen when the participant answers "Lycée".
// Keys are stable identifiers (stored in `info`); labels are bilingual.
window.LYCEE = {
  // "Quelle est votre filière ?"
  filieres: [
    { key: 'generale', en: 'General', fr: 'Générale' },
    { key: 'technologique', en: 'Technological', fr: 'Technologique' },
  ],

  // Générale, "Niveau (cocher)". `picks` = number of spécialités to tick that year.
  niveaux: [
    { key: 'seconde', picks: 0, en: '2nde (no speciality yet)', fr: '2nde' },
    { key: 'premiere', picks: 3, en: '1ère (3 specialities)', fr: '1ère' },
    { key: 'terminale', picks: 2, en: 'Terminale (2 specialities)', fr: 'Terminale' },
  ],

  // Générale, "Quelles sont vos spécialités (cocher) ?"
  specialites: [
    { key: 'hggsp', en: 'History-Geography, Geopolitics and Political Science (HGGSP)', fr: 'Histoire-Géographie, Géopolitique et Sciences politiques (HGGSP)' },
    { key: 'hlp', en: 'Humanities, Literature and Philosophy', fr: 'Humanités, Littérature et Philosophie' },
    { key: 'llcer', en: 'Foreign Languages, Literatures and Cultures (LLCER)', fr: 'Langues, Littératures et Cultures Étrangères (LLCER)' },
    { key: 'llca', en: 'Literature, Languages and Cultures of Antiquity', fr: "Littérature, Langues et Cultures de l'Antiquité" },
    { key: 'maths', en: 'Mathematics', fr: 'Mathématiques' },
    { key: 'nsi', en: 'Digital Technology and Computer Science (NSI)', fr: 'Numérique et Sciences Informatiques' },
    { key: 'svt', en: 'Earth and Life Sciences (SVT)', fr: 'Sciences et vie de la Terre (SVT)' },
    { key: 'si', en: 'Engineering Sciences', fr: "Sciences de l'ingénieur" },
    { key: 'ses', en: 'Economics and Social Sciences (SES)', fr: 'Sciences économiques et sociales (SES)' },
    { key: 'pc', en: 'Physics-Chemistry', fr: 'Physique Chimie' },
    { key: 'arts', en: 'Arts (art history, theatre, visual arts, performing arts…)', fr: 'Arts (Histoire des arts, Théâtre, Arts Plastiques, Arts du Spectacle…)' },
    { key: 'bioeco', en: 'Biology-Ecology (agricultural lycée)', fr: 'Biologie écologie (lycée agricole)' },
    { key: 'eppcs', en: 'Physical Education, Sport Practices and Culture', fr: 'Éducation physique, pratiques et culture sportives' },
  ],

  // Technologique, "Quelle est votre série (cocher) ?"
  series: [
    { key: 'stmg', en: 'STMG, Management and Business Science and Technology', fr: 'STMG, Sciences et technologies du management et de la gestion' },
    { key: 'st2s', en: 'ST2S, Health and Social Science and Technology', fr: 'ST2S, Sciences et technologies de la santé et du social' },
    { key: 'sthr', en: 'STHR, Hospitality and Catering Science and Technology', fr: "STHR, Sciences et technologies de l'hôtellerie et de la restauration" },
    { key: 'sti2d', en: 'STI2D, Industrial and Sustainable Development Science and Technology', fr: "STI2D, Sciences et technologies de l'industrie et du développement durable" },
    { key: 's2tmd', en: 'S2TMD, Theatre, Music and Dance Science and Technique', fr: 'S2TMD, Sciences et techniques du théâtre, de la musique et de la danse' },
    { key: 'stl', en: 'STL, Laboratory Science and Technology', fr: 'STL, Sciences et technologies de laboratoire' },
    { key: 'std2a', en: 'STD2A, Design and Applied Arts Science and Technology', fr: 'STD2A, Sciences et technologies du design et des arts appliqués' },
    { key: 'stav', en: 'STAV, Agronomy and Living World Science and Technology', fr: "STAV, Sciences et technologies de l'agronomie et du vivant" },
  ],
};
