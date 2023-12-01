const {SlashCommandBuilder, ChatInputCommandInteraction} = require('discord.js');
const {handleNewInteraction} = require("../interaction.rx");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faucet')
        .setDescription('Get REEF on SCUBA testnet')
        .addStringOption(option =>
            option
                .setName('address')
                .setRequired(true)
                .setMaxLength(48)
                .setMinLength(48)
                .setDescription('Send REEF to native address')),
    execute(interaction) {
        handleNewInteraction(interaction);
    },
};
