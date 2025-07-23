const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os'); // Import the OS module for network interfaces

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// --- Configuration Parameters ---
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const STABLE_DIFFUSION_BASE_URL = process.env.STABLE_DIFFUSION_BASE_URL || 'http://127.0.0.1:7860';
const CACHE_DURATION = 24 * 60 * 60 * 1000 * 30; // 30 days in milliseconds
// --- End Configuration Parameters ---


// Serve static files (like script.js, style.css) from the current directory
app.use(express.static(__dirname));

// Serve index.html when the root URL is accessed
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Cache Configuration ---
const CACHE_DIR = path.join(__dirname, 'dnd_api_cache');
const DND_API_BASE_URL = "https://www.dnd5eapi.co/api/"; // Original D&D API URL

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

/**
 * Caching utility function.
 * @param {string} key - The unique key for the cache entry (e.g., 'races', 'classes_fighter').
 * @param {Function} fetcher - An async function that fetches the data if not in cache.
 * @returns {Promise<Object>} The cached or newly fetched data.
 */
async function getOrSetCache(key, fetcher) {
    const filePath = path.join(CACHE_DIR, `${key}.json`);

    try {
        // Check if cache file exists and is still valid
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const now = new Date().getTime();
            const lastModified = new Date(stats.mtime).getTime();

            if (now - lastModified < CACHE_DURATION) {
                console.log(`[Cache] Serving from cache: ${key}`);
                const cachedData = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(cachedData);
            } else {
                console.log(`[Cache] Cache expired for: ${key}`);
            }
        }
    } catch (readError) {
        console.error(`[Cache] Error reading cache for ${key}:`, readError);
        // Fall through to fetch new data if cache read fails
    }

    // Fetch new data if not in cache or expired
    console.log(`[Cache] Fetching new data for: ${key}`);
    const data = await fetcher();
    try {
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
        console.log(`[Cache] Data cached for: ${key}`);
    } catch (writeError) {
        console.error(`[Cache] Error writing cache for ${key}:`, writeError);
    }
    return data;
}

// --- D&D API Caching Proxy Endpoint ---
app.get('/api/dnd-proxy/*', async (req, res) => {
    const apiPath = req.params[0];
    const cacheKey = apiPath.replace(/\//g, '_');

    try {
        const data = await getOrSetCache(cacheKey, async () => {
            const response = await fetch(`${DND_API_BASE_URL}${apiPath}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch from D&D API: ${response.status} ${response.statusText}`);
            }
            return response.json();
        });
        res.json(data);
    } catch (error) {
        console.error(`Error in D&D proxy for ${apiPath}:`, error);
        res.status(500).json({ error: 'Failed to fetch data from D&D API proxy.' });
    }
});


// Helper to calculate ability modifier
function getAbilityModifier(score) {
    return Math.floor((score - 10) / 2);
}

// Function to generate 4d6 drop lowest stats (can be moved to client if preferred)
function generateStats() {
  return ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => {
    let rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => a - b);
    const score = rolls.slice(1).reduce((a, b) => a + b, 0);
    return { stat, score };
  });
}

// Sample spells (for basic character generation, can be expanded via D&D API)
function getSampleSpells(charClass, level) {
    const classSpells = {
        'wizard': {
            1: ["Magic Missile", "Shield", "Burning Hands"],
            2: ["Mirror Image", "Misty Step", "Hold Person"],
            3: ["Fireball", "Counterspell", "Fly"]
        },
        'cleric': {
            1: ["Cure Wounds", "Bless", "Guiding Bolt"],
            2: ["Spiritual Weapon", "Hold Person"],
            3: ["Spirit Guardians", "Revivify"]
        },
        'sorcerer': {
            1: ["Chromatic Orb", "Shield", "Burning Hands"],
            2: ["Suggestion", "Web"],
            3: ["Fireball", "Haste"]
        },
        'bard': {
            1: ["Healing Word", "Dissonant Whispers"],
            2: ["Blindness/Deafness", "Shatter"],
            3: ["Hypnotic Pattern", "Fear"]
        },
        'warlock': {
            1: ["Eldritch Blast", "Hex"],
            2: ["Misty Step", "Darkness"],
            3: ["Fly", "Counterspell"]
        }
    };
    return classSpells[charClass.toLowerCase()] ? classSpells[charClass.toLowerCase()][level] || [] : [];
}

// Ollama endpoint for name generation
app.post('/api/generate-name', async (req, res) => {
    const { race, charClass, alignment } = req.body;

    const prompt = `Generate a single, appropriate fantasy character name for a ${race} ${charClass} with a ${alignment} alignment. Respond with ONLY the name, no other text or punctuation.`;

    try {
        const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false
            })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText}`);
        }

        const data = await ollamaResponse.json();
        const generatedName = data.response ? data.response.trim().replace(/['"\.\s]*$/, '') : null;

        if (generatedName) {
            res.json({ name: generatedName });
        } else {
            res.status(500).json({ error: 'Failed to generate name from Ollama.' });
        }

    } catch (error) {
        console.error("Error generating name with Ollama:", error);
        res.status(500).json({ error: 'Failed to generate name from Ollama. Is Ollama running and accessible at ' + OLLAMA_BASE_URL + '?' });
    }
});


// Ollama Integration Endpoint for Backstory and Personality
app.post('/api/ollama', async (req, res) => {
  const { name, level, race, charClass, alignment, personalityScores } = req.body;

  const stats = generateStats();
  const spells = getSampleSpells(charClass, level);

  const basicContext = `Name: ${name}, Level: ${level}, Race: ${race}, Class: ${charClass}, Alignment: ${alignment}.`;

  let backstoryPrompt = `Generate a concise D&D character backstory (around 100-150 words) for a ${race} ${charClass}. ${basicContext} Emphasize their origins, a key event that led them to adventure, and how their alignment (${alignment}) manifests.`;
  let personalityPrompt = `Based on the following D&D character details, generate 3 unique personality traits, 1 strong ideal, 1 personal bond, and 1 significant flaw. Do NOT include a backstory. Format them clearly as "Personality Trait: [text]", "Ideal: [text]", "Bond: [text]", "Flaw: [text]". Details: ${basicContext} Consider their ${alignment} alignment.`;

  try {
    const [backstoryResponse, personalityResponse] = await Promise.all([
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: backstoryPrompt,
          stream: false
        })
      }),
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: personalityPrompt,
          stream: false
        })
      })
    ]);

    const backstoryData = await backstoryResponse.json();
    const personalityData = await personalityResponse.json();

    const backstory = backstoryData.response || "A mysterious adventurer begins their journey...";
    const personalityText = personalityData.response || "Personality Trait: Determined\nIdeal: Justice\nBond: Family\nFlaw: Arrogant";

    let traits = [];
    let ideal = "";
    let bond = "";
    let flaw = "";

    const lines = personalityText.split('\n').filter(line => line.trim() !== '');
    lines.forEach(line => {
        if (line.startsWith("Personality Trait:")) {
            traits.push(line.replace("Personality Trait:", "").trim());
        } else if (line.startsWith("Ideal:")) {
            ideal = line.replace("Ideal:", "").trim();
        } else if (line.startsWith("Bond:")) {
            bond = line.replace("Bond:", "").trim();
        } else if (line.startsWith("Flaw:")) {
            flaw = line.replace("Flaw:", "").trim();
        }
    });

    if (traits.length === 0) traits = ["Brave", "Curious"];
    if (!ideal) ideal = "To protect the innocent.";
    if (!bond) bond = "My sacred oath.";
    if (!flaw) flaw = "Overly trusting.";


    res.json({
        stats,
        spells,
        backstory,
        personality: { traits: traits.join('\n'), ideal, bond, flaw }
    });

  } catch (error) {
    console.error(`Failed to get Ollama response:`, error);
    res.status(500).json({
        error: `Failed to generate character details. Is Ollama running and accessible at ${OLLAMA_BASE_URL}?`,
        stats: generateStats(),
        spells: getSampleSpells(charClass, level),
        backstory: "A mysterious adventurer begins their journey...",
        personality: { traits: "Adventurous\nFriendly", ideal: "Freedom", bond: "My companions", flaw: "Reckless" }
    });
  }
});


// NEW: Stable Diffusion Portrait Generation Endpoint
app.post('/api/generate-portrait', async (req, res) => {
    const { race, charClass, name, gender } = req.body;
    let genderStr = 'person';
    if (gender) {
        genderStr = gender;
    }
    if (!race || !charClass || !name || !genderStr) {
        return res.status(400).json({ error: "Missing required character details for portrait generation." });
    }

    const prompt = `Fantasy RPG character portrait, ${race} ${charClass} named ${name}, ${gender}, intricate details, fantasy art, volumetric lighting, epic, highly detailed, sharp focus, artstation, concept art, digital painting`;
    const negative_prompt = `ugly, deformed, disfigured, blurry, grainy, low resolution, bad anatomy, dismembered, extra limbs, poorly drawn face, poorly drawn hands, missing limbs, malformed limbs, tiling, poorly rendered, out of frame`;

    try {
        const sdResponse = await fetch(`${STABLE_DIFFUSION_BASE_URL}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                negative_prompt: negative_prompt,
                steps: 25, // You can adjust these
                cfg_scale: 7, // You can adjust these
                width: 512,
                height: 768, // Portrait aspect ratio
                sampler_name: "Euler a", // Common sampler, adjust as needed
                n_iter: 1,
                batch_size: 1,
                seed: -1 // Random seed
            })
        });

        if (!sdResponse.ok) {
            const errorText = await sdResponse.text(); // Read error response from SD
            throw new Error(`Stable Diffusion API error: ${sdResponse.status} ${sdResponse.statusText} - ${errorText}`);
        }

        const data = await sdResponse.json();

        if (data.images && data.images.length > 0) {
            res.json({ image: data.images[0] }); // Send back the base64 image
        } else {
            res.status(500).json({ error: 'No image generated by Stable Diffusion.' });
        }

    } catch (error) {
        console.error("Error generating portrait with Stable Diffusion:", error);
        res.status(500).json({ error: 'Failed to generate portrait. Is Stable Diffusion running and accessible at ' + STABLE_DIFFUSION_BASE_URL + '? Details: ' + error.message });
    }
});


// PDF Generation Endpoint
app.post('/api/pdf', (req, res) => {
  const { name, level, race, background, charClass, alignment, abilities, hitPoints, armorClass, initiative, speed, savingThrows, skillProficiencies, features, proficienciesAndLanguages, spells, personality, backstory, portrait, experiencePoints } = req.body;
  const { traits, ideal, bond, flaw } = personality;

  const doc = new PDFDocument({ autoFirstPage: false });
  const filename = encodeURIComponent(`${name}_character.pdf`);
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);

  doc.addPage();
  const margin = 36;
  const contentWidth = doc.page.width - 2 * margin;

  doc.font('Helvetica');
  doc.fontSize(10);

  let currentY = margin;

  // --- Header Section ---
  doc.rect(margin, currentY, contentWidth, 30).stroke();
  doc.fontSize(18).text('D&D CHARACTER SHEET', margin, currentY + 8, { align: 'center', width: contentWidth });
  currentY += 40;

  // Top Info Row (Name, Class & Level, Background, Player Name)
  doc.rect(margin, currentY, contentWidth, 30).stroke();
  doc.fontSize(8).text('CHARACTER NAME', margin + 5, currentY + 2);
  doc.fontSize(12).text(name, margin + 5, currentY + 15);

  doc.fontSize(8).text('CLASS & LEVEL', margin + 160, currentY + 2);
  doc.fontSize(12).text(`${charClass} ${level}`, margin + 160, currentY + 15);

  doc.fontSize(8).text('BACKGROUND', margin + 270, currentY + 2);
  doc.fontSize(12).text(background, margin + 270, currentY + 15);

  doc.fontSize(8).text('PLAYER NAME', margin + 380, currentY + 2);
  doc.fontSize(12).text('Generated', margin + 380, currentY + 15);
  currentY += 40;

  // Second Info Row (Race, Alignment, Experience Points)
  doc.rect(margin, currentY, contentWidth, 30).stroke();
  doc.fontSize(8).text('RACE', margin + 5, currentY + 2);
  doc.fontSize(12).text(race, margin + 5, currentY + 15);

  doc.fontSize(8).text('ALIGNMENT', margin + 160, currentY + 2);
  doc.fontSize(12).text(alignment, margin + 160, currentY + 15);

  doc.fontSize(8).text('EXPERIENCE POINTS', margin + 270, currentY + 2);
  doc.fontSize(12).text(experiencePoints.toString(), margin + 270, currentY + 15);
  currentY += 40;

  // --- Portrait Section (Left Column) ---
  const portraitWidth = 150;
  const portraitHeight = 180;
  const leftColumnX = margin;
  const rightColumnX = margin + portraitWidth + 20;

  // Draw a box for the portrait
  doc.rect(leftColumnX, currentY, portraitWidth, portraitHeight).stroke();
  doc.fontSize(8).text('CHARACTER PORTRAIT', leftColumnX + 5, currentY + 5);

  if (portrait) {
      try {
          const imageBuffer = Buffer.from(portrait, 'base64');
          doc.image(imageBuffer, leftColumnX + 10, currentY + 20, { width: portraitWidth - 20, height: portraitHeight - 20, fit: [portraitWidth - 20, portraitHeight - 20] });
      } catch (e) {
          console.error("Error drawing portrait:", e);
          doc.fontSize(10).text('Portrait failed to load', leftColumnX + 20, currentY + portraitHeight / 2);
      }
  }

  // --- Combat Stats (Right of Portrait) ---
  const combatBoxWidth = (contentWidth - portraitWidth - 30) / 3;
  let combatY = currentY;

  // AC
  doc.rect(rightColumnX, combatY, combatBoxWidth - 5, 60).stroke();
  doc.fontSize(8).text('ARMOR CLASS', rightColumnX + 5, combatY + 5);
  doc.fontSize(24).text(armorClass.toString(), rightColumnX + 5, combatY + 25);

  // Initiative
  doc.rect(rightColumnX + combatBoxWidth, combatY, combatBoxWidth - 5, 60).stroke();
  doc.fontSize(8).text('INITIATIVE', rightColumnX + combatBoxWidth + 5, combatY + 5);
  doc.fontSize(24).text(initiative.toString(), rightColumnX + combatBoxWidth + 5, combatY + 25);

  // Speed
  doc.rect(rightColumnX + 2 * combatBoxWidth, combatY, combatBoxWidth - 5, 60).stroke();
  doc.fontSize(8).text('SPEED', rightColumnX + 2 * combatBoxWidth + 5, combatY + 5);
  doc.fontSize(24).text(`${speed} ft`, rightColumnX + 2 * combatBoxWidth + 5, combatY + 25);
  combatY += 70;

  // HP & Hit Dice
  const hpBoxWidth = (contentWidth - portraitWidth - 30) / 2;
  doc.rect(rightColumnX, combatY, hpBoxWidth - 5, 60).stroke();
  doc.fontSize(8).text('HIT POINT MAXIMUM', rightColumnX + 5, combatY + 5);
  doc.fontSize(24).text(hitPoints.toString(), rightColumnX + 5, combatY + 25);

  doc.rect(rightColumnX + hpBoxWidth, combatY, hpBoxWidth - 5, 60).stroke();
  doc.fontSize(8).text('HIT DICE', rightColumnX + hpBoxWidth + 5, combatY + 5);
  doc.fontSize(18).text(`d${(level > 0 && charClass) ? 8 : 'N/A'}`, rightColumnX + hpBoxWidth + 5, combatY + 25);
  combatY += 70;

  // Death Saves (simplified)
  doc.rect(rightColumnX, combatY, contentWidth - portraitWidth - 30, 30).stroke();
  doc.fontSize(8).text('DEATH SAVES (SUCCESS/FAILURE)', rightColumnX + 5, combatY + 5);
  doc.fontSize(12).text('O O O / O O O', rightColumnX + 5, combatY + 15);

  // Update currentY to be below both columns (portrait and combat stats)
  currentY = Math.max(currentY + portraitHeight + 20, combatY + 40);

  // --- Ability Scores Table ---
  doc.addPage();
  currentY = margin;
  doc.fontSize(12).text('ABILITY SCORES', margin, currentY);
  currentY += 15;

  const abilityScoreY = currentY;
  const abilityBoxSize = 50;
  const abilityModifierBoxHeight = 20;

  abilities.forEach((ability, i) => {
      const x = margin + i * (abilityBoxSize + 10);
      doc.rect(x, abilityScoreY, abilityBoxSize, abilityBoxSize).stroke();
      doc.fontSize(10).text(ability.stat, x, abilityScoreY + 5, { width: abilityBoxSize, align: 'center' });
      doc.fontSize(16).text(ability.score.toString(), x, abilityScoreY + 25, { width: abilityBoxSize, align: 'center' });

      const modifier = getAbilityModifier(ability.score);
      doc.rect(x, abilityScoreY + abilityBoxSize + 5, abilityBoxSize, abilityModifierBoxHeight).stroke();
      doc.fontSize(10).text(`${modifier >= 0 ? '+' : ''}${modifier}`, x, abilityScoreY + abilityBoxSize + 9, { width: abilityBoxSize, align: 'center' });
  });
  currentY = abilityScoreY + abilityBoxSize + abilityModifierBoxHeight + 20;

  // --- Saving Throws and Skills ---
  const column2X = doc.page.width / 2;
  let savingThrowY = currentY;
  let skillsY = currentY;

  // Saving Throws
  doc.fontSize(12).text('SAVING THROWS', margin, savingThrowY);
  savingThrowY += 15;
  savingThrows.forEach(st => {
      doc.fontSize(10).text(`- ${st}`, margin + 10, savingThrowY);
      savingThrowY += 12;
  });

  // Skills
  doc.fontSize(12).text('SKILLS', column2X, skillsY);
  skillsY += 15;
  skillProficiencies.forEach(skill => {
      doc.fontSize(10).text(`- ${skill}`, column2X + 10, skillsY);
      skillsY += 12;
  });
  currentY = Math.max(savingThrowY, skillsY) + 20;


  // --- Personality Traits, Ideals, Bonds, Flaws ---
  doc.fontSize(12).text('PERSONALITY TRAITS', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(traits, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(traits, { width: contentWidth - 10 }) + 10;

  doc.fontSize(12).text('IDEALS', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(ideal, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(ideal, { width: contentWidth - 10 }) + 10;

  doc.fontSize(12).text('BONDS', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(bond, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(bond, { width: contentWidth - 10 }) + 10;

  doc.fontSize(12).text('FLAWS', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(flaw, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(flaw, { width: contentWidth - 10 }) + 10;


  // --- Attacks & Spellcasting (Simple Table) ---
  doc.addPage();
  currentY = margin;
  doc.fontSize(12).text('ATTACKS & SPELLCASTING', margin, currentY);
  currentY += 15;

  const atkCol1Width = contentWidth * 0.4;
  const atkCol2Width = contentWidth * 0.2;
  const atkCol3Width = contentWidth * 0.4;
  const tableHeadersY = currentY;

  doc.fontSize(10).text('NAME', margin, tableHeadersY);
  doc.text('ATK BONUS', margin + atkCol1Width, tableHeadersY);
  doc.text('DAMAGE/TYPE', margin + atkCol1Width + atkCol2Width, tableHeadersY);
  currentY += 15;

  // Draw line under headers
  doc.rect(margin, currentY, contentWidth, 0).stroke();
  currentY += 5;

  // Example attacks (can be populated more dynamically later, e.g., from class/race)
  const displaySpells = spells.length > 0 ? spells : ["No spells known"];
  const attacksAndSpells = [
      { name: 'Unarmed Strike', bonus: '+2', damage: '1d4 Bludgeoning' }
  ];
  if (displaySpells[0] !== "No spells known") {
      attacksAndSpells.push({ name: 'Spellcasting', bonus: '+3 (Int/Wis/Cha)', damage: displaySpells.slice(0, 1).join(', ') + (displaySpells.length > 1 ? '...' : '') });
  }

  attacksAndSpells.forEach(item => {
      doc.fontSize(10).text(item.name, margin, currentY);
      doc.text(item.bonus, margin + atkCol1Width, currentY);
      doc.text(item.damage, margin + atkCol1Width + atkCol2Width, currentY);
      currentY += 15;
  });
  currentY += 10;


  // --- Spells Known (More detailed) ---
  doc.fontSize(12).text('SPELLS KNOWN', margin, currentY);
  currentY += 15;
  if (spells.length > 0) {
      spells.forEach(spell => {
          doc.fontSize(10).text(`- ${spell}`, margin + 5, currentY);
          currentY += 12;
          if (currentY > doc.page.height - margin) {
              doc.addPage();
              currentY = margin;
          }
      });
  } else {
      doc.fontSize(10).text("No spells known.", margin + 5, currentY);
      currentY += 15;
  }
  currentY += 10;


  // --- Features & Traits ---
  doc.fontSize(12).text('FEATURES & TRAITS', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(features, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(features, { width: contentWidth - 10 }) + 10;

  // --- Other Proficiencies & Languages ---
  doc.fontSize(12).text('OTHER PROFICIENCIES & LANGUAGES', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(proficienciesAndLanguages, margin + 5, currentY, { width: contentWidth - 10 });
  currentY += doc.font('Helvetica').fontSize(10).heightOfString(proficienciesAndLanguages, { width: contentWidth - 10 }) + 10;

  // --- Character Backstory ---
  doc.addPage();
  currentY = margin;
  doc.fontSize(12).text('CHARACTER BACKSTORY', margin, currentY);
  currentY += 15;
  doc.fontSize(10).text(backstory, margin + 5, currentY, { width: contentWidth - 10 });


  doc.end();
});

const PORT = process.env.PORT || 3000;

// Function to get the server's network IP address
function getServerIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0'; // Fallback if no external IP found
}

app.listen(PORT, () => {
  const ipAddress = getServerIpAddress();
  console.log(`Server running on port ${PORT}`);
  console.log(`Access your application at: http://${ipAddress}:${PORT}`);
  console.log(`Ollama API calls using: ${OLLAMA_BASE_URL} (configured via OLLAMA_BASE_URL env var or defaults to 127.0.0.1)`);
  console.log(`Stable Diffusion API calls using: ${STABLE_DIFFUSION_BASE_URL} (configured via STABLE_DIFFUSION_BASE_URL env var or defaults to 127.0.0.1)`);
  console.log('--- IMPORTANT for Remote Access ---');
  console.log('If Ollama or Stable Diffusion are not running on this same server, they will not be reachable.');
  console.log('Ensure they are installed and running on this remote server, and firewall rules allow internal communication on ports 11434 and 7860.');
});
