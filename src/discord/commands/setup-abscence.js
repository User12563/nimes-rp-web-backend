import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-absence')
        .setDescription('Installe le panneau de déclaration d\'absence')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📅 GESTION DES ABSENCES')
            .setDescription(
                "Utilisez les boutons ci-dessous pour gérer vos périodes d'indisponibilité.\n\n" +
                "📝 **Déclarer** : Signalez votre absence.\n" +
                "> *Format requis : `JJ/MM HH:MM` (ex: 27/04 14:30)*\n\n" +
                "🗑️ **Supprimer** : Annulez une absence prévue ou archivez une absence en cours.\n\n" +
                "ℹ️ **Note** : Le rôle d'absence vous sera attribué et retiré **automatiquement** aux heures indiquées."
            )
            .setColor('#f1c40f')
            .setFooter({ text: 'Système d\'automatisation des absences' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_open_absence_form')
                .setLabel('Déclarer une absence')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝'),
            
            new ButtonBuilder()
                .setCustomId('btn_delete_absence')
                .setLabel('Supprimer / Retour')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        
        return await interaction.reply({ 
            content: "✅ Le panneau d'absence (avec gestion automatique des rôles) a été déployé !", 
            ephemeral: true 
        });
    }
};