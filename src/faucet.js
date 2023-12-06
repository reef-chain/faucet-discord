import {validAddressInteraction$} from "./interaction.rx";
import {getSend_nonce$} from "./send.rx";

const {BN} = require("bn.js");
const {Keyring, WsProvider} = require('@polkadot/api');
const {Provider} = require('@reef-chain/evm-provider');


export const initFaucet = async (config) => {
    console.log('connecting to RPC ',config.ws);
    const evmProvider = new Provider({
        provider: new WsProvider(config.ws)
    });
    await evmProvider.api.isReadyOrError;
    const api = evmProvider.api;
// Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.name(),
        api.rpc.system.version(),
    ]);
// Log these stats
    console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

    const keyring = new Keyring({type: "sr25519"});
    const sender = keyring.addFromUri(config.mnemonic);
    const padding = new BN(10).pow(new BN(config.decimals || 18));
    const amount = new BN(config.amount).mul(padding);

    const [send$, nonce$] = getSend_nonce$(api, sender, amount, validAddressInteraction$)
    send$.subscribe(undefined, err => console.log('SEND val ERRR=', err), () => console.log('send complete'));
    return [evmProvider, nonce$, chain]
}
