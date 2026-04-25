import { logger } from "../../utils/logger.js";

const robloxUserCache = new Map();

export async function getRobloxUser(username) {
  if (!username?.trim()) return null;

  const key = username.toLowerCase();
  if (robloxUserCache.has(key)) return robloxUserCache.get(key);

  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.data?.length) {
      const u = data.data[0];
      const result = { id: u.id, name: u.name, displayName: u.displayName };
      robloxUserCache.set(key, result);
      return result;
    }

    return null;
  } catch (err) {
    logger.error(err, `getRobloxUser(${username})`);
    return null;
  }
}

export async function formatAuthorLink(authorName) {
  if (!authorName || authorName === "Inconnu" || authorName === "Système")
    return authorName || "Inconnu";

  try {
    const rUser = await getRobloxUser(authorName);
    if (rUser)
      return `[${rUser.name}](https://www.roblox.com/users/${rUser.id}/profile)`;
  } catch {}

  return authorName;
}
