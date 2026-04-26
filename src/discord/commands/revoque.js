import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import StaffUser from '../../models/StaffUser.js';

// On récupère les IDs de ton fichier routes/staff.js
const DISCORD_ROLES_TO_REMOVE = [
    "1381159289179082752", // Modérateur
    "1381159291372830820"  // Admin
];

export default {
    data: new SlashCommandBuilder()
        .setName('revoke')
        .setDescription('Révoquer totalement un accès staff (DB + Discord)')
        .addUserOption(option => 
            option.setName('cible')
                .setDescription('Le staff à révoquer')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('cible');
        const executor = interaction.user;

        // 1. Vérification de l'exécuteur (Doit être SUPER_ADMIN en DB)
        const staffExecutor = await StaffUser.findOne({ discordId: executor.id });
        if (!staffExecutor || staffExecutor.role !== 'SUPER_ADMIN') {
            return interaction.reply({ 
                content: "❌ Seuls les **SUPER_ADMIN** enregistrés sur le panel peuvent utiliser cette commande.", 
                ephemeral: true 
            });
        }

        // 2. Vérification de la cible en DB
        const staffTarget = await StaffUser.findOne({ discordId: targetUser.id });
        if (!staffTarget) {
            return interaction.reply({ 
                content: "❌ Cet utilisateur n'existe pas dans la base de données du staff.", 
                ephemeral: true 
            });
        }

        // 3. SÉCURITÉ : Interdiction de révoquer un autre SUPER_ADMIN
        if (staffTarget.role === 'SUPER_ADMIN') {
            return interaction.reply({ 
                content: "❌ **Action interdite** : Vous ne pouvez pas révoquer un autre Super Admin via cette commande.", 
                ephemeral: true 
            });
        }

        // 4. Empêcher l'auto-révocation
        if (staffTarget.discordId === executor.id) {
            return interaction.reply({ 
                content: "❌ Vous ne pouvez pas vous révoquer vous-même.", 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 5. Envoi du message d'adieu (DM)
            const dmEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("❌ Révocation de vos accès Staff")
                .setDescription(`Bonjour **${staffTarget.username}**,\n\nTes accès au staff de **Nîmes-RP** ont été révoqués par la haute administration.`)
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                console.log("DMs fermés pour l'utilisateur révoqué.");
            });

            // 6. Retrait des rôles Discord
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member) {
                await member.roles.remove(DISCORD_ROLES_TO_REMOVE, `Révoqué par ${executor.username} via commande /revoke`);
            }

            // 7. Suppression de la base de données
            await StaffUser.deleteOne({ discordId: targetUser.id });

            return interaction.editReply({ 
                content: `✅ **Révocation terminée**\nL'utilisateur **${targetUser.username}** a été supprimé de la DB et ses rôles ont été retirés.` 
            });

        } catch (error) {
            console.error(error);
            return interaction.editReply({ content: "❌ Une erreur est survenue lors de la révocation." });
        }
    }
};