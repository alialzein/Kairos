import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";

const NAME = /^[A-Z][A-Za-z]{1,23}$/;

const IDENTITY = "packages/config/identity.yaml";
const CORE = "persona/core.yaml";
const PROMPT = "persona/prompts/reasoner_system.md";

export function renameTwin(root: string, newName: string): { changed: string[] } {
  if (!NAME.test(newName))
    throw new Error(`"${newName}" must be one capitalised word (letters only, 2–24 chars)`);
  const changed: string[] = [];

  // identity.yaml — parseDocument keeps comments and formatting
  const identityPath = join(root, IDENTITY);
  const identity = parseDocument(readFileSync(identityPath, "utf8"));
  const oldName = String(identity.get("twin_name"));
  if (!NAME.test(oldName))
    throw new Error(`identity.yaml twin_name "${oldName}" is not a valid twin name (${NAME})`);
  identity.set("twin_name", newName);
  identity.setIn(["wake_phrase", "en"], `Hey ${newName}`);
  writeFileSync(identityPath, identity.toString());
  changed.push(IDENTITY);

  // persona/core.yaml — only meta.twin_name
  const corePath = join(root, CORE);
  const core = parseDocument(readFileSync(corePath, "utf8"));
  core.setIn(["meta", "twin_name"], newName);
  writeFileSync(corePath, core.toString());
  changed.push(CORE);

  // prompt template — whole-word replacement of the old name
  const promptPath = join(root, PROMPT);
  const prompt = readFileSync(promptPath, "utf8");
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const replaced = prompt.replace(new RegExp(`\\b${escaped}\\b`, "g"), newName);
  if (replaced !== prompt) {
    writeFileSync(promptPath, replaced);
    changed.push(PROMPT);
  }
  return { changed };
}
