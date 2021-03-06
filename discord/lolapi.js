"use strict";
const UTILS = new (require("../utils.js"))();
const fs = require("fs");
const REQUEST = require("request");
const agentOptions = { ca: fs.readFileSync("../data/keys/ca.crt") };
module.exports = class LOLAPI {
	constructor(INIT_CONFIG, request_id) {
		this.CONFIG = INIT_CONFIG;
		this.request_id = request_id;
		if (!UTILS.exists(this.CONFIG)) throw new Error("config.json required to access riot api.");
		else if (!UTILS.exists(this.CONFIG.RIOT_API_KEY) || this.CONFIG.RIOT_API_KEY === "") throw new Error("config.json RIOT_API_KEY required to access riot api.");
		this.request = REQUEST;
		this.address = "https://" + this.CONFIG.API_ADDRESS;
		this.port = this.CONFIG.API_PORT;
	}
	ping() {
		return new Promise((resolve, reject) => {
			const now = new Date().getTime();
			this.getIAPI("ping", {}).then(answer => {
				answer.started = now;
				answer.ended = new Date().getTime();
				resolve(answer);
			}).catch(reject);
		});
	}
	get(region, path, options, cachetime, maxage) {
		let that = this;
		return new Promise((resolve, reject) => {
			UTILS.assert(UTILS.exists(region));
			UTILS.assert(UTILS.exists(cachetime));
			UTILS.assert(UTILS.exists(maxage));
			let url = "https://" + region + ".api.riotgames.com/lol/" + path + "?api_key=";
			for (let i in options) {
				url += "&" + i + "=" + encodeURIComponent(options[i]);
			}
			//UTILS.output("IAPI req sent: " + url.replace(that.CONFIG.RIOT_API_KEY, ""));
			url = this.address + ":" + this.port + "/lol/" + region + "/" + cachetime + "/" + maxage + "/" + this.request_id + "/?k=" + encodeURIComponent(this.CONFIG.API_KEY) +"&url=" + encodeURIComponent(url);
			this.request({ url, agentOptions }, (error, response, body) => {
				if (UTILS.exists(error)) {
					reject(error);
				}
				else {
					try {
						const answer = JSON.parse(body);
						if (UTILS.exists(answer.status)) UTILS.output(url + " : " + body);
						resolve(answer);
					}
					catch (e) {
						reject(e);
					}
				}
			});
		});
	}
	getIAPI(path, options, response_expected = true) {//get internal API
		let that = this;
		options.k = this.CONFIG.API_KEY;
		return new Promise((resolve, reject) => {
			let url = this.address + ":" + this.port + "/" + path;
			let paramcount = 0;
			for (let i in options) {
				if (paramcount == 0) url += "?" + i + "=" + encodeURIComponent(options[i]);
				else url += "&" + i + "=" + encodeURIComponent(options[i]);
				++paramcount;
			}
			this.request({ url , agentOptions }, (error, response, body) => {
				if (!response_expected) {
					resolve();
					return;
				}
				if (UTILS.exists(error)) {
					reject(error);
				}
				else if (response.statusCode !== 200) {
					reject(response.statusCode);
				}
				else {
					try {
						const answer = JSON.parse(body);
						UTILS.output("IAPI req: " + url);
						resolve(answer);
					}
					catch (e) {
						reject(e);
					}
				}
			});
		});
	}
	getStatic(path) {//data dragon
		return new Promise((resolve, reject) => {
			let url = "https://ddragon.leagueoflegends.com/" + path;
			this.request(url, function (error, response, body) {
				if (error != undefined && error != null) {
					reject(error);
				}
				else {
					try {
						const answer = JSON.parse(body);
						if (UTILS.exists(answer.status)) UTILS.output(url + " : " + body);
						else UTILS.output(url);
						resolve(answer);
					}
					catch (e) {
						reject(e);
					}
				}
			});
		});
	}
	getStaticChampions(region) {
		UTILS.output("STATIC CHAMPIONS: " + region);
		return this.get(region, "static-data/v3/champions", { locale: "en_US", dataById: true, tags: "all" }, this.CONFIG.API_CACHETIME.STATIC_CHAMPIONS, this.CONFIG.API_CACHETIME.STATIC_CHAMPIONS);
	}
	getStaticChampionsNew(region, locale = "en_US") {
		UTILS.output("STATIC CHAMPIONS: " + region);
		return new Promise((resolve, reject) => {
			this.getStatic("realms/" + this.CONFIG.REGIONS_REVERSE[region].toLowerCase() + ".json").then(realm => {
				this.getStatic("cdn/" + realm.v + "/data/" + locale + "/champion.json").then(cd => {//champion data
					for (let b in cd.data) {
						cd.data[cd.data[b].key] = cd.data[b];//add key as duplicate of data
						delete cd.data[b];//delete original
					}
					resolve(cd);
				}).catch(reject);
			}).catch(reject);
		});
	}
	getStaticSummonerSpells(region) {
		UTILS.output("STATIC SPELLS: " + region);
		return this.get(region, "static-data/v3/summoner-spells", { locale: "en_US", dataById: true, spellListData: "all", tags: "all" }, this.CONFIG.API_CACHETIME.STATIC_SPELLS, this.CONFIG.API_CACHETIME.STATIC_SPELLS);
	}
	getStaticSummonerSpellsNew(region, locale = "en_US") {
		UTILS.output("STATIC SPELLS: " + region);
		return new Promise((resolve, reject) => {
			this.getStatic("realms/" + this.CONFIG.REGIONS_REVERSE[region].toLowerCase() + ".json").then(realm => {
				this.getStatic("cdn/" + realm.v + "/data/" + locale + "/summoner.json").then(sd => {//spell data
					for (let b in sd.data) {
						sd.data[sd.data[b].key] = sd.data[b];//add key as duplicate of data
						delete sd.data[b];//delete original
					}
					resolve(sd);
				}).catch(reject);
			}).catch(reject);
		});
	}
	getSummonerIDFromName(region, username, maxage) {
		return this.get(region, "summoner/v3/summoners/by-name/" + encodeURIComponent(username), {}, this.CONFIG.API_CACHETIME.GET_SUMMONER_ID_FROM_NAME, maxage);
	}
	getMultipleSummonerIDFromName(region, usernames, maxage) {
		let that = this;
		let requests = [];
		if (this.CONFIG.API_SEQUENTIAL) {
			for (let i in usernames) requests.push(function () { return that.getSummonerIDFromName(region, usernames[i], maxage); });
			return UTILS.sequential(requests);
		}
		else {
			for (let i in usernames) requests.push(that.getSummonerIDFromName(region, usernames[i], maxage));
			return Promise.all(requests);
		}
	}
	getSummonerFromSummonerID(region, id, maxage) {
		if (id === null) return new Promise((resolve, reject) => { resolve({}); });
		return this.get(region, "summoner/v3/summoners/" + id, {}, this.CONFIG.API_CACHETIME.GET_SUMMONER_FROM_SUMMONER_ID, maxage);
	}
	getMultipleSummonerFromSummonerID(region, ids, maxage) {
		let that = this;
		let requests = [];
		if (this.CONFIG.API_SEQUENTIAL) {
			for (let i in ids) requests.push(function () { return that.getSummonerFromSummonerID(region, ids[i], maxage); });
			return UTILS.sequential(requests);
		}
		else {
			for (let i in ids) requests.push(that.getSummonerFromSummonerID(region, ids[i], maxage));
			return Promise.all(requests);
		}
	}
	getRanks(region, summonerID, maxage) {
		if (summonerID === null) return new Promise((resolve, reject) => { resolve([]); });
		return this.get(region, "league/v3/positions/by-summoner/" + summonerID, {}, this.CONFIG.API_CACHETIME.GET_RANKS, maxage);
	}
	getMultipleRanks(region, summonerIDs, maxage) {
		let that = this;
		let requests = [];
		for (let i in summonerIDs) requests.push(that.getRanks(region, summonerIDs[i], maxage));
		return Promise.all(requests);
	}
	getChampionMastery(region, summonerID, maxage) {
		if (summonerID === null) return new Promise((resolve, reject) => { resolve([]); });
		return this.get(region, "champion-mastery/v3/champion-masteries/by-summoner/" + summonerID, {}, this.CONFIG.API_CACHETIME.GET_CHAMPION_MASTERY, maxage);
	}
	getMultipleChampionMastery(region, summonerIDs, maxage) {
		let that = this;
		let requests = [];
		for (let i in summonerIDs) requests.push(that.getChampionMastery(region, summonerIDs[i], maxage));
		return Promise.all(requests);
	}
	getRecentGames(region, accountID, maxage) {
		return this.get(region, "match/v3/matchlists/by-account/" + accountID, { endIndex: 20 }, this.CONFIG.API_CACHETIME.GET_RECENT_GAMES, maxage);
	}
	getMultipleRecentGames(region, accountIDs, maxage) {
		let that = this;
		let requests = [];
		if (this.CONFIG.API_SEQUENTIAL) {
			for (let i in accountIDs) requests.push(function () { return that.getRecentGames(region, accountIDs[i], maxage); });
			return UTILS.sequential(requests);
		}
		else {
			for (let i in accountIDs) requests.push(that.getRecentGames(region, accountIDs[i], maxage));
			return Promise.all(requests);
		}
	}
	getMatchInformation(region, gameID, maxage) {
		return this.get(region, "match/v3/matches/" + gameID, {}, this.CONFIG.API_CACHETIME.GET_MATCH_INFORMATION, maxage);
	}
	getMultipleMatchInformation(region, gameIDs, maxage) {
		let that = this;
		let requests = [];
		if (this.CONFIG.API_SEQUENTIAL) {
			for (let i in gameIDs) requests.push(function () { return that.getMatchInformation(region, gameIDs[i], maxage); });
			return UTILS.sequential(requests);
		}
		else {
			for (let i in gameIDs) requests.push(that.getMatchInformation(region, gameIDs[i], maxage));
			return Promise.all(requests);
		}
	}
	getLiveMatch(region, summonerID, maxage) {
		return this.get(region, "spectator/v3/active-games/by-summoner/" + summonerID, {}, this.CONFIG.API_CACHETIME.GET_LIVE_MATCH, maxage);
	}
	getMMR(region, summonerID, maxage) {
		return this.get(region, "league/v3/mmr-af/by-summoner/" + summonerID, {}, this.CONFIG.API_CACHETIME.GET_MMR, maxage);
	}
	getStatus(region, maxage) {
		return this.get(region, "status/v3/shard-data", {}, this.CONFIG.API_CACHETIME.GET_STATUS, maxage);
	}
	getChallengerRanks(region, queue, maxage) {
		return this.get(region, "league/v3/challengerleagues/by-queue/" + queue, {}, this.CONFIG.API_CACHETIME.GET_CHALLENGERS, maxage);
	}
	getSummonerCard(region, username) {
		const that = this;
		return new Promise((resolve, reject) => {
			that.getSummonerIDFromName(region, username, this.CONFIG.API_MAXAGE.SUMMONER_CARD.SUMMONER_ID).then(result => {
				result.region = region;
				result.guess = username;
				if (!UTILS.exists(result.id)) reject();
				that.getRanks(region, result.id, this.CONFIG.API_MAXAGE.SUMMONER_CARD.RANKS).then(result2 => {
					Promise.all(result2.map(r => that.getChallengerRanks(region, r.queueType, this.CONFIG.API_MAXAGE.SUMMONER_CARD.CHALLENGERS))).then(result5 => {
						that.getChampionMastery(region, result.id, this.CONFIG.API_MAXAGE.SUMMONER_CARD.CHAMPION_MASTERY).then(result3 => {
							that.getLiveMatch(region, result.id, this.CONFIG.API_MAXAGE.SUMMONER_CARD.LIVE_MATCH).then(result4 => {
								resolve([result, result2, result3, result4, result5]);
							}).catch(reject);
						}).catch(reject);
					}).catch(reject);
				}).catch(reject);
			}).catch(reject);
		});
	}
	clearCache() {
		const filenames = fs.readdirSync("./data/static-api-cache/");
		for (let b in filenames) {
			fs.unlinkSync("./data/static-api-cache/" + filenames[b]);
		}
	}
	createShortcut(uid, from, to) {
		return this.getIAPI("createshortcut/" + uid, { from, to });
	}
	removeShortcut(uid, from) {
		return this.getIAPI("removeshortcut/" + uid, { from });
	}
	removeAllShortcuts(uid) {
		return this.getIAPI("removeallshortcuts/" + uid);
	}
	getShortcut(uid, from) {
		return this.getIAPI("getshortcut/" + uid, { from });
	}
	getShortcuts(uid) {
		return this.getIAPI("getshortcuts/" + uid, {});
	}
	terminate() {
		this.getIAPI("terminate_request/" + this.request_id, {}, false).catch();
	}
	IAPIEval(script) {
		return this.getIAPI("eval/" + encodeURIComponent(script), {});
	}
	getLink(uid) {
		return this.getIAPI("getlink/" + uid, {});
	}
	setLink(uid, username) {
		return this.getIAPI("setlink/" + uid, { link: username });
	}
	banUser(uid, reason, date, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("ban", { id: uid, user: true, date, reason, issuer, issuer_tag, issuer_avatarURL });
	}
	banServer(sid, reason, date, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("ban", { id: sid, user: false, date, reason, issuer, issuer_tag, issuer_avatarURL });
	}
	warnUser(uid, reason, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("warn", { id: uid, user: true, reason, issuer, issuer_tag, issuer_avatarURL, notify: true });
	}
	warnServer(sid, reason, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("warn", { id: sid, user: false, reason, issuer, issuer_tag, issuer_avatarURL, notify: true });
	}
	noteUser(uid, reason, issuer) {
		return this.getIAPI("warn", { id: uid, user: true, reason, issuer, notify: false });
	}
	noteServer(sid, reason, issuer) {
		return this.getIAPI("warn", { id: sid, user: false, reason, issuer, notify: false });
	}
	unbanUser(uid, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("unban", { id: uid, user: true, issuer, issuer_tag, issuer_avatarURL });
	}
	unbanServer(sid, issuer, issuer_tag, issuer_avatarURL) {
		return this.getIAPI("unban", { id: sid, user: false, issuer, issuer_tag, issuer_avatarURL });
	}
	userHistory(uid, complete = false) {
		return complete ? this.getIAPI("gethistory", { id: uid, user: true }) : this.getIAPI("gethistory", { id: uid, user: true, limit: 10 });
	}
	serverHistory(sid, complete = false) {
		return complete ? this.getIAPI("gethistory", { id: sid, user: false }) : this.getIAPI("gethistory", { id: sid, user: false, limit: 10 });
	}
	getActions(uid, complete = false) {
		return complete ? this.getIAPI("getactions", { id: uid }) : this.getIAPI("getactions", { id: uid, limit: 10 });
	}
	getPreferences(sid) {
		return this.getIAPI("getpreferences", { id: sid });
	}
	setPreferences(sid, prop, val, type) {
		return this.getIAPI("setpreferences", { id: sid, prop, val, type });
	}
}
