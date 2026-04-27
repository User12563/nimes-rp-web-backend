import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-absence')
        .setDescription('Installe le panneau de déclaration d\'absence')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📅 GESTION DES ABSENCES')
            .setDescription("Cliquez sur le bouton ci-dessous pour déclarer une absence.\n\n" +
                            "⚠️ *Toute absence non déclarée pourra être sanctionnée.*")
            .setColor('#f1c40f');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_absence')
                .setLabel('Déclarer une absence')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝')
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: "Panneau configuré !", ephemeral: true });
    }
};