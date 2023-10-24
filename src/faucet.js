const {BN} = require("bn.js"),
    crypto = require("@reef-defi/util-crypto");
const {Keyring, ApiPromise, WsProvider} = require('@polkadot/api');
const {options} = require('@reef-defi/api');
const {Subject,of, mergeMap, pipe, map, concatMap, catchError} = require('rxjs')
const {shareReplay} = require("rxjs/src");

module.exports = class Faucet {

    constructor(config) {
        this.config = config;
        this.api = null;
        this.sender = null;
        this.amount = 0;
        this.nonce = 0;
        this.sendQueueSubj = new Subject();

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
        this.sender = keyring.addFromUri(this.config.mnemonic);
        const padding = new BN(10).pow(new BN(this.config.decimals));
        this.amount = new BN(this.config.amount).mul(padding);

        this.sendQueueSubj.asObservable().pipe(
            concatMap(send$ => send$),
            catchError(_ => of(null))
        ).subscribe();
        // await this.resetNonce(this.sender.address);
    };

    send(address) {
        //const sendQueueNextFn = this.sendQueueSubj.next;
        return new Promise((resolve, reject) => {
            const send$ = of({fromSig: this.sender, to: address, amount: this.amount}).pipe(
                mergeMap((sendVal) => this.api.tx.balances.transferKeepAlive(sendVal.to, sendVal.amount).signAndSend(sendVal.fromSig, {nonce: -1})),
                map(res => {
                    resolve(res.toHex());
                    return res;
                }),
                catchError(err=>{
                    reject(err.message);
                    throw new Error(err.message);
                }),
                take(1)
            );
            console.log(`Adding to queue ${address} // nonce=${this.nonce} // sender= ${this.sender.address}`);
            this.sendQueueSubj.next(send$);
        });
    }

    isAddressValid(address) {
        return !!crypto.checkAddress(address, this.config.address_type)[0];
    }

    /*async resetNonce(address) {
        this.nonce = await this.api.rpc.system.accountNextIndex(this.sender.address);
    }*/

};
