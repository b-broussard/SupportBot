"use strict";
const start_time = new Date().getTime();

const fs = require("fs");
const argv_options = new (require("getopts"))(process.argv.slice(2), {
	alias: { c: ["config"] },
	default: { c: "config.json" }});
const Discord = require("discord.js");
let discordcommands = require("./discordcommands.js");

const UTILS = new (require("../utils.js"))();

const client = new Discord.Client({ disabledEvents: ["TYPING_START"] });

let CONFIG;
try {
	CONFIG = JSON.parse(fs.readFileSync("../" + argv_options.config, "utf-8"));
	CONFIG.VERSION = "v1.4.0";//b for non-release (in development)
	CONFIG.BANS = {};
}
catch (e) {
	console.log("something's wrong with config.json");
	console.error(e);
	process.exit(1);
}
const mode = process.env.NODE_ENV === "production" ? "PRODUCTION:warning:" : process.env.NODE_ENV;
const LOLAPI = new (require("./lolapi.js"))(CONFIG, 0);
let STATUS = {
	CHAMPION_EMOJIS: false
};
const wsapi = new (require("./wsapi.js"))(CONFIG, client, STATUS);
const Preferences = require("./preferences.js");
loadAllStaticResources(() => {
	UTILS.output(process.env.NODE_ENV === "production" ? "PRODUCTION LOGIN" : "DEVELOPMENT LOGIN");
	client.login().catch(console.error);
});
let initial_start = true;
client.on("ready", function () {
	UTILS.output(initial_start ? "discord user login success" : "discord reconnected");
	if (process.env.SHARD_ID == 0) {
		client.user.setStatus("idle").catch(console.error);
		client.user.setActivity("Starting Up").catch(console.error);
	}
	sendToChannel(CONFIG.LOG_CHANNEL_ID, initial_start ? ":repeat:`$" + process.env.SHARD_ID + "`Bot started in " + UTILS.round((new Date().getTime() - start_time) / 1000, 0) + "s: version: " + CONFIG.VERSION + " mode: " + mode + " servers: " + client.guilds.size : ":repeat:`$" + process.env.SHARD_ID + "`Bot reconnected");
	wsapi.sendEmojis(allEmojis());
	wsapi.getUserBans();
	wsapi.getServerBans();
	for (let b in CONFIG.STATIC.CHAMPIONS) CONFIG.STATIC.CHAMPIONS[b].emoji = CONFIG.STATIC.CHAMPIONS[b].name;
	UTILS.output("default champion emojis set");
	initial_start = false;
});
client.on("disconnect", function () {
	UTILS.output("discord disconnected");
});
client.on("message", function (msg) {
	try {
		const ACCESS_LEVEL = UTILS.accessLevel(CONFIG, msg);
		new Preferences(LOLAPI, msg.guild, server_preferences => discordcommands(CONFIG, client, msg, wsapi, sendToChannel, server_preferences, ACCESS_LEVEL));
	}
	catch (e) {
		console.error(e);
	}
});
client.on("guildCreate", function (guild) {
	UTILS.output("Server Joined: " + guild.id + " :: " + guild.name + " :: Population=" + guild.memberCount + " :: " + guild.owner.user.tag);
	sendToChannel(CONFIG.LOG_CHANNEL_ID, ":white_check_mark:`$" + process.env.SHARD_ID + "`Server Joined: `" + guild.id + "` :: " + guild.name + " :: Population=" + guild.memberCount + " :: " + guild.owner.user.tag);
	guild.owner.send("SupportBot has joined your server: " + guild.name + "\nUse `Lhelp` for information on how to use SupportBot.\nAdd SupportBot to other servers using this link: <" + CONFIG.BOT_ADD_LINK + ">\nSupportBot is a work in progress! Help us improve supportbot by sending us your feedback at " + CONFIG.HELP_SERVER_INVITE_LINK).catch(e => console.error(e));
	let candidate = UTILS.preferredTextChannel(client, guild.channels, "text", UTILS.defaultChannelNames(), ["VIEW_CHANNEL", "SEND_MESSAGES"]);
	if (UTILS.exists(candidate)) candidate.send("Use `Lhelp` for information on how to use SupportBot.\nAdd SupportBot to other servers using this link: <" + CONFIG.BOT_ADD_LINK + ">\nSupportBot is a work in progress! Help us improve supportbot by sending us your feedback at " + CONFIG.HELP_SERVER_INVITE_LINK).catch();
});
client.on("guildDelete", function(guild) {
	UTILS.output("Server Left: " + guild.id + " :: " + guild.name + " :: Population=" + guild.memberCount + " :: " + guild.owner.user.tag);
	sendToChannel(CONFIG.LOG_CHANNEL_ID, ":x:`$" + process.env.SHARD_ID + "`Server Left: `" + guild.id + "` :: " + guild.name + " :: Population=" + guild.memberCount + " :: " + guild.owner.user.tag);
});
function sendToChannel(cid, text) {//duplicated in discordcommands.js
	wsapi.sendTextToChannel(cid, text);
}
function loadAllStaticResources(callback = () => {}) {
	LOLAPI.getStatic("realms/na.json").then(result => {//load static dd version
		UTILS.output("DD STATIC RESOURCES LOADED");
		CONFIG.STATIC = result;
		let temp_regions = [];
		for (let i in CONFIG.REGIONS) temp_regions.push(CONFIG.REGIONS[i]);
		Promise.all(temp_regions.map(tr => LOLAPI.getStaticChampionsNew(tr))).then(results => {
			CONFIG.STATIC.CHAMPIONS = results[0].data;
			LOLAPI.getStaticSummonerSpellsNew("na1").then(result => {
				CONFIG.STATIC.SUMMONERSPELLS = result.data;
				for (let b in CONFIG.STATIC.CHAMPIONS) CONFIG.STATIC.CHAMPIONS[b].emoji = CONFIG.STATIC.CHAMPIONS[b].name;
				UTILS.output("API STATIC RESOURCES LOADED");
				wsapi.sendEmojis(allEmojis());
				callback();
			});
		}).catch(e => { throw e; });
	}).catch(e => { throw e; });
}
setInterval(() => {//long term maintenance loop
	loadAllStaticResources();
	wsapi.getUserBans();
	wsapi.getServerBans();
	setStatus();
}, 60000 * 15);
function allEmojis() {
	let all_emojis = [];//collects all emojis from emoji servers
	for (let i in CONFIG.CHAMP_EMOJI_SERVERS) {
		const candidate = client.guilds.get(CONFIG.CHAMP_EMOJI_SERVERS[i]);
		if (UTILS.exists(candidate)) all_emojis = all_emojis.concat(candidate.emojis.array());
	}
	return all_emojis.map(e => { return { name: e.name.toLowerCase(), code: e.toString() }; });
}
function setStatus() {
	if (STATUS.CHAMPION_EMOJIS) {
		client.user.setStatus("online").catch(console.error);
		client.user.setActivity("League of Legends").catch(console.error);
	}
	else {
		for (let b in STATUS) UTILS.output("Service Degraded, check status: " + b);
		client.user.setStatus("idle").catch(console.error);
		client.user.setActivity("Service Degraded").catch(console.error);
	}
}
