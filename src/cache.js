const LRU = require("lru-cache");
const config = require("./config");

const cache = new LRU();
const discordBotAdminUserId = '467291448254005259';

const enoughTimePassed = (userId)=> !cache.has(userId) || userId === discordBotAdminUserId;

const startDelayCountdown = (userId)=>cache.set(userId, 1, 1000 * 60 * 60 * config.limit);


const endDelayCountdown = (userId)=>cache.del(userId);


module.exports = {
    enoughTimePassed,
    startDelayCountdown,
    endDelayCountdown
}
