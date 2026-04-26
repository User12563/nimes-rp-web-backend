import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} from 'discord.js';
import Log from "../../models/Logs.js";
import StaffUser from '../models/StaffUser.js';

export default {
    data: new SlashCommandBuilder()
        .setName('justifier')
        .setDescription('Justifier vos sanctions sur un joueur')
        .addStringOption(option => 
            option.setName('target')
                .setDescription('Le pseudo du joueur sanctionné')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('Preuves et explications')
                .setRequired(true)),

    async execute(interaction) {
        const targetName = interaction.options.getString('target');
        const raison = interaction.options.getString('raison');

        try {
            // 1. Trouver le profil Staff (Lien Discord -> Roblox)
            const staff = await StaffUser.findOne({ discordId: interaction.user.id });
            if (!staff) return interaction.reply({ content: "❌ Vous n'êtes pas un Staff enregistré.", ephemeral: true });

            // 2. Rechercher les logs non justifiés de CE staff sur CETTE cible
            const logs = await Log.find({
                author: staff.robloxUsername,
                target: { $regex: new RegExp(`^${targetName}$`, 'i') }, // Case insensitive
                category: { $ne: "JUSTIFIÉ" }
            }).limit(25).sort({ createdAt: -1 });

            if (logs.length === 0) {
                return interaction.reply({ content: `❌ Aucun log non-justifié trouvé pour **${targetName}** sous votre nom (**${staff.robloxUsername}**).`, ephemeral: true });
            }

            // 3. Si un seul log, on justifie direct
            if (logs.length === 1) {
                const log = logs[0];
                log.category = "JUSTIFIÉ";
                log.action = `[JUSTIFIÉ] ${raison}`;
                log.raw = `RAISON : ${raison} | ${log.raw}`;
                await log.save();

                return interaction.reply({ content: `✅ Log unique trouvé et justifié pour **${targetName}** !` });
            }

            // 4. Si plusieurs logs, on propose un menu de sélection
            const select = new StringSelectMenuBuilder()
                .setCustomId('select_justification')
                .setPlaceholder('Choisissez le log précis à justifier');

            logs.forEach(l => {
                const dateStr = new Date(l.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
                select.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${l.type.toUpperCase()} - ${dateStr}`)
                        // On stocke l'ID et la raison dans la value (séparés par un |)
                        .setValue(`${l._id}|${raison.substring(0, 80)}`) 
                        .setDescription(l.raw.substring(0, 100) || "Sans détails")
                );
            });

            const row = new ActionRowBuilder().addComponents(select);

            await interaction.reply({
                content: `Plusieurs sanctions trouvées pour **${targetName}**. Laquelle voulez-vous justifier ?`,
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: "⚠️ Erreur lors de la recherche.", ephemeral: true });
        }
    }
};