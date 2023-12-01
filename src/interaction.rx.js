import {mergeMap, Subject} from "rxjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";

const {filter, map, catchError, share, partition, switchScan, from, take, of} = require("rxjs");
const cache = require("./cache");
const crypto = require("@polkadot/util-crypto");
const config = require("./config");

const interactionSubj = new Subject();

function isAddressValid(address) {
    // console.log('valid=',address);
    return !!address && !!crypto.checkAddress(address, config.address_type)[0];
}


export function sendError(interaction) {
    return interaction.editReply({content: `❌ Error transfering coins ❌ Please try later.`});
}

export function sendReady(interaction) {
    return interaction.editReply({content: `📦 Transaction ready 📦`});
}

export function sendBroadcast(interaction) {
    return interaction.editReply({
        content: `🏎️ Sent to Reef blockchain network 🏎

⏳ ~10s to be included in block ...
                            `
    });
}

export function sendInBlock(interaction) {
    return interaction.editReply({
        content: `🏁 Accepted in block 🏁

⏳ ~30s to non reversible finality ...
                            `
    });
}

export function sendFinalized(interaction) {
    return interaction.editReply({
        content: `🏆 Transaction finalized on chain 🏆 

⏳~10s to be visible on testnet.reefscan.com ...`
    });
}

export function sendIndexed(interaction, txHash) {
    const url = 'https://testnet.reefscan.com/transfer/' + txHash;
    const linkBtn = new ButtonBuilder()
        .setLabel('👀 testnet.reefscan.com ')
        .setURL(url)
        .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder()
        .addComponents(linkBtn);
    return interaction.editReply({
        components: [row], content: `🪸🐠 Transfer details available 🐠🪸 
`
    });
}

async function sendAddressNotValid(interaction) {
    const msg = `❓ invalid address! Plese use the REEF native public address that starts with '5' ! >> `;
    return await interaction.reply({content: msg, fetchReply: true});
}

async function sendNeedToWait(interaction) {
    const msg = '⏳ please wait for ' + config.limit + ' hours between requests.';
    return await interaction.reply({content: msg, fetchReply: true});
}

async function sendReceived(interaction) {
    return await interaction.reply({content: '🪸🐠 Received request for testnet tokens 🐠🪸', fetchReply:true});
    // await interaction.deferReply({fetchReply:true, ephemeral:true});
}

const logErrorAndContinue = (errorPrefix) => {
    return (err, caught$) => {
        console.log(errorPrefix + ' ', err.message);
        return caught$;
    }
}

const pipeLogErr = (errPrefix) => {
    return (obs) => obs.pipe(
        catchError(logErrorAndContinue(errPrefix))
    )
}

const inboundInteractions$ = interactionSubj.asObservable().pipe(
    filter(interaction => interaction?.user?.bot != null && !interaction.user.bot),

    mergeMap(async (interaction) => {
        try {
            await sendReceived(interaction);
        }catch (e) {
            console.log('iinterERR=',e.message);
        }
        return ({
                interaction,
                address: interaction.options.getString('address'),
                userId: interaction.user.id,
            })
        }
    ),
    catchError(logErrorAndContinue('parse inbound')),
    share()
);

const [enoughTimePassed$, needToWaitInteraction$] = partition(inboundInteractions$, (inter) => cache.enoughTimePassed(inter.userId)
).map(pipeLogErr('time ERROR='));
needToWaitInteraction$.subscribe(inter => sendNeedToWait(inter.interaction), error => console.log('wait ERROR=', error), () => console.log('wait complete'));

const [_validAddress$, invalidAddress$] = partition(enoughTimePassed$.pipe(share()), (inter) => isAddressValid(inter.address)
).map(pipeLogErr('valid address ERROR='));
invalidAddress$.subscribe(inter => sendAddressNotValid(inter.interaction), error => console.log('addr ERROR=', error), () => console.log('addr complete'));

export const handleNewInteraction = (inter) => interactionSubj.next(inter);
export const validAddressInteraction$ = _validAddress$;
