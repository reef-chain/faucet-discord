const {BN} = require("bn.js"),
    crypto = require("@reef-defi/util-crypto");
const {Keyring, ApiPromise, WsProvider} = require('@polkadot/api');
const {options} = require('@reef-defi/api');

module.exports = class Faucet {

    constructor(config) {
        this.config = config;
        this.api = null;
        this.sender = null;
        this.amount = 0;
        this.nonce = 0;
        this.init();
    };

    async init() {
        const provider = new WsProvider(this.config.ws);
        // this.api = await ApiPromise.create({ types: types, provider: ws });
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
        this.sender = keyring.addFromUri(this.config.mnemonic);
        const padding = new BN(10).pow(new BN(this.config.decimals));
        this.amount = new BN(this.config.amount).mul(padding);
        this.nonce = await this.api.rpc.system.accountNextIndex(this.sender.address);
    };

    async send(address) {
        // const keyring = new Keyring({type: "sr25519"});
        // const sender = keyring.addFromUri(this.config.mnemonic);
        // const padding = new BN(10).pow(new BN(this.config.decimals));
        // const amount = new BN(this.config.amount).mul(padding);
        // const nonce = await this.api.rpc.system.accountNextIndex(sender.address)
        console.log(`Sending to ${address} // nonce=${this.nonce} // sender= ${this.sender.address}`);
        return this.api.tx.balances.transferKeepAlive(address, this.amount).signAndSend(this.sender, {nonce: this.nonce++});
    }

    isAddressValid(address) {
        return !!crypto.checkAddress(address, this.config.address_type)[0];
    }

};
