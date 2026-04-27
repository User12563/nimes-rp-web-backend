import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('service-setup')
        .setDescription('Envoie le menu interactif de prise de service')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Création de l'Embed
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

        // Création des boutons
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

        // Confirmation pour l'admin (invisible pour les autres)
        await interaction.reply({
            content: "✅ Le menu de service a été déployé avec succès.",
            ephemeral: true
        });

        // Envoi du menu réel dans le salon
        await interaction.channel.send({
            embeds: [embed],
            components: [buttons]
        });
    },
};