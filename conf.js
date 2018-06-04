//exports.port = 6611;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bLight = true;
exports.bSingleAddress = true;

// Database
exports.storage = 'sqlite';

exports.bIgnoreUnpairRequests = true;
exports.hub = 'byteball.org/bb';
exports.deviceName = 'WCG distribution';
exports.permanent_pairing_secret = '0000';
exports.control_addresses = [''];


exports.daysBetweenDistributions = 1;
exports.WCGpointToDollar = 1 / 150000;
exports.labelAsset="WCG";
exports.prefixForName = "Byteball_";

exports.arrayInitialRewards = [
	{threshold: 1e5, rewardInDollars: 0.2},
	{threshold: 1e6, rewardInDollars: 3},
	{threshold: 10e6, rewardInDollars: 40},
	{threshold: 100e6, rewardInDollars: 150}
];

exports.isMultiLingual = true;

exports.languagesAvailable = {
	en: {name: "English", file: "en"},
	da: {name: "Dansk", file: "wcg-bot_da-DK"},
	de: {name: "Deutsch", file: "wcg-bot_de-DE"},
	es: {name: "Español", file: "wcg-bot_es-ES"},
	et: {name: "Eesti", file: "wcg-bot_et-EE"},
	fr: {name: "Français", file: "wcg-bot_fr-FR"},
	hi: {name: "हिन्दी", file: "wcg-bot_hi-IN"},
	hu: {name: "Magyar", file: "wcg-bot_hu-hu"},
	id: {name: "Bahasa Indonesia", file: "wcg-bot_id-ID"},
	it: {name: "Italiano", file: "wcg-bot_it-IT"},
	ja: {name: "日本語", file: "wcg-bot_ja-JP"},
	ko: {name: "한국어", file: "wcg-bot_ko-KR"},
	nl: {name: "Nederlands", file: "wcg-bot_nl-NL"},
	ru: {name: "Русский", file: "wcg-bot_ru-RU"},
	tl: {name: "Tagalog", file: "wcg-bot_tl-PH"},
	uk: {name: "Українська", file: "wcg-bot_uk-UA"},
	zh: {name: "中文", file: "wcg-bot_zh-CN"}
};

console.log('finished WCG bot conf');