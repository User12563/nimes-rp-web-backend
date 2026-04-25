export function cleanMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Supprime les liens et garde le texte
    .replace(/\*\*/g, "")  // Supprime le formatage gras
    .trim();
}