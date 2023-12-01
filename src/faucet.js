import {validAddressInteraction$} from "./interaction.rx";
import {getSend$} from "./send.rx";

const {BN} = require("bn.js");
const {Keyring, WsProvider} = require('@polkadot/api');
const {Provider} = require('@reef-chain/evm-provider');


export const initFaucet = async (config)=> {
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
    const padding = new BN(10).pow(new BN(config.decimals||18));
    const amount = new BN(config.amount).mul(padding);

    getSend$(api, sender, amount, validAddressInteraction$ ).subscribe(undefined, err => console.log('SEND val ERRR=', err), () => console.log('send complete'));

    // nextNonceSubj.next();
}


/*module.exports = class Faucet {

    constructor(config) {
        this.config = config;
        this.api = null;
        this.sender = null;
        this.amount = 0;
        this.nonce = 0;
        this.interactionSubj = new Subject();
        this.nextNonceSubj = new Subject();

        this.init().then();
    };

    async init() {
        const provider = new WsProvider(this.config.ws);
        this.api = new ApiPromise(options({provider}));
        await this.api.isReady;
        // Retrieve the chain & node information information via rpc calls
        const [chain, nodeName, nodeVersion] = await Promise.all([
            this.api.rpc.system.chain(),
            this.api.rpc.system.name(),
            this.api.rpc.system.version(),
        ]);
        // Log these stats
        console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

        const keyring = new Keyring({type: "sr25519"});
        const sender = keyring.addFromUri(this.config.mnemonic);
        const padding = new BN(10).pow(new BN(this.config.decimals));
        const amount = new BN(this.config.amount).mul(padding);



        getSend$(this.api, sender, amount, this.nextNonceSubj ).subscribe(undefined, err => console.log('SEND val ERRR=', err), () => console.log('send complete'));
        this.nextNonceSubj.next();
    };


};*/
