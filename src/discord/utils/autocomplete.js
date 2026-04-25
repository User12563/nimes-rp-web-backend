import Log from "../../models/Logs.js";

export async function getPseudoAutocomplete(interaction, current) {
  const targets = await Log.aggregate([
    { $match: { target: { $ne: null, $ne: "Inconnu" } } },
    { $group: { _id: "$target" } },
    { $limit: 25 },
    { $sort: { _id: 1 } }
  ]);

  const choices = targets
    .map(t => t._id)
    .filter(t => t && t.toLowerCase().includes(current.toLowerCase()))
    .slice(0, 25)
    .map(name => ({ name, value: name }));

  await interaction.respond(choices);
}
