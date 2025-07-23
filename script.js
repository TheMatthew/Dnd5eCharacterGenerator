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
  { text: "I am always honest, even if it hurts someone's feelings.", min: "Diplomatic", max: "Blunt", tags: ["honest", "direct"] },
  { text: "I prefer to avoid conflict.", min: "Aggressive", max: "Peaceful", tags: ["peace", "calm"] },
  { text: "I am good at charming others.", min: "Awkward", max: "Charming", tags: ["charm", "persuasion"] },
  { text: "I put my personal goals above all else.", min: "Selfless", max: "Ambitious", tags: ["ambition", "selfish"] },
];

const alignmentMap = {
    'lawful': ['Lawful Good', 'Lawful Neutral', 'Lawful Evil'],
    'chaotic': ['Chaotic Good', 'Chaotic Neutral', 'Chaotic Evil'],
    'good': ['Lawful Good', 'Neutral Good', 'Chaotic Good'],
    'evil': ['Lawful Evil', 'Neutral Evil', 'Chaotic Evil'],
    'neutral': ['Neutral Good', 'True Neutral', 'Neutral Evil'],
    // Combined for personality traits
    'independent': ['Loner'], 'solo': ['Loner'],
    'impulsive': ['Impulsive'], 'reckless': ['Impulsive'],
    'compassion': ['Altruistic'],
    'social': ['Charismatic'], 'charm': ['Charismatic'],
    'trust': ['Trusting'], 'openness': ['Trusting'],
    'secretive': ['Secretive'], 'stealth': ['Secretive'],
    'intellect': ['Inquisitive'], 'curiosity': ['Inquisitive'],
    'tradition': ['Traditional'], 'order': ['Traditional'],
    'temper': ['Hot-headed'], 'strength': ['Hot-headed'],
    'adventure': ['Adventurous'], 'exploration': ['Adventurous'],
    'honest': ['Blunt'], 'direct': ['Blunt'],
    'peace': ['Peaceful'], 'calm': ['Peaceful'],
    'ambition': ['Ambitious'], 'selfish': ['Ambitious'],
};

// Function to generate a random name (simple placeholder)
function randomName() {
    const names = ["Anya", "Borin", "Caelen", "Elara", "Finn", "Gareth", "Lyra", "Orin", "Seraphina", "Thorne"];
    return names[Math.floor(Math.random() * names.length)];
}

// Global variable to store the last generated character data for PDF generation
let lastGeneratedCharacter = null;

// DOM Elements
const questionsDiv = document.getElementById("questions");
const characterDisplay = document.getElementById("character-display");
const downloadLink = document.getElementById("download-link");
const downloadPdfButton = document.getElementById("download-pdf-button");
const generatePortraitButton = document.getElementById("generate-portrait-button"); // Keep for hiding
const characterPortrait = document.getElementById("character-portrait");
const portraitStatus = document.getElementById("portrait-status");
const nameInput = document.getElementById("name");
const levelSelect = document.getElementById("level");
const backgroundSelect = document.getElementById("background-select");
const genderInput = document.getElementById("gender");


// Function to render personality questions
function renderQuestions() {
  questionsDiv.innerHTML = "";
  questionsData.forEach((q, index) => {
    const questionEl = document.createElement("div");
    questionEl.classList.add("question");
    questionEl.innerHTML = `
      <label for="q${index}">${q.text}</label>
      <input type="range" id="q${index}" min="1" max="5" value="3">
      <div class="slider-labels">
        <span>${q.min}</span>
        <span>${q.max}</span>
      </div>
    `;
    questionsDiv.appendChild(questionEl);
  });
}

// Function to fetch D&D Beyond API data (proxied through server.js)
async function fetchDndApi(path) {
  try {
    const response = await fetch(`/api/dnd-proxy/${path}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching D&D API:", error);
    return null;
  }
}

async function initSelections() {
  // Populate Backgrounds
  const backgrounds = await fetchDndApi("backgrounds");
  if (backgrounds && backgrounds.results) {
    backgroundSelect.innerHTML = backgrounds.results
      .map(bg => `<option value="${bg.index}">${bg.name}</option>`)
      .join("");
  } else {
    backgroundSelect.innerHTML = `<option value="">Could not load backgrounds</option>`;
  }

  renderQuestions();
}

function calculateAverageScore(scores, tag) {
    let total = 0;
    let count = 0;
    questionsData.forEach((q, i) => {
        if (q.tags.includes(tag)) {
            total += scores[i];
            count++;
        }
    });
    return count > 0 ? total / count : 0;
}

function recommendClass(scores) {
  // Dummy class recommendation based on high scores in certain "tags"
  // This is a simplified example and can be expanded with more logic.
  // Assuming scores are 1-5, with 5 being max.

  const intelligenceScore = calculateAverageScore(scores, 'intellect');
  const charismaScore = calculateAverageScore(scores, 'charm') + calculateAverageScore(scores, 'social'); // Combine for broader charisma
  const strengthScore = calculateAverageScore(scores, 'strength');
  const dexterityScore = calculateAverageScore(scores, 'stealth'); // Using stealth as a proxy for dexterity focus
  const wisdomScore = calculateAverageScore(scores, 'trust'); // Using trust as a proxy for wisdom focus

  // Simple heuristic for class recommendation
  if (intelligenceScore >= 3.5) return 'Wizard';
  if (charismaScore >= 3.5) return 'Bard';
  if (strengthScore >= 3.5) return 'Fighter';
  if (dexterityScore >= 3.5) return 'Rogue';
  if (wisdomScore >= 3.5) return 'Cleric';

  // Fallback to a versatile class or lowest score class
  const classOptions = [
      { name: 'Fighter', score: strengthScore },
      { name: 'Rogue', score: dexterityScore },
      { name: 'Wizard', score: intelligenceScore },
      { name: 'Bard', score: charismaScore },
      { name: 'Cleric', score: wisdomScore }
  ];
  classOptions.sort((a, b) => b.score - a.score); // Sort by highest score first
  return classOptions[0].name; // Return the class with the highest relevant score
}

function recommendRace(scores) {
    const intelligenceScore = calculateAverageScore(scores, 'intellect');
    const dexterityScore = calculateAverageScore(scores, 'stealth');
    const strengthScore = calculateAverageScore(scores, 'strength');
    const charismaScore = calculateAverageScore(scores, 'charm');

    if (intelligenceScore > 3.5) return 'Elf';
    if (dexterityScore > 3.5) return 'Halfling';
    if (strengthScore > 3.5) return 'Dwarf';
    if (charismaScore > 3.5) return 'Half-Elf';
    return 'Human'; // Default
}

function recommendAlignment(scores) {
    const lawfulScore = calculateAverageScore(scores, 'lawful');
    const chaoticScore = calculateAverageScore(scores, 'chaotic');
    const goodScore = calculateAverageScore(scores, 'good');
    const evilScore = calculateAverageScore(scores, 'evil');

    let alignment = '';
    if (lawfulScore > chaoticScore && lawfulScore > 3) {
        alignment += 'Lawful ';
    } else if (chaoticScore > lawfulScore && chaoticScore > 3) {
        alignment += 'Chaotic ';
    } else {
        alignment += 'Neutral ';
    }

    if (goodScore > evilScore && goodScore > 3) {
        alignment += 'Good';
    } else if (evilScore > goodScore && evilScore > 3) {
        alignment += 'Evil';
    } else {
        alignment += 'Neutral';
    }
    return alignment.trim();
}

async function getClassDetails(className) {
  try {
    const data = await fetchDndApi(`classes/${className.toLowerCase()}`);
    return {
      hit_die: data.hit_die,
      proficiencies: data.proficiencies.map((p) => p.name).join(", "),
      spellcasting: data.spellcasting ? "Yes" : "No",
    };
  } catch {
    return { hit_die: "Unknown", proficiencies: "Unknown", spellcasting: "Unknown" };
  }
}

document.getElementById("question-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    portraitStatus.textContent = ""; // Clear portrait status on new generation
    characterPortrait.style.display = "none"; // Hide previous portrait

    const name = nameInput.value.trim(); // Will be auto-generated if empty
    const level = parseInt(levelSelect.value);
    const background = backgroundSelect.value;
    const gender = genderInput.value.trim();


    const sliders = document.querySelectorAll("input[type='range']");
    const scores = Array.from(sliders).map(slider => parseInt(slider.value));

    const recommendedClass = recommendClass(scores);
    const recommendedRace = recommendRace(scores);
    const recommendedAlignment = recommendAlignment(scores);
    const experiencePoints = 0; // Starting XP

    // Placeholder until actual abilities, proficiencies, features are fetched/generated
    const placeholderAbilities = [
        { stat: 'STR', score: 10 }, { stat: 'DEX', score: 10 },
        { stat: 'CON', score: 10 }, { stat: 'INT', score: 10 },
        { stat: 'WIS', score: 10 }, { stat: 'CHA', score: 10 }
    ];
    const placeholderSavingThrows = ['Strength', 'Dexterity'];
    const placeholderSkillProficiencies = ['Acrobatics', 'Stealth'];
    const placeholderFeatures = 'Basic class features.';
    const placeholderProficienciesAndLanguages = 'Common, one other language.';
    const placeholderHitPoints = 10 + Math.floor(Math.random() * 5); // Simple placeholder
    const placeholderArmorClass = 10;
    const placeholderInitiative = 0;
    const placeholderSpeed = 30;

    try {
        // --- Generate Name (if not provided) ---
        let finalName = name;
        if (!finalName) {
            portraitStatus.textContent = "Generating name...";
            const nameResponse = await fetch('/api/generate-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    race: recommendedRace,
                    charClass: recommendedClass,
                    alignment: recommendedAlignment
                })
            });
            const nameData = await nameResponse.json();
            if (nameData.name) {
                finalName = nameData.name;
                nameInput.value = finalName; // Update UI with generated name
            } else {
                finalName = randomName(); // Fallback to random client-side name
                nameInput.value = finalName;
                console.warn("Failed to generate name with Ollama, falling back to random local name.");
            }
        }

        // --- Generate Backstory and Personality with Ollama ---
        portraitStatus.textContent = "Generating backstory and personality...";
        const ollamaResponse = await fetch('/api/ollama', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: finalName,
                level: level,
                race: recommendedRace,
                charClass: recommendedClass,
                alignment: recommendedAlignment,
                personalityScores: scores // Send raw scores to backend if needed for deeper personality logic
            })
        });
        const ollamaData = await ollamaResponse.json();

        if (ollamaData.error) {
            alert(ollamaData.error);
            console.error("Ollama backend error:", ollamaData.error);
            portraitStatus.textContent = "Character generation failed. See console for details.";
            return; // Stop execution if backend failed
        }

        const characterData = {
            name: finalName,
            level: level,
            race: recommendedRace,
            background: background,
            charClass: recommendedClass,
            alignment: recommendedAlignment,
            abilities: ollamaData.stats || placeholderAbilities, // Use generated stats
            hitPoints: placeholderHitPoints,
            armorClass: placeholderArmorClass,
            initiative: placeholderInitiative,
            speed: placeholderSpeed,
            savingThrows: placeholderSavingThrows,
            skillProficiencies: placeholderSkillProficiencies,
            features: placeholderFeatures,
            proficienciesAndLanguages: placeholderProficienciesAndLanguages,
            spells: ollamaData.spells || [], // Use generated spells
            personality: ollamaData.personality, // Use generated personality
            backstory: ollamaData.backstory, // Use generated backstory
            experiencePoints: experiencePoints,
            portrait: null // Will be populated in the next step
        };

        // --- Generate Portrait with Stable Diffusion (integrated here) ---
        portraitStatus.textContent = "Generating portrait... (This might take a while)";
        characterPortrait.style.display = "none"; // Ensure it's hidden before new image loads

        const portraitResponse = await fetch('/api/generate-portrait', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                race: characterData.race,
                charClass: characterData.charClass,
                name: characterData.name,
                gender: gender // Use gender from input
            })
        });

        if (!portraitResponse.ok) {
            const errorData = await portraitResponse.json();
            throw new Error(errorData.error || `HTTP error! status: ${portraitResponse.status}`);
        }

        const portraitData = await portraitResponse.json();
        if (portraitData.image) {
            characterPortrait.src = `data:image/png;base64,${portraitData.image}`;
            characterPortrait.style.display = "block";
            portraitStatus.textContent = "Character and portrait generated successfully!";
            characterData.portrait = portraitData.image; // Store portrait for PDF
        } else {
            portraitStatus.textContent = "Portrait generation failed: No image data returned.";
            console.error("Server response did not contain image data:", portraitData);
            characterPortrait.style.display = "none";
        }

        // Update lastGeneratedCharacter with full data for PDF
        lastGeneratedCharacter = characterData;


        // --- Display Character Sheet ---
        let sheetDisplay = `
========================
D&D CHARACTER SHEET
========================
Name: ${characterData.name}
Level: ${characterData.level}
Race: ${characterData.race}
Class: ${characterData.charClass}
Alignment: ${characterData.alignment}
Background: ${characterData.background}
Experience Points: ${characterData.experiencePoints}

------------------------
ABILITIES
------------------------
${characterData.abilities.map(a => `${a.stat}: ${a.score} (Mod: ${Math.floor((a.score - 10) / 2) >= 0 ? '+' : ''}${Math.floor((a.score - 10) / 2)})`).join('\n')}

------------------------
COMBAT
------------------------
Hit Points: ${characterData.hitPoints}
Armor Class: ${characterData.armorClass}
Initiative: ${characterData.initiative >= 0 ? '+' : ''}${characterData.initiative}
Speed: ${characterData.speed} ft.

------------------------
PROFICIENCIES & FEATURES
------------------------
Saving Throws: ${characterData.savingThrows.join(', ')}
Skill Proficiencies: ${characterData.skillProficiencies.join(', ')}
Features & Traits: ${characterData.features}
Other Proficiencies & Languages: ${characterData.proficienciesAndLanguages}

------------------------
SPELLS
------------------------
Spells Known: ${characterData.spells.length > 0 ? characterData.spells.join(', ') : 'None'}

------------------------
PERSONALITY
------------------------
Personality Traits:
${characterData.personality.traits}

Ideal: ${characterData.personality.ideal}
Bond: ${characterData.personality.bond}
Flaw: ${characterData.personality.flaw}

------------------------
BACKSTORY
------------------------
${characterData.backstory}
`;

        characterDisplay.textContent = sheetDisplay;
        downloadLink.style.display = "block"; // Show TXT download link
        downloadPdfButton.style.display = "block"; // Show PDF download button
        generatePortraitButton.style.display = "none"; // Hide this button as generation is automatic


    } catch (error) {
        console.error("Error generating character or portrait:", error);
        characterDisplay.textContent = `Error generating character: ${error.message}. Check console for details.`;
        portraitStatus.textContent = `Character/Portrait generation failed: ${error.message}.`;
        downloadLink.style.display = "none";
        downloadPdfButton.style.display = "none";
        generatePortraitButton.style.display = "none";
        characterPortrait.style.display = "none";
    }
});


// --- PDF Download (Now sends character data to backend) ---
downloadPdfButton.addEventListener('click', async () => {
    if (!lastGeneratedCharacter) {
        alert("Please generate a character first!");
        return;
    }

    // Prepare data for PDF generation on the backend
    const dataToSend = { ...lastGeneratedCharacter };
    // The portrait data (base64) should already be in lastGeneratedCharacter if generated.

    try {
        const response = await fetch('/api/pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend),
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${lastGeneratedCharacter.name}_Character_Sheet.pdf`;
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
});


// --- TXT Download (Still client-side for simple text output) ---
// This part remains mostly the same, it downloads the content of characterDisplay
// Ensure the sheetDisplay variable is correctly populated in the character generation
// listener for this to work.


// Initialize selections and fetch initial data when the page loads
initSelections();
