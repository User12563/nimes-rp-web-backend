import Setting from "../../models/Setting.js";

export async function getCollabState() {
  const doc = await Setting.findOne({ key: "collab_state" }).lean();
  return doc ? doc.value : "Ouvert";
}

export async function setCollabState(state) {
  await Setting.findOneAndUpdate(
    { key: "collab_state" },
    { key: "collab_state", value: state },
    { upsert: true }
  );
}
