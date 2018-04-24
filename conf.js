//exports.port = 6611;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bLight = true;
exports.bSingleAddress = true;

// Database
exports.storage = 'sqlite';

exports.bIgnoreUnpairRequests = true;
exports.hub = 'byteball.org/bb';
exports.deviceName = 'WCG-distribution';
exports.permanent_pairing_secret = '0000';
exports.control_addresses = [''];


exports.daysBetweenDistributions = 7;
exports.WCGpointToDollar = 1 / 200000;
exports.labelAsset="WCG";
exports.prefixForName = "Byteball_";

exports.isMultiLingual = true;


exports.languagesAvailable = {
	en: {
		name: "English"
	},
	da: {
		name: "Dansk"
	},
	fr: {
		name: "Français"
	},
	zn: {
		name: "中文"
	},
	ja: {
		name: "日本語"
	},
	es: {
		name: "Español"
	},
	de: {
		name: "Deutsch"
	},
	ko: {
		name: "한국어"
	},
	id: {
		name: "Bahasa Indonesia"
	},
	it: {
		name: "Italiano"
	},
	ru: {
		name: "Русский"
	}
};


console.log('finished WCG bot conf');