const {SlashCommandBuilder, ChatInputCommandInteraction} = require('discord.js'),
    LRU = require("lru-cache"),
    Faucet = require('../Faucet'),
    config = require('../config');

const faucet = new Faucet(config);
const cache = new LRU();

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
    async execute(interaction) {

        faucet.interactionSubj.next(interaction);
        return




        if (interaction.user.bot) return;
        //		console.log('interaction=', interaction)

        let msg = ''
        const addr = interaction.options.getString('address');
        const userId = interaction.user.id;
        const addrValid = !!addr && faucet.isAddressValid(addr);
        let messageSent;
        let tx;


        if (!!cache.has(userId)) {
            msg = '⏳ please wait for ' + config.limit + ' hours between requests.'
        }

        if (!msg && !addrValid) {
            msg = `❓ invalid address! Plese use the REEF native public address that starts with '5' ! >> `;
        }


        if (!msg) {

            cache.set(userId, 1, 1000 * 60 * 60 * config.limit);
            tx = faucet.send(addr, config);

            msg = `🛟 ${addr} 🛟 reporting low levels`;

        }

        try {
            messageSent = await interaction.reply({content: msg, fetchReply: true});

            if (tx) {
                tx.then(txRes => {
                    //if(messageSent.guildId){
                    // messageSent.react('🎁').catch((err)=>{
                    // console.log('ERROR replying=', err)
                    // })
                    // }
                    interaction.followUp({content: '🤿 oxygen delivered 🌊 tx hash ' + txRes, fetchReply: false});
                    //messageSent.reply('Sent tx hash '+txRes.toHex()).catch((err)=>{
                    //	console.log('ERROR replying=', err)
                    //})

                }).catch(err => {
                    console.log('ERROR SENDING=', err);
                    messageSent.react('❌');
                })
            }
        } catch (err) {
            console.log('ERROR=', err)
        }
    },
};
