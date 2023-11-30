const {BN} = require("bn.js"),
    crypto = require("@reef-defi/util-crypto");
const {Keyring, ApiPromise, WsProvider} = require('@polkadot/api');
const {options} = require('@reef-defi/api');
const {Subject, of, mergeMap, map, catchError, take, filter, tap, partition, EMPTY, share, concat,
    distinctUntilChanged, combineLatest, timer, scan, switchScan, pluck, from
} = require('rxjs')
const config = require("./config");
const cache = require("./cache");
const {log} = require("webpack-node-externals/utils");
const {fromPromise} = require("rxjs/internal/observable/innerFrom");

async function msgAddressNotValid(interaction) {
    const msg = `❓ invalid address! Plese use the REEF native public address that starts with '5' ! >> `;
    return await interaction.reply({content: msg, fetchReply: true});
}

async function msgNeedToWait(interaction) {
    const msg = '⏳ please wait for ' + config.limit + ' hours between requests.';
    return await interaction.reply({content: msg, fetchReply: true});
}

const logErrorAndContinue = (errorPrefix)=> {
    return (err, caught$) => {
        console.log(errorPrefix+' ', err.message);
        return caught$;
    }
}

    const pipeLogErr = (errPrefix)=> {
        return (obs) => obs.pipe(
            catchError(logErrorAndContinue(errPrefix))
        )
    }

module.exports = class Faucet {

    constructor(config) {
        this.config = config;
        this.api = null;
        this.sender = null;
        this.amount = 0;
        this.nonce = 0;
        this.sendQueueSubj = new Subject();
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
        this.sender = keyring.addFromUri(this.config.mnemonic);
        const padding = new BN(10).pow(new BN(this.config.decimals));
        this.amount = new BN(this.config.amount).mul(padding);

        /*this.sendQueueSubj.asObservable().pipe(
            concatMap(send$ => send$),
            catchError(_ => of(null))
        ).subscribe();*/
        // await this.resetNonce(this.sender.address);

        const inboundInteractions$ = this.interactionSubj.asObservable().pipe(
            filter(interaction => interaction?.user?.bot!=null && !interaction.user.bot),
            map(interaction => ({
                    interaction,
                    address: interaction.options.getString('address'),
                    userId: interaction.user.id,
                })
            ),
            catchError(logErrorAndContinue('parse inbound')),
            // tap(v=>console.log('iiiiiii'))
        );

        const [enoughTimePassed$, needToWaitInteraction$] = partition(inboundInteractions$.pipe(share()), (inter) => cache.enoughTimePassed(inter.userId)
        ).map(pipeLogErr('time ERROR='));
        needToWaitInteraction$.subscribe(inter => msgNeedToWait(inter.interaction), error => console.log('wait ERROR=',error), ()=>console.log('wait complete'));

        const [validAddress$, invalidAddress$] = partition(enoughTimePassed$.pipe(share()), (inter) => this.isAddressValid(inter.address)
        ).map(pipeLogErr('valid address ERROR='));
        invalidAddress$.subscribe(inter => msgAddressNotValid(inter.interaction), error => console.log('addr ERROR=',error), ()=>console.log('addr complete'));

        const nextNonce$ = this.nextNonceSubj.asObservable().pipe(
            switchScan((state, reset) => {
                if (reset || state==null) {
                    return from(this.getNextNonce()).pipe(map(n=> {
                        return ({nonce: n.toNumber(), reset})
                    }), take(1));
                }
                return of({nonce:state.nonce+1, reset: false});
            }, null)
        );

        const send$ = combineLatest([nextNonce$, validAddress$]).pipe(
            scan((state, [sNextNonceObj, sNextInter]) => {
                const {nonce: sNextNonce, reset: nonceReset} = sNextNonceObj;
                console.log('CHANGE',sNextNonce, nonceReset);
                const newState = {...state};
                let nextInterSavedToSendInd = newState.sendToInterArr.indexOf(sNextInter);
                let nextInterAlreadySentInd = newState.alreadySentInter.indexOf(sNextInter);
                const isNewNextInter = nextInterAlreadySentInd<0 && nextInterSavedToSendInd<0;
                const isNewNextNonce = newState.lastNonce < sNextNonce || (nonceReset && !isNewNextInter);

                let prevSendIdx = newState.sendToInterArr.indexOf(newState.sendNextInter);
                if(prevSendIdx >-1 && isNewNextNonce){
                    //remove previous send from state
                    newState.sendToInterArr=newState.sendToInterArr.filter(v=>v!==newState.sendNextInter);
                    newState.alreadySentInter=[...newState.alreadySentInter, newState.sendNextInter];
                    console.log('REMOVED=',!!newState.sendNextInter, ' left=',newState.sendToInterArr.length);
                    newState.sendNextInter = null;
                    newState.sendNextNonce = null;
                }

                if (isNewNextInter) {
                    cache.startDelayCountdown(sNextInter.userId);
                    console.log('add NEW len=',newState.sendToInterArr.length);
                    newState.sendToInterArr=[...newState.sendToInterArr, sNextInter];
                }

                if (isNewNextNonce) {
                    newState.lastNonce = sNextNonce;
                }

                newState.send = false;
                if ((isNewNextNonce || newState.lastNonce===sNextNonce) && !newState.sendNextNonce&& !newState.sendNextInter && newState.sendToInterArr.length) {
                    newState.send=true;
                    newState.sendNextInter = newState.sendToInterArr.find(v=>!!v);
                    newState.sendNextNonce = sNextNonce;
                }

                return newState;

            }, {sendNextNonce: null, sendNextInter: null, sendToInterArr: [], alreadySentInter:[], lastNonce:null, send: true}),
            // tap(s=>console.log('sendNextInter=',s)),
            filter(v=>!!v.sendNextInter&&v.send),
            // tap(s=>console.log('1after FILTER sendNextNonce=',s.sendNextNonce, s.send)),
            distinctUntilChanged((s1,s2)=> {
                let isSame = s1.sendNextInter === s2.sendNextInter && s1.sendNextNonce === s2.sendNextNonce&&s1.send===s2.send;
                // console.log('SAME=',isSame, s1?.sendNextNonce, s2?.sendNextNonce);
                return isSame
            }),
            tap(s=>console.log('sendingSTART=',s?.sendNextNonce)),
            mergeMap(async ({sendNextNonce, sendNextInter}) => {
                const address = sendNextInter.address;
                let amount = this.amount;

                try {
                    const unsubs = await this.api.tx.balances.transferKeepAlive(address, amount).signAndSend(this.sender, {nonce: sendNextNonce}, async (txUpdate) => {
                        console.log('val=', txUpdate.status.toHuman());
                        console.log('txHash=', txUpdate.txHash.toHuman());

                        // const sentPost = await sendNextInter.interaction.followUp({fetchReply:true, ephemeral: true, content: `started send of ${amount} to ${address}...`});

                        if (txUpdate.isError) {
                            unsubs();
                            console.log('SEND ERROR=', err.message);
                            await sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `❌ Error transfering coins ❌ Please try later.`});
                            this.nextNonceSubj.next(true);
                            return;
                        }
                        let stat = txUpdate.status.toHuman();
                        if(typeof stat === 'string' && stat.toLowerCase()==='ready'){
                            await sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `📦 Transaction ready 📦`});
                            this.nextNonceSubj.next(false);
                            return;
                        }
                        if (stat.hasOwnProperty('Broadcast')) {
                            await sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `🏎️ Sent to Reef blockchain network 🏎

⏳ ~10s to be included in block ...
                            `});
                            return;
                        }
                        if (stat.hasOwnProperty('InBlock')) {
                            await sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `🏁 Accepted in block 🏁

⏳ ~30s to unreversible finality ...
                            `});
                            return;
                        }
                        if (stat.hasOwnProperty('Finalized')) {
                            unsubs();
                            const url = 'https://testnet.reefscan.com/transfer/'+txUpdate.txHash.toHuman();
                            await sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `🏆 Transaction finalized on chain 🏆 

⏳~10s to be indexed on testnet.reefscan.com ...`});

                            setTimeout(()=>{
                                sendNextInter.interaction.editReply({fetchReply:true, ephemeral: true, content: `✅ Transfer indexed ✅ 

👀 details at ${url}
🐠 Enjoy Reef chain! 🐠`});
                            }, 11000)
                            return;
                        }

                        // interaction.followUp({content: '🤿 oxygen delivered 🌊 tx hash ' + txRes, fetchReply: false});
                    });
                }catch (e) {
                    console.log('ERR0=',e.message);
                    this.nextNonceSubj.next(true);
                    await sendNextInter.interaction.followUp({fetchReply:true, ephemeral: true, content: `Error sending`});
                }
                /*return timer(7000).pipe(
                    map(v => {
                        console.log('sendingNEXT=', sendNextNonce);
                        setTimeout(()=>this.nextNonceSubj.next(false),0);
                        return sendNextNonce;
                    }),

                    catchError((err, caught) => {
                            console.log('send ERROR=', err.message);
                            return EMPTY;
                        }
                    ));*/
            }),

            catchError((err, caught) => {
                    console.log('send1 ERROR=', err.message);
                    return caught;
                }
            )
        );

        send$.subscribe(v=>console.log('senttt=',v), err=>console.log('SEND val ERRR=',err), ()=>console.log('send complete'));
        this.nextNonceSubj.next();
    };

    send(address) {
        //const sendQueueNextFn = this.sendQueueSubj.next;
        return new Promise((resolve, reject) => {
            const send$ = of({fromSig: this.sender, to: address, amount: this.amount}).pipe(
                mergeMap((sendVal) => this.api.tx.balances.transferKeepAlive(sendVal.to, sendVal.amount).signAndSend(sendVal.fromSig, {nonce: -1}, (status) => {
                    if (status.isError) {
                        reject(err.message);
                        throw new Error(err.message);
                    }
                })),
                map(res => {
                    resolve(res.toHex());
                    return res;
                }),
                catchError(err => {
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
        // console.log('valid=',address);
        return !!address && !!crypto.checkAddress(address, this.config.address_type)[0];
    }

    async resetNonce() {
        console.log('resetting nonce');
        this.nonce = await this.api.rpc.system.accountNextIndex(this.sender.address);
    }

    async getNextNonce() {
        console.log('RPC retrieving nonce');
        return await this.api.rpc.system.accountNextIndex(this.sender.address);
    }

    startWithResetNonce(observable) {
        return concat(fromPromise(this.resetNonce()), observable);
    }
};
