import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import StaffUser from '../../models/StaffUser.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche le classement d\'activité des staffs (Pages)'),

    async execute(interaction) {
        const itemsPerPage = 10;
        let currentPage = 0;

        // 1. Récupérer TOUS les staffs triés
        const allStaff = await StaffUser.find({}).sort({ weeklyServiceTime: -1 });

        if (!allStaff || allStaff.length === 0) {
            return interaction.reply({ content: "❌ Aucun staff trouvé.", ephemeral: true });
        }

        const totalPages = Math.ceil(allStaff.length / itemsPerPage);

        const formatTime = (ms) => {
            if (!ms || ms < 0) return "0min";
            const totalMinutes = Math.floor(ms / 60000);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return `${hours}h ${mins < 10 ? '0' : ''}${mins}`;
        };

        // Fonction pour générer l'Embed d'une page précise
        const generateEmbed = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const currentItems = allStaff.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('🏆 CLASSEMENT ACTIVITÉ STAFF')
                .setColor('#5865F2')
                .setFooter({ text: `Page ${page + 1} / ${totalPages} • Total: ${allStaff.length} membres` })
                .setTimestamp();

            let description = "";
            currentItems.forEach((staff, index) => {
                const realIndex = start + index;
                let position = `**#${realIndex + 1}**`;
                if (realIndex === 0) position = "🥇";
                if (realIndex === 1) position = "🥈";
                if (realIndex === 2) position = "🥉";

                const statusEmoji = staff.status === 'SERVICE' ? "🟢" : "🔴";
                description += `${position} **${staff.username}** ${statusEmoji}\n`;
                description += `└ Semaine : \`${formatTime(staff.weeklyServiceTime)}\` | Total : \`${formatTime(staff.totalServiceTime)}\` \n\n`;
            });

            embed.setDescription(description);
            return embed;
        };

        // Création des boutons
        const getButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️ Précédent')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Suivant ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1)
            );
        };

        // Premier envoi (Éphémère)
        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: [getButtons(currentPage)],
            ephemeral: true
        });

        // Collecteur pour gérer les clics sur les flèches
        const collector = response.createMessageComponentCollector({ time: 60000 }); // Actif 1 minute

        collector.on('collect', async i => {
            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [getButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            // Optionnel : Désactiver les boutons quand le temps est écoulé
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
};