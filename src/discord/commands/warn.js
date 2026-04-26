import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
// Attention : on utilise l'utilitaire mis à jour qui prévient aussi la cible
import { checkAndNotifyWarn } from "../utils/warnAlert.js";
import StaffUser from '../../models/StaffUser.js';

export default {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Ajouter un avertissement à un membre du staff')
        .addUserOption(option => 
            option.setName('cible')
                .setDescription('Le staff à warner')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('Raison du warn')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('cible');
        const reason = interaction.options.getString('raison');
        const executor = interaction.user;

        // 1. Vérification de l'exécuteur en DB
        const staffExecutor = await StaffUser.findOne({ discordId: executor.id });
        if (!staffExecutor || !['ADMIN', 'SUPER_ADMIN'].includes(staffExecutor.role)) {
            return interaction.reply({ 
                content: "❌ Vous n'avez pas le grade staff requis sur le panel pour warner.", 
                ephemeral: true 
            });
        }

        // 2. Vérification de la cible en DB
        const staffTarget = await StaffUser.findOne({ discordId: targetUser.id });
        if (!staffTarget) {
            return interaction.reply({ 
                content: "❌ Cet utilisateur n'est pas enregistré comme staff dans la base de données.", 
                ephemeral: true 
            });
        }

        // 3. Vérification de la hiérarchie
        if (staffExecutor.role === 'ADMIN' && staffTarget.role !== 'MODERATEUR') {
            return interaction.reply({ 
                content: "❌ En tant qu'Admin, vous ne pouvez warner que des Modérateurs.", 
                ephemeral: true 
            });
        }
        
        if (staffTarget.role === 'SUPER_ADMIN') {
            return interaction.reply({ 
                content: "❌ Impossible de warner un Super Admin.", 
                ephemeral: true 
            });
        }

        // 4. Création de l'objet warn
        const newWarn = {
            reason: reason,
            by: executor.username,
            date: new Date()
        };

        // 5. Enregistrement en DB
        staffTarget.warns.push(newWarn);
        await staffTarget.save();

        // 6. Notification automatique (Cible + Super Admins si seuil atteint)
        // On passe l'objet newWarn pour que l'utilitaire puisse l'afficher dans le DM
        await checkAndNotifyWarn(interaction.client, staffTarget, newWarn);

        // 7. Réponse publique (ou éphémère selon ton choix)
        return interaction.reply({
            content: `✅ **Avertissement ajouté**\n**Cible:** ${targetUser.username} (Total: ${staffTarget.warns.length})\n**Raison:** ${reason}\n**Par:** ${executor.username}`,
            ephemeral: false
        });
    }
};