const IPC_DB = {
  "302": { title: "Murder",                  keywords: ["murder","killed","death","homicide"] },
  "304": { title: "Culpable Homicide",       keywords: ["culpable","homicide","manslaughter"] },
  "304A":{ title: "Death by Negligence",     keywords: ["negligence","accident","rash driving","road accident"] },
  "307": { title: "Attempt to Murder",       keywords: ["attempt","tried to kill","attacked","stabbed","shot"] },
  "323": { title: "Voluntarily Causing Hurt",keywords: ["hurt","hit","beaten","assaulted","punched","slapped"] },
  "324": { title: "Hurt by Dangerous Weapon",keywords: ["knife","weapon","rod","cut"] },
  "325": { title: "Grievous Hurt",           keywords: ["grievous","serious injury","fracture","broken"] },
  "354": { title: "Assault on Woman",        keywords: ["molest","outrage modesty","groped"] },
  "376": { title: "Rape",                    keywords: ["rape","sexual assault","forced","sexual violence"] },
  "379": { title: "Theft",                   keywords: ["theft","stolen","stole","missing","took"] },
  "380": { title: "Theft in Dwelling",       keywords: ["house theft","broke in","burglary"] },
  "392": { title: "Robbery",                 keywords: ["robbery","robbed","snatched","forcefully took"] },
  "395": { title: "Dacoity",                 keywords: ["dacoity","gang robbery","group attack"] },
  "406": { title: "Criminal Breach of Trust",keywords: ["breach of trust","misappropriation","entrusted"] },
  "420": { title: "Cheating",                keywords: ["cheated","fraud","deceived","fake","scam","duped"] },
  "427": { title: "Mischief / Damage",       keywords: ["damage","vandalism","destroyed","broke property"] },
  "498A":{ title: "Cruelty by Husband",      keywords: ["domestic violence","dowry","cruelty","husband"] },
  "506": { title: "Criminal Intimidation",   keywords: ["threatened","threat","intimidated","blackmailed"] },
  "509": { title: "Insult Modesty of Woman", keywords: ["eve teasing","catcall","lewd","gesture"] },
};

export function suggestIPCSections(description = "") {
  const lower = description.toLowerCase();
  return Object.entries(IPC_DB)
    .map(([sec, data]) => ({
      section: sec,
      title: data.title,
      matchScore: data.keywords.filter((k) => lower.includes(k)).length,
    }))
    .filter((s) => s.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function validateIPCSections(sections = []) {
  const valid   = sections.filter((s) => IPC_DB[s]);
  const invalid = sections.filter((s) => !IPC_DB[s]);
  return {
    isValid: invalid.length === 0,
    valid,
    invalid,
    summary: `${valid.length} valid, ${invalid.length} invalid`,
  };
}
