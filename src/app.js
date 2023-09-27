// Load up the discord.js library
const config = require("./config");
const { Client,Collection, Events, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds ] });

client.commands=new Collection();
const faucetCmd = require('./commands/faucetCommand');
const commands = [
	faucetCmd,
];

for(let i=0;i<commands.length;i++){
	const command = commands[i]
	if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		console.log('setting command=', command.data.name)
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
}

client.on("ready", () => {
    // This event will run if the bot starts, and logs in, successfully.
    console.log(`Faucet Bot has started now`);
    // Example of changing the bot's playing game to something useful. `client.user` is what the
    // docs refer to as the "ClientUser".
    //client.user.setActivity(`...`, { type: 'WATCHING' });
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing ${interaction.commandName}`);
		console.error(error);
	}
});



console.log("starting bot client")