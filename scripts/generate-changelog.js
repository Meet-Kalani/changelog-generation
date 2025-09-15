// scripts/ai-changelog.js
const { execSync } = require("child_process");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

try {
  // Get last git tag (latest version)
  const lastTag = execSync("git describe --tags --abbrev=0", {
    encoding: "utf-8",
  }).trim();

  // Get diff since last tag
  const diff = execSync(`git diff ${lastTag}..HEAD`, { encoding: "utf-8" });

  // If no diff found, exit gracefully
  if (!diff) {
    process.exit(0);
  }

  // Compute next version (simple patch bump)
  const [major, minor, patch] = lastTag
    .replace(/^v/, "")
    .split(".")
    .map(Number);

  const lifecycle = process.env.npm_lifecycle_event;

  let newVersion;
  switch (lifecycle) {
    case "release:major":
      newVersion = `v${major + 1}.0.0`;
      break;
    case "release:minor":
      newVersion = `v${major}.${minor + 1}.0`;
      break;
    default:
      newVersion = `v${major}.${minor}.${patch + 1}`;
      break;
  }

  const prompt = `
    You are an AI changelog generator.
    Analyze the following git diff and summarize the changes for developers.
    Use sections (Features, Bug Fixes, Refactors, Performance, Chores).
    Be concise, technical, and clear — avoid marketing language.
    Write in plain markdown with short bullet points.

    Diff:
    ${diff}
`;

  (async () => {
    const result = await model.generateContent(prompt);
    const aiChangelog = result.response.text();

    // Load old changelog if exists
    let oldChangelog = "";
    if (fs.existsSync("CHANGELOG.md")) {
      oldChangelog = fs.readFileSync("CHANGELOG.md", "utf8");
    }

    // Create new entry
    const date = new Date().toISOString().split("T")[0];
    const newEntry = `## ${newVersion} (${date})\n\n${aiChangelog}\n\n`;

    // Prepend new entry to old changelog
    const updatedChangelog = newEntry + oldChangelog;
    fs.writeFileSync("CHANGELOG.md", updatedChangelog);

    console.log(`✅ Gemini AI changelog generated for ${newVersion}`);
  })();
} catch (err) {
  console.error("❌ Error generating changelog:", err.message);
}
