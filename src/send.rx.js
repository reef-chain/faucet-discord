import {startWith} from "rxjs";
import {sendBroadcast, sendError, sendFinalized, sendInBlock, sendIndexed, sendReady} from "./interaction.rx";
import {shareReplay} from "rxjs";

const {
    Subject, of, mergeMap, map, catchError, take, filter, tap, partition, EMPTY, share, concat,
    distinctUntilChanged, combineLatest, timer, scan, switchScan, pluck, from
} = require('rxjs')
const cache = require("./cache");

const getNextNonceFnObs = (api, address) => {
    const nextNonceSubj = new Subject();

    const nextNonce$ = nextNonceSubj.pipe(
        startWith(true),
        switchScan((state, reset) => {
            if (reset || state == null) {
                return from(api.rpc.system.accountNextIndex(address)).pipe(map(n => {
                    return ({nonce: n.toNumber(), reset, time: new Date()})
                }), take(1));
            }
            return of({nonce: state.nonce + 1, reset: false, time: new Date()});
        }, null)
    );

    return [
        (reset) => nextNonceSubj.next(reset),
        nextNonce$,
    ];
}

export const getSend_nonce$ = (api, sender, amount, addressInteraction$) => {

    const [emitNextNonceFn, nextNonce$] = getNextNonceFnObs(api, sender.address);
    const nonce$ = nextNonce$.pipe(share());

    const send$ = combineLatest([nonce$, addressInteraction$]).pipe(
        scan((state, [sNextNonceObj, sNextInter]) => {
            const {nonce: sNextNonce, reset: nonceReset} = sNextNonceObj;
            const newState = {...state};

            let nextInterSavedToSendInd = newState.sendToInterArr.indexOf(sNextInter);
            let nextInterAlreadySentInd = newState.alreadySentInter.indexOf(sNextInter);
            const isNewNextInter = nextInterAlreadySentInd < 0 && nextInterSavedToSendInd < 0;
            const isNewNextNonce = newState.lastNonce < sNextNonce || (nonceReset && !isNewNextInter);

            // remove previous send request on new nonce (new nonce set after send request sent to chain)
            let prevSendIdx = newState.sendToInterArr.indexOf(newState.sendNextInter);
            if (prevSendIdx > -1 && isNewNextNonce) {
                //remove previous send from state
                newState.sendToInterArr = newState.sendToInterArr.filter(v => v !== newState.sendNextInter);
                newState.alreadySentInter = [...newState.alreadySentInter, newState.sendNextInter];
                // console.log('REMOVED=',!!newState.sendNextInter, ' left=',newState.sendToInterArr.length);
                newState.sendNextInter = null;
                newState.sendNextNonce = null;
            }

            // add new request to array buffer
            if (isNewNextInter) {
                cache.startDelayCountdown(sNextInter.userId);
                // console.log('add NEW len=', newState.sendToInterArr.length);
                newState.sendToInterArr = [...newState.sendToInterArr, sNextInter];
            }

            // set new nonce as last
            if (isNewNextNonce) {
                newState.lastNonce = sNextNonce;
            }

            // check if nonce is new and ready to make next request from buffer array
            newState.send = false;
            if ((isNewNextNonce || newState.lastNonce === sNextNonce) && !newState.sendNextNonce && !newState.sendNextInter && newState.sendToInterArr.length) {
                newState.send = true;
                newState.sendNextInter = newState.sendToInterArr.find(v => !!v);
                newState.sendNextNonce = sNextNonce;
            }

            return newState;

        }, {
            sendNextNonce: null,
            sendNextInter: null,
            sendToInterArr: [],
            alreadySentInter: [],
            lastNonce: null,
            send: true
        }),
        // tap(s=>console.log('sendNextInter=',s)),
        filter(v => !!v.sendNextInter && v.send),
        // tap(s=>console.log('1after FILTER sendNextNonce=',s.sendNextNonce, s.send)),
        distinctUntilChanged((s1, s2) => s1.sendNextInter === s2.sendNextInter && s1.sendNextNonce === s2.sendNextNonce && s1.send === s2.send),
        // tap(s=>console.log('sendingSTART=',s?.sendNextNonce)),
        mergeMap(async ({sendNextNonce, sendNextInter}) => {
            const address = sendNextInter.address;

            try {
                const unsubs = await api.tx.balances.transferKeepAlive(address, amount).signAndSend(sender, {nonce: sendNextNonce}, async (txUpdate) => {
                    // console.log('val=', txUpdate.status.toHuman());

                    if (txUpdate.isError) {
                        unsubs();
                        console.log('tx SEND ERROR=', txUpdate.toHuman());
                        await sendError(sendNextInter.interaction);
                        emitNextNonceFn(true);
                        return;
                    }
                    let stat = txUpdate.status.toHuman();
                    if (typeof stat === 'string' && stat.toLowerCase() === 'ready') {
                        await sendReady(sendNextInter.interaction);
                        emitNextNonceFn(false);
                        return;
                    }
                    if (stat.hasOwnProperty('Broadcast')) {
                        await sendBroadcast(sendNextInter.interaction);
                        return;
                    }
                    if (stat.hasOwnProperty('InBlock')) {
                        await sendInBlock(sendNextInter.interaction);
                        return;
                    }
                    if (stat.hasOwnProperty('Finalized')) {
                        unsubs();
                        await sendFinalized(sendNextInter.interaction);

                        setTimeout(async () => await sendIndexed(sendNextInter.interaction, txUpdate.txHash.toHuman()), 12000);
                    }
                });
            } catch (e) {
                console.log('ERR0=', e.message);
                emitNextNonceFn(true);
                await sendError(sendNextInter.interaction);
            }
        }),

        catchError((err, caught) => {
                console.log('ERR1 =', err.message);
                return caught;
            }
        )
    );
    return [send$, nonce$];
}
