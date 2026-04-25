router.get("/", auth, requirePermission("view_audit"), async (req, res) => {
  const audits = await Audit.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(audits);
});
