import StaffUser from '../../models/StaffUser.js';

export const checkAndNotifyWarn = async (discordClient, targetStaff, lastWarn) => {
    if (!discordClient?.isReady()) return;

    // --- 1. NOTIFICATION À LA CIBLE ---
    try {
        const user = await discordClient.users.fetch(targetStaff.discordId);
        if (user) {
            const warnEmbed = {
                color: 0xeeee00, // Jaune
                title: "⚠️ Avertissement Reçu",
                description: `Bonjour **${targetStaff.username}**,\n\nVous venez de recevoir un avertissement sur le panel staff de **Nîmes-RP**.`,
                fields: [
                    { name: "Raison", value: lastWarn.reason || "Non spécifiée" },
                    { name: "Auteur", value: lastWarn.by },
                    { name: "Total d'avertissements", value: `${targetStaff.warns.length}` }
                ],
                timestamp: new Date(),
                footer: { text: "Nîmes-RP - Système de Gestion Staff" }
            };
            await user.send({ embeds: [warnEmbed] });
        }
    } catch (err) {
        console.log(`Impossible d'envoyer le DM de warn à ${targetStaff.username} (DMs fermés)`);
    }

    // --- 2. NOTIFICATION AUX SUPER_ADMINS (Seuil de 5) ---
    if (targetStaff.warns.length > 0 && targetStaff.warns.length % 5 === 0) {
        const superAdmins = await StaffUser.find({ role: "SUPER_ADMIN" });
        if (superAdmins.length === 0) return;

        const warnList = targetStaff.warns.map((w, i) => 
            `**${i + 1}.** [${new Date(w.date).toLocaleDateString()}] par *${w.by}* : ${w.reason}`
        ).join("\n");

        const adminEmbed = {
            color: 0xff0000, // Rouge
            title: `🚨 SEUIL DE WARNS ATTEINT : ${targetStaff.username}`,
            description: `Le staff <@${targetStaff.discordId}> a atteint **${targetStaff.warns.length}** avertissements.`,
            fields: [{ name: "Historique complet", value: warnList.slice(0, 1024) }],
            timestamp: new Date()
        };

        for (const admin of superAdmins) {
            try {
                const adminUser = await discordClient.users.fetch(admin.discordId);
                if (adminUser) await adminUser.send({ embeds: [adminEmbed] });
            } catch (err) {
                console.error(`Erreur DM SuperAdmin ${admin.discordId}`);
            }
        }
    }
};