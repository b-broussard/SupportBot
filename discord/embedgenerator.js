"use strict";
const Discord = require("discord.js");
//let ta = require("time-ago")();
const UTILS = new (require("../utils.js"))();
module.exports = class EmbedGenrator {
	constructor() { }
	test() {
		let newEmbed = new Discord.RichEmbed();
		newEmbed.setTitle("Test");
		newEmbed.setDescription("description");
		return newEmbed;
	}
	summoner(CONFIG, apiobj) {
		let newEmbed = new Discord.RichEmbed();
		newEmbed.setAuthor(apiobj.name);
		newEmbed.setThumbnail(CONFIG.STATIC.S_ICONS + apiobj.profileIconId + ".png");
		newEmbed.setDescription("Level " + apiobj.summonerLevel + "\nSummoner ID: " + apiobj.id + "\nAccount ID: " + apiobj.accountId);
		newEmbed.setTimestamp(new Date(apiobj.revisionDate));
		newEmbed.setFooter("Last change detected at ");
		return newEmbed;
	}
	detailedSummoner(CONFIG, summoner, ranks) {
		let newEmbed = new Discord.RichEmbed();
		newEmbed.setAuthor(summoner.name);
		newEmbed.setThumbnail(CONFIG.STATIC.S_ICONS + summoner.profileIconId + ".png");
		newEmbed.setDescription("Level " + summoner.summonerLevel + "\nSummoner ID: " + summoner.id + "\nAccount ID: " + summoner.accountId);
		newEmbed.setTimestamp(new Date(summoner.revisionDate));
		newEmbed.setFooter("Last change detected at ");
		return newEmbed;
	}
}
