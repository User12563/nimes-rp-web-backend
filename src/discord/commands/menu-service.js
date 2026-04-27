const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('service-setup')
        .setDescription('Envoie le menu interactif de prise de service')
        // On remplace Administrator par ManageGuild (Gérer le serveur)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // L'embed reste le même, on est sur du visuel pro
        const embed = new EmbedBuilder()
            .setTitle('🕒 GESTION DU SERVICE STAFF')
            .setDescription(
                "Utilisez les boutons ci-dessous pour enregistrer vos heures.\n\n" +
                "🟢 **Prise de service**\n" +
                "🔴 **Fin de service**\n\n" +
                "*Tout abus sera sanctionné par la direction.*"
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nîmes RP • Pointage' })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('duty_on')
                .setLabel('Prendre son service')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🟢'),

            new ButtonBuilder()
                .setCustomId('duty_off')
                .setLabel('Quitter son service')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔴')
        );

        // On envoie une confirmation invisible pour les autres
        await interaction.reply({
            content: "✅ Le menu a été déployé dans ce salon.",
            ephemeral: true
        });

        await interaction.channel.send({
            embeds: [embed],
            components: [buttons]
        });
    },
};