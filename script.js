const questionsData = [
  // Existing Personality Questions
  { text: "I follow rules and laws without question.", min: "Chaotic", max: "Lawful", tags: ["lawful", "order"] },
  { text: "I prefer to work alone rather than in a group.", min: "Team Player", max: "Loner", tags: ["independent", "solo"] },
  { text: "I act before I think.", min: "Cautious", max: "Impulsive", tags: ["impulsive", "reckless"] },
  { text: "Helping others is important to me.", min: "Selfish", max: "Altruistic", tags: ["good", "compassion"] },
  { text: "I enjoy being the center of attention.", min: "Reserved", max: "Charismatic", tags: ["social", "charm"] },
  { text: "I trust people easily.", min: "Cynical", max: "Trusting", tags: ["trust", "openness"] },
  { text: "I keep secrets well.", min: "Open", max: "Secretive", tags: ["secretive", "stealth"] },
  { text: "I enjoy solving puzzles and riddles.", min: "Uninterested", max: "Inquisitive", tags: ["intellect", "curiosity"] },
  { text: "I value tradition over innovation.", min: "Innovative", max: "Traditional", tags: ["tradition", "order"] },
  { text: "I get angry easily.", min: "Calm", max: "Hot-headed", tags: ["temper", "strength"] },
  { text: "I like exploring the unknown.", min: "Cautious", max: "Adventurous", tags: ["adventure", "exploration"] },
  { text: "I am loyal to my friends no matter what.", min: "Disloyal", max: "Loyal", tags: ["loyalty", "bond"] },

  // New Race-Determining Questions
  { text: "I am tolerant to other races and cultures.", min: "Proud/Insular", max: "Cosmopolitan", tags: ["race_human", "race_elf", "race_halfling"] },
  { text: "I am naturally nimble and quick on my feet.", min: "Clumsy", max: "Graceful", tags: ["race_elf", "race_halfling", "dexterity"] },
  { text: "I prefer caves and mountains to open fields.", min: "Open Spaces", max: "Underground/Mountain", tags: ["race_dwarf", "race_gnome"] },
  { text: "I am highly adaptable to new situations and environments.", min: "Rigid", max: "Flexible/Adaptable", tags: ["race_human", "race_half_elf"] },
  { text: "My ancestors' deeds (good or ill) weigh heavily on my mind.", min: "Carefree", max: "Ancestral Duty", tags: ["race_dwarf", "race_dragonborn", "race_tiefling"] },
  { text: "I feel a strong connection to nature and the wild.", min: "Urban", max: "Wild/Natural", tags: ["race_elf", "race_gnome", "race_half_orc"] },

  // New Religious/Magical Affinity Questions
  { text: "I believe in a higher power and try to live by its tenets.", min: "Atheist", max: "Devout", tags: ["religion", "divine"] },
  { text: "I would make a pact with a powerful entity for greater power.", min: "Never", max: "Absolutely", tags: ["pact", "warlock"] },
  { text: "Magic comes to me naturally, without much study.", min: "Study Needed", max: "Innate Gift", tags: ["innate_magic", "sorcerer"] }
];

const questionsDiv = document.getElementById("questions");
questionsData.forEach((q, index) => {
  const wrapper = document.createElement("div");
  wrapper.className = "question";
  const label = document.createElement("label");
  label.setAttribute("for", `q${index}`);
  label.textContent = `${index + 1}. ${q.text}`;
  wrapper.appendChild(label);
  const input = document.createElement("input");
  input.type = "range";
  input.min = "1";
  input.max = "5";
  input.value = "3"; // Default value
  input.step = "1";
  input.name = `q${index}`;
  input.id = `q${index}`;
  wrapper.appendChild(input);
  const sliderLabels = document.createElement("div");
  sliderLabels.className = "slider-labels";
  sliderLabels.innerHTML = `<span>${q.min}</span><span>${q.max}</span>`;
  wrapper.appendChild(sliderLabels);
  questionsDiv.appendChild(wrapper);
});

// --- API Calls & Data Storage ---
const DND_API_BASE = "http://localhost:3000/api/dnd-proxy/";
const BACKEND_API_BASE = "http://localhost:3000/api/"; // Your backend server URL for Ollama/PDF

let allRaces = [];
let allBackgrounds = [];
let allClasses = [];

const abilityScoresMap = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA"
};

// Store the last generated character's details for regenerating portrait
let lastGeneratedCharacter = null;

const generatePortraitButton = document.getElementById("generate-portrait-button");
const characterPortrait = document.getElementById("character-portrait");
const portraitStatus = document.getElementById("portrait-status");


/**
 * Fetches data from the D&D 5e API (via proxy).
 * @param {string} endpoint - The D&D API endpoint (e.g., "races", "classes/fighter").
 * @returns {Promise<Object|null>} The fetched data or null if an error occurred.
 */
async function fetchData(endpoint) {
  try {
    const res = await fetch(`${DND_API_BASE}${endpoint}`); // Use the proxy endpoint
    if (!res.ok) {
      console.error(`Network error fetching ${endpoint} from proxy: ${res.status} ${res.statusText}`);
      return null;
    }
    return res.json();
  } catch (error) {
    console.error(`Failed to fetch ${endpoint} from proxy:`, error);
    return null;
  }
}

/**
 * Calculates the D&D ability modifier from a given score.
 * @param {number} score - The ability score.
 * @returns {number} The ability modifier.
 */
function getAbilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Determines ability scores based on personality question responses.
 * This is a heuristic mapping, not a precise D&D rule.
 * @param {number[]} personalityScores - Array of scores from 1 to 5 for each question.
 * @returns {Object} An object with strength, dexterity, etc. scores.
 */
function determineAbilityScores(personalityScores) {
    let strScore = 0;
    let dexScore = 0;
    let conScore = 0;
    let intScore = 0;
    let wisScore = 0;
    let chaScore = 0;

    // Map personality scores to raw ability score points
    // Q1: Lawful/Chaotic (index 0)
    strScore += (6 - personalityScores[0]); // Chaotic can imply brute force
    wisScore += personalityScores[0]; // Lawful can imply wisdom/discipline

    // Q2: Team Player/Loner (index 1)
    chaScore += (6 - personalityScores[1]); // Loner implies less social char, Team Player implies more
    wisScore += personalityScores[1]; // Team Player can imply wisdom in cooperation

    // Q3: Cautious (1) / Impulsive (5) (index 2)
    dexScore += personalityScores[2]; // Impulsive -> higher Dex
    wisScore += (6 - personalityScores[2]); // Cautious -> higher Wis

    // Q4: Selfish (1) / Altruistic (5) (index 3)
    chaScore += personalityScores[3]; // Altruistic -> higher Charisma
    wisScore += personalityScores[3]; // Altruistic -> higher Wisdom

    // Q5: Reserved (1) / Charismatic (5) (index 4)
    chaScore += personalityScores[4]; // Charismatic -> higher Charisma

    // Q6: Cynical (1) / Trusting (5) (index 5)
    wisScore += personalityScores[5]; // Trusting -> higher Wisdom

    // Q7: Open (1) / Secretive (5) (index 6)
    dexScore += personalityScores[6]; // Secretive -> higher Dexterity

    // Q8: Uninterested (1) / Inquisitive (5) (index 7)
    intScore += personalityScores[7]; // Inquisitive -> higher Intelligence

    // Q9: Innovative (1) / Traditional (5) (index 8)
    intScore += (6 - personalityScores[8]); // Innovative -> higher Intelligence
    wisScore += personalityScores[8]; // Traditional -> higher Wisdom

    // Q10: Calm (1) / Hot-headed (5) (index 9)
    strScore += personalityScores[9]; // Hot-headed -> higher Strength
    conScore += personalityScores[9]; // Hot-headed implies resilience/constitution

    // Q11: Cautious (1) / Adventurous (5) (index 10)
    strScore += personalityScores[10]; // Adventurous -> higher Strength
    dexScore += personalityScores[10]; // Adventurous -> higher Dexterity
    conScore += personalityScores[10]; // Adventurous -> higher Constitution

    // Q12: Disloyal (1) / Loyal (5) (index 11)
    chaScore += personalityScores[11]; // Loyalty can be Charisma (leading) or Wisdom (conviction)
    wisScore += personalityScores[11];

    // Q13: Tolerance (index 12)
    chaScore += personalityScores[12]; // Cosmopolitan -> higher Charisma

    // Q14: Nimbleness (index 13)
    dexScore += personalityScores[13]; // Graceful -> higher Dexterity

    // Q15: Environment (index 14)
    conScore += personalityScores[14]; // Underground/Mountain -> higher Constitution (toughness)

    // Q16: Adaptability (index 15)
    intScore += personalityScores[15]; // Flexible/Adaptable -> higher Intelligence
    dexScore += personalityScores[15]; // Flexible/Adaptable -> higher Dexterity

    // Q17: Ancestral Duty (index 16)
    wisScore += personalityScores[16]; // Ancestral Duty -> higher Wisdom

    // Q18: Nature Connection (index 17)
    wisScore += personalityScores[17]; // Wild/Natural -> higher Wisdom

    // Q19: Devout (index 18)
    wisScore += personalityScores[18] * 2; // Devout -> strong Wisdom
    chaScore += personalityScores[18]; // Devout can also be charismatic

    // Q20: Pact (index 19)
    chaScore += personalityScores[19] * 2; // Pact willingness -> strong Charisma

    // Q21: Innate Magic (index 20)
    chaScore += personalityScores[20] * 2; // Innate magic -> strong Charisma


    // Function to map a raw aggregate score to a D&D ability score range (e.g., 3-18 or 8-15)
    const mapToAbilityScore = (value, inMin, inMax, outMin = 8, outMax = 15) => {
        if (inMax === inMin) return outMin;
        const scaled = (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
        return Math.round(Math.min(Math.max(scaled, outMin), outMax));
    };

    return {
        strength: mapToAbilityScore(strScore, 2, 15),
        dexterity: mapToAbilityScore(dexScore, 4, 25),
        constitution: mapToAbilityScore(conScore, 3, 15),
        intelligence: mapToAbilityScore(intScore, 3, 15),
        wisdom: mapToAbilityScore(wisScore, 7, 35),
        charisma: mapToAbilityScore(chaScore, 5, 25)
    };
}


/**
 * Determines the character's race based on personality question responses.
 * @param {number[]} personalityScores - Array of scores from 1 to 5 for each question.
 * @returns {string} The index of the recommended race (e.g., "human", "elf").
 */
function determineRace(personalityScores) {
    let raceScores = {
        human: 0, "half-elf": 0, "half-orc": 0, tiefling: 0, dragonborn: 0,
        elf: 0, dwarf: 0, halfling: 0, gnome: 0,
    };

    // Q13: Tolerance (Proud/Insular vs. Cosmopolitan)
    if (personalityScores[12] >= 4) { raceScores.human += 2; raceScores["half-elf"] += 2; raceScores.elf += 1; raceScores.halfling += 1; }
    if (personalityScores[12] <= 2) { raceScores.dwarf += 1; raceScores["half-orc"] += 1; raceScores.tiefling += 1; }

    // Q14: Nimbleness (Clumsy vs. Graceful)
    if (personalityScores[13] >= 4) { raceScores.elf += 2; raceScores.halfling += 2; raceScores["half-elf"] += 1; }

    // Q15: Environment (Open vs. Underground/Mountain)
    if (personalityScores[14] >= 4) { raceScores.dwarf += 2; raceScores.gnome += 2; }
    if (personalityScores[14] <= 2) { raceScores.elf += 1; raceScores.human += 1; raceScores.halfling += 1; }

    // Q16: Adaptability (Rigid vs. Flexible)
    if (personalityScores[15] >= 4) { raceScores.human += 2; raceScores["half-elf"] += 2; raceScores.halfling += 1; }
    if (personalityScores[15] <= 2) { raceScores.dwarf += 1; }

    // Q17: Ancestral Duty (Carefree vs. Ancestral Duty)
    if (personalityScores[16] >= 4) { raceScores.dwarf += 1; raceScores.dragonborn += 2; raceScores.tiefling += 2; }

    // Q18: Nature Connection (Urban vs. Wild/Natural)
    if (personalityScores[17] >= 4) { raceScores.elf += 2; raceScores.gnome += 1; raceScores["half-orc"] += 1; }

    let bestRace = "human";
    let maxScore = 0;

    const availableRaceIndices = allRaces.map(r => r.index);

    for (const race in raceScores) {
        if (raceScores[race] > maxScore && availableRaceIndices.includes(race)) {
            maxScore = raceScores[race];
            bestRace = race;
        }
    }
    return bestRace;
}

/**
 * Recommends a D&D class based on personality and derived ability scores.
 * @param {number[]} scores - Array of personality scores.
 * @param {Object} abilities - Object with derived ability scores.
 * @returns {string} The index of the recommended class (e.g., "fighter", "wizard").
 */
const recommendClass = (scores, abilities) => {
  const impulsive = scores[2];
  const altruistic = scores[3];
  const charismatic = scores[4];
  const inquisitive = scores[7];
  const traditional = scores[8];
  const adventurous = scores[10];
  const loyal = scores[11];
  const devout = scores[18];
  const pactWilling = scores[19];
  const innateMagic = scores[20];

  const str = abilities.strength;
  const dex = abilities.dexterity;
  const con = abilities.constitution;
  const int = abilities.intelligence;
  const wis = abilities.wisdom;
  const cha = abilities.charisma;

  if (devout >= 4 && (wis >= 14 || cha >= 14)) return "cleric";
  if (pactWilling >= 4 && cha >= 14) return "warlock";
  if (innateMagic >= 4 && cha >= 14) return "sorcerer";
  if (inquisitive >= 4 && int >= 14) return "wizard";
  if (scores[17] >= 4 && wis >= 14 && traditional <= 3) return "druid";
  if (charismatic >= 4 && inquisitive >= 3 && cha >= 14) return "bard";
  if (altruistic >= 4 && loyal >= 4 && str >= 13 && cha >= 13) return "paladin";
  if (impulsive >= 4 && adventurous >= 4 && str >= 14 && con >= 12) return "barbarian";
  if (scores[13] >= 4 && impulsive <= 3 && dex >= 14 && wis >= 14) return "monk";
  if (scores[1] >= 4 && scores[6] >= 4 && dex >= 14) return "rogue";
  if (adventurous >= 4 && scores[17] >= 3 && dex >= 13 && wis >= 13) return "ranger";
  if (str >= 14 || dex >= 14 || con >= 14) return "fighter";

  return "fighter";
};

/**
 * Calculates the proficiency bonus based on character level.
 * @param {number} level - The character's level.
 * @returns {number} The proficiency bonus.
 */
function getProficiencyBonus(level) {
  if (level >= 1 && level <= 4) return 2;
  if (level >= 5 && level <= 8) return 3;
  if (level >= 9 && level <= 12) return 4;
  if (level >= 13 && level <= 16) return 5;
  if (level >= 17 && level <= 20) return 6;
  return 0;
}

/**
 * Determines the character's alignment (Lawful/Chaotic, Good/Evil) from personality scores.
 * @param {number[]} personalityScores - Array of scores from 1 to 5 for each question.
 * @returns {string} The determined alignment (e.g., "Lawful Good", "True Neutral").
 */
function determineAlignment(personalityScores) {
  const lawfulChaoticScore = (personalityScores[0] + personalityScores[8]) / 2;

  let lawfulChaotic = "Neutral";
  if (lawfulChaoticScore >= 4) {
    lawfulChaotic = "Lawful";
  } else if (lawfulChaoticScore <= 2) {
    lawfulChaotic = "Chaotic";
  }

  const goodEvilScore = personalityScores[3];

  let goodEvil = "Neutral";
  if (goodEvilScore >= 4) {
    goodEvil = "Good";
  } else if (goodEvilScore <= 2) {
    goodEvil = "Evil";
  }

  if (lawfulChaotic === "Neutral" && goodEvil === "Neutral") {
    return "True Neutral";
  }

  return `${lawfulChaotic} ${goodEvil}`;
}

/**
 * Returns the minimum XP required for a given D&D 5e level.
 * @param {number} level - The character's level (1-5).
 * @returns {number} The experience points for that level.
 */
function getExperiencePointsForLevel(level) {
    switch (level) {
        case 1: return 0;
        case 2: return 300;
        case 3: return 900;
        case 4: return 2700;
        case 5: return 6500;
        default: return 0; // Should not happen with current level range
    }
}


/**
 * Initializes dropdowns and fetches all necessary API data on page load.
 */
async function initSelections() {
  const racesData = await fetchData("races"); // Fetch from proxy
  if (racesData && racesData.results) {
    allRaces = racesData.results;
  }

  const backgroundsData = await fetchData("backgrounds"); // Fetch from proxy
  if (backgroundsData && backgroundsData.results) {
    allBackgrounds = backgroundsData.results;
    const backgroundSelect = document.getElementById("background-select");
    allBackgrounds.forEach(bg => {
      const option = document.createElement("option");
      option.value = bg.index;
      option.textContent = bg.name;
      backgroundSelect.appendChild(option);
    });
  }

  const classesData = await fetchData("classes"); // Fetch from proxy
  if (classesData && classesData.results) {
    const classDetailPromises = classesData.results.map(cls => fetchData(`classes/${cls.index}`)); // Fetch from proxy
    const fetchedClassDetails = await Promise.all(classDetailPromises);
    allClasses = fetchedClassDetails.filter(detail => detail !== null);
  }
}


/**
 * Generates and displays a character portrait using Stable Diffusion.
 * @param {string} raceName - The character's race name.
 * @param {string} className - The character's class name.
 * @param {string} charName - The character's name.
 */
async function generateAndDisplayPortrait(raceName, className, charName) {
    characterPortrait.style.display = 'none';
    portraitStatus.textContent = "Generating portrait...";

    const prompt = `Fantasy portrait of a ${raceName} ${className}. High fantasy, detailed, digital art, character illustration, epic pose, dungeons and dragons style.`;
    console.log("Prompt for Stable Diffusion:", prompt); // Log Stable Diffusion prompt

    const stableDiffusionApiUrl = 'http://127.0.0.1:7860/sdapi/v1/txt2img';

    try {
        const response = await fetch(stableDiffusionApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                steps: 25,
                width: 512,
                height: 512,
                cfg_scale: 7,
                sampler_name: "Euler a",
            })
        });

        if (!response.ok) {
            throw new Error(`Stable Diffusion API error: ${response.status} ${response.statusText}. Check server logs or CORS configuration.`);
        }

        const data = await response.json();

        if (data.images && data.images.length > 0) {
            const base64Image = data.images[0];
            characterPortrait.src = `data:image/png;base64,${base64Image}`;
            characterPortrait.style.display = 'block';
            portraitStatus.textContent = "Portrait generated!";
            generatePortraitButton.textContent = "Regenerate Portrait"; // Update button text
        } else {
            portraitStatus.textContent = "No image returned by Stable Diffusion. Check prompt or API response.";
        }

    } catch (error) {
        console.error("Error generating portrait:", error);
        portraitStatus.textContent = `Failed to generate portrait: ${error.message}. (Is Stable Diffusion running? Check CORS.)`;
        if (error.message.includes("Failed to fetch")) {
            portraitStatus.textContent += " (Possible CORS issue or server not running)";
        }
    }
}


// --- Main Form Submission Handler ---
document.getElementById("question-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const level = parseInt(document.getElementById("level").value);
  const sliders = document.querySelectorAll("input[type='range']");
  const personalityScores = Array.from(sliders).map(slider => parseInt(slider.value));

  const initialAbilities = determineAbilityScores(personalityScores);
  const chosenRaceIndex = determineRace(personalityScores);
  const raceDetails = await fetchData(`races/${chosenRaceIndex}`);
  const alignment = determineAlignment(personalityScores);
  const selectedBackgroundIndex = document.getElementById("background-select").value;
  const backgroundDetails = await fetchData(`backgrounds/${selectedBackgroundIndex}`);
  const chosenClassIndex = recommendClass(personalityScores, initialAbilities);
  const classDetails = allClasses.find(c => c.index === chosenClassIndex);

  if (!classDetails) {
    alert("Could not determine class details. Please ensure API is accessible and try again.");
    return;
  }

  // --- Generate Name from Ollama ---
  let name = document.getElementById("name").value.trim();
  if (!name) { // Only generate if name field is empty
      const namePromptPayload = {
          race: raceDetails ? raceDetails.name : 'Unknown',
          charClass: classDetails ? classDetails.name : 'Unknown',
          alignment: alignment
      };
      console.log("Prompt for Ollama Name Generation:", namePromptPayload); // Log name generation prompt

      try {
          const nameResponse = await fetch(`${BACKEND_API_BASE}generate-name`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(namePromptPayload)
          });
          if (nameResponse.ok) {
              const nameData = await nameResponse.json();
              name = nameData.name;
              document.getElementById("name").value = name; // Populate name input field
          } else {
              console.error("Failed to generate name from backend. Using fallback.");
              name = randomName(); // Fallback to random name
          }
      } catch (error) {
          console.error("Error calling name generation backend:", error);
          name = randomName(); // Fallback to random name
      }
  }


  // --- Call Backend Ollama Endpoint for Stats, Spells, and Backstory/Personality ---
  const ollamaPayload = {
      name: name,
      level: level,
      race: raceDetails ? raceDetails.name : 'Unknown',
      charClass: classDetails ? classDetails.name : 'Unknown',
      alignment: alignment,
      personalityScores: personalityScores,
  };
  console.log("Payload for Ollama Backstory/Personality:", ollamaPayload); // Log backstory/personality payload

  const ollamaResponse = await fetch(`${BACKEND_API_BASE}ollama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload)
  });

  let ollamaData;
  if (ollamaResponse.ok) {
      ollamaData = await ollamaResponse.json();
  } else {
      console.error("Failed to get Ollama data from backend. Using fallbacks.");
      ollamaData = {
          stats: [
            { stat: 'STR', score: initialAbilities.strength },
            { stat: 'DEX', score: initialAbilities.dexterity },
            { stat: 'CON', score: initialAbilities.constitution },
            { stat: 'INT', score: initialAbilities.intelligence },
            { stat: 'WIS', score: initialAbilities.wisdom },
            { stat: 'CHA', score: initialAbilities.charisma },
          ],
          spells: [],
          backstory: "A generic adventurer's journey begins.",
          personality: { traits: "Friendly\nCurious", ideal: "Peace", bond: "My friends", flaw: "Naïve" }
      };
  }

  const finalAbilities = ollamaData.stats.reduce((acc, s) => {
      const key = s.stat.toLowerCase();
      acc[key] = s.score;
      return acc;
  }, {});
  const finalSpells = ollamaData.spells;
  const backstory = ollamaData.backstory;
  const personality = ollamaData.personality;

  // Store character data globally so "Regenerate Portrait" can use it
  lastGeneratedCharacter = {
      name, level,
      raceName: raceDetails ? raceDetails.name : "Unknown",
      className: classDetails ? classDetails.name : "Unknown",
      finalAbilities,
      ollamaStats: ollamaData.stats // Store the original stat array for PDF
  };

  // --- Character Sheet Calculations ---
  const proficiencyBonus = getProficiencyBonus(level);

  let hitPoints = 0;
  const conModifier = getAbilityModifier(finalAbilities.con);
  if (classDetails && classDetails.hit_die) {
      hitPoints = classDetails.hit_die + conModifier;
      for (let i = 2; i <= level; i++) {
          const averageRoll = Math.floor(classDetails.hit_die / 2) + 1;
          hitPoints += (averageRoll + conModifier);
      }
  } else {
      hitPoints = 'N/A';
  }
  if (typeof hitPoints === 'number' && hitPoints < 1) hitPoints = 1;

  let armorClass = 10 + getAbilityModifier(finalAbilities.dex);
  if (classDetails.index === "barbarian") {
    armorClass = 10 + getAbilityModifier(finalAbilities.dex) + getAbilityModifier(finalAbilities.con);
  } else if (classDetails.index === "monk") {
    armorClass = 10 + getAbilityModifier(finalAbilities.dex) + getAbilityModifier(finalAbilities.wis);
  }

  const initiative = getAbilityModifier(finalAbilities.dex);
  const speed = raceDetails ? raceDetails.speed : '30';

  const savingThrows = (classDetails && classDetails.saving_throws) ? classDetails.saving_throws.map(st => st.name).join(", ") : "None";

  let skillProficiencies = [];
  if (classDetails && classDetails.proficiencies) {
    classDetails.proficiencies.forEach(p => {
      if (p.name.startsWith("Skill: ")) {
        skillProficiencies.push(p.name.replace("Skill: ", ""));
      }
    });
  }
  if (backgroundDetails && backgroundDetails.starting_proficiencies) {
    backgroundDetails.starting_proficiencies.forEach(p => {
      if (p.name.startsWith("Skill: ") && !skillProficiencies.includes(p.name.replace("Skill: ", ""))) {
        skillProficiencies.push(p.name.replace("Skill: ", ""));
      }
      });
  }
  skillProficiencies = [...new Set(skillProficiencies)];

  let featuresText = '';
  const raceTraits = raceDetails && raceDetails.traits && raceDetails.traits.length > 0 ? raceDetails.traits.map(trait => `- ${trait.name}`).join("\n") : 'None';
  const backgroundFeature = backgroundDetails && backgroundDetails.feature ? `- ${backgroundDetails.feature.name}: ${backgroundDetails.feature.desc}` : 'None';
  let classFeatures = 'None';
  if (classDetails && classDetails.features) {
      const featuresAtLevel = classDetails.features.filter(f => f.level <= level);
      if (featuresAtLevel.length > 0) {
          classFeatures = featuresAtLevel.map(f => `- ${f.name}`).join("\n");
      }
  }
  featuresText = `Race Traits:\n${raceTraits}\n\nBackground Feature:\n${backgroundFeature}\n\nClass Features (Level ${level}):\n${classFeatures}`;


  const proficienciesAndLanguages = [
      (classDetails && classDetails.proficiencies ? classDetails.proficiencies.filter(p => !p.name.startsWith("Skill:") && !p.name.startsWith("Saving Throw:")).map(p => p.name).join(", ") : ''),
      (raceDetails && raceDetails.starting_proficiencies ? raceDetails.starting_proficiencies.map(p => p.name).join(", ") : ''),
      (backgroundDetails && backgroundDetails.starting_proficiencies ? backgroundDetails.starting_proficiencies.map(p => p.name).join(", ") : ''),
      (raceDetails && raceDetails.languages ? `Languages: ${raceDetails.languages.map(l => l.name).join(", ")}` : '')
  ].filter(Boolean).join('\n');

  const experiencePoints = getExperiencePointsForLevel(level);


  // Construct the display text for the webpage
  let sheetDisplay = `
========================
D&D 5e CHARACTER SHEET
========================
Name: ${name}
Level: ${level} (Proficiency Bonus: +${proficiencyBonus})
Race: ${raceDetails ? raceDetails.name : 'Unknown'}
Background: ${backgroundDetails ? backgroundDetails.name : 'Unknown'}
Class: ${classDetails ? classDetails.name : 'Unknown'}
Alignment: ${alignment}
Experience Points: ${experiencePoints}

--- COMBAT & STATS ---
Hit Points (HP): ${hitPoints}
Armor Class (AC): ${armorClass}
Initiative: ${initiative >= 0 ? '+' : ''}${initiative}
Speed: ${speed} ft

--- ABILITY SCORES ---
${Object.entries(finalAbilities).map(([scoreName, score]) => {
    const modifier = getAbilityModifier(score);
    return `${abilityScoresMap[scoreName]}: ${score} (${modifier >= 0 ? '+' : ''}${modifier})`;
}).join("\n")}

--- PROFICIENCIES & FEATURES ---
Hit Die: d${classDetails ? classDetails.hit_die : 'N/A'}
Saving Throws: ${savingThrows}
Skill Proficiencies: ${skillProficiencies.length > 0 ? skillProficiencies.join(", ") : 'None'}
Can Cast Spells: ${classDetails && classDetails.spellcasting ? "Yes" : "No"}

${featuresText}

Other Proficiencies & Languages:
${proficienciesAndLanguages || 'None'}

--- SPELLS KNOWN ---
${finalSpells.length > 0 ? finalSpells.map(s => `- ${s}`).join('\n') : 'None'}

--- PERSONALITY, IDEALS, BONDS, FLAWS ---
Personality Traits:
${personality.traits || 'None'}

Ideals:
${personality.ideal || 'None'}

Bonds:
${personality.bond || 'None'}

Flaws:
${personality.flaw || 'None'}

--- CHARACTER BACKSTORY ---
${backstory}
`;

  const display = document.getElementById("character-display");
  display.textContent = sheetDisplay;

  // Trigger portrait generation immediately after character sheet is created
  await generateAndDisplayPortrait(lastGeneratedCharacter.raceName, lastGeneratedCharacter.className, lastGeneratedCharacter.name);


  // --- PDF Download (via Backend) ---
  const downloadPdfButton = document.getElementById("download-pdf-button");
  if (downloadPdfButton) {
      downloadPdfButton.style.display = "block";
      downloadPdfButton.onclick = async () => {
          // Get portrait image data if available
          let portraitBase64 = '';
          if (characterPortrait.src && characterPortrait.style.display !== 'none' && characterPortrait.src.startsWith('data:image')) {
              portraitBase64 = characterPortrait.src.split(',')[1]; // Extract base64 part
          }

          const pdfPayload = {
              name, level,
              race: raceDetails ? raceDetails.name : 'Unknown',
              background: backgroundDetails ? backgroundDetails.name : 'Unknown',
              charClass: classDetails ? classDetails.name : 'Unknown',
              alignment,
              abilities: ollamaData.stats, // Use backend's generated stats for PDF
              hitPoints, armorClass, initiative, speed,
              savingThrows: savingThrows.split(', ').filter(Boolean), // Convert back to array
              skillProficiencies,
              features: featuresText,
              proficienciesAndLanguages,
              spells: finalSpells,
              personality: { traits: personality.traits, ideal: personality.ideal, bond: personality.bond, flaw: personality.flaw },
              backstory,
              portrait: portraitBase64,
              experiencePoints
          };
          console.log("Payload for PDF Generation:", pdfPayload); // Log PDF payload

          try {
              const pdfResponse = await fetch(`${BACKEND_API_BASE}pdf`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pdfPayload)
              });

              if (pdfResponse.ok) {
                  const blob = await pdfResponse.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${name}_Character_Sheet.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
              } else {
                  console.error("Failed to generate PDF from backend.");
                  alert("Failed to generate PDF. Check backend server logs.");
              }
          } catch (error) {
              console.error("Error sending data to PDF backend:", error);
              alert("Error generating PDF. Ensure your backend server is running.");
          }
      };
  }

  // --- TXT Download (Still client-side for simple text output) ---
  const blob = new Blob([sheetDisplay], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const dl = document.getElementById("download-link");
  dl.href = url;
  dl.style.display = "block";

});

// --- Stable Diffusion Portrait Generation ---
generatePortraitButton.addEventListener("click", async () => {
    if (lastGeneratedCharacter) {
        await generateAndDisplayPortrait(lastGeneratedCharacter.raceName, lastGeneratedCharacter.className, lastGeneratedCharacter.name);
    } else {
        portraitStatus.textContent = "Generate a character first to enable portrait regeneration!";
    }
});


// Initialize selections and fetch initial data when the page loads
initSelections();
