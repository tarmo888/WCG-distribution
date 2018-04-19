/*jslint node: true */
"use strict";
const async = require('async');
const i18nModule = require("i18n");
const request = require('request');
const xml2js = require('xml2js');
const fs = require('fs');
const eventBus = require('byteballcore/event_bus.js');
const headlessWallet = require('headless-byteball');
const desktopApp = require('byteballcore/desktop_app.js');
const notifications = require('./modules/notifications.js');
const randomCryptoString = require('./modules/random-crypto-string');
const conf = require('byteballcore/conf.js');
const db = require('byteballcore/db.js');
const validationUtils = require("byteballcore/validation_utils.js");
const conversion = require('./modules/conversion');

const daysBetweenDistributions = 1;
const WCGpointToDollar = 1 / 20000000;

//values used to create outputs at start
const minBytesOutputsAvailable = 100;
const amountBytesOutputs = 5000;
const amountAssetOutputs = 100000;

const prefixForName = "Byteball_";
const isMultiLingual = true;

const languagesAvailable = {
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
	}
}


var my_address;
var arrPeers = [];
var honorificAsset;
var labelAsset="WCG";

if (isMultiLingual) {
	var arrLanguage = [];
	for (var index in languagesAvailable) {
		arrLanguage.push(index);
	}
}

i18nModule.configure({
	locales: arrLanguage,
	directory: __dirname + '/locales'
});


function processTxt(from_address, text) {
	var device = require('byteballcore/device.js');
	text = text.trim();

	if (!arrPeers[from_address]) {
		arrPeers[from_address] = {
			step: "home"
		};
	}

	db.query(
		"SELECT lang,salt,id,id_wcg,payout_address,account_name FROM users WHERE device_address == ? ", [from_address],
		function(user) {

			if (user[0]) {

				var i18n = {};
				i18nModule.init(i18n);

				if (user[0].lang != 'unknown') {
					i18nModule.setLocale(i18n, user[0].lang);
				}


				/*
				 * user selected a new language
				 */
				if (text.indexOf('selectLanguage_') == 0 && isMultiLingual) {

					if (text.split('_')[1] && languagesAvailable[text.split('_')[1]]) {
						db.query("UPDATE users SET lang=? WHERE device_address == ? ", [text.split('_')[1], from_address]);
						i18nModule.setLocale(i18n, text.split('_')[1]);
						device.sendMessageToDevice(from_address, 'text', "➡ " + getTxtCommandButton("Go back to language selection", "selectLanguage"));
					}

				}


				/*
				 * If unknown language then we propose to select one
				 */
				if ((user[0].lang === 'unknown' || text ==="selectLanguage") && isMultiLingual) {
					device.sendMessageToDevice(from_address, 'text', getLanguagesSelection());
					return;
				}

				/*
				 * If admin authorized a distribution
				 */

				if (text.indexOf("distribute_") > -1 && headlessWallet.isControlAddress(from_address)) {
					db.query("UPDATE distributions SET is_authorized=1 WHERE id = ?", [Number(text.split("_")[1])], function() {
						processAnyAuthorizedDistribution();
						device.sendMessageToDevice(from_address, 'text', "Distribution id " + text.split("_")[1] + " authorized");
					});
				}


				/*
				 * Return home if cancel command 
				 */
				if (text == "cancel") {
					arrPeers[from_address].step = "home";
				}

				/*
				 * Treat check account command
				 */

				if (text == "checkAndLinkAccount") {

					checkAndLinkAccount(prefixForName + user[0].salt + user[0].id, from_address, i18n, function(returnedTxt) {
						device.sendMessageToDevice(from_address, 'text', returnedTxt);
					});
					return;
				}

				/*
				 * If no WCG account registered or user requested to register a new one
				 */
				if (!user[0].id_wcg || text == "linkAccount") {
					var returnedTxt = i18n.__("Please create a World Community Grid account or modify an existing one with this username: {{username}} ", {
						username: prefixForName + user[0].salt + user[0].id
					});
					returnedTxt += "\n" + i18n.__("You can change it later if you desire. Click on the link below when done.");
					returnedTxt += "\n➡ " + getTxtCommandButton(i18n.__("Check my account"), "checkAndLinkAccount");
					device.sendMessageToDevice(from_address, 'text', returnedTxt);
					return;
				}


				/*
				 * If  insert address step
				 */

				if (arrPeers[from_address].step == "insertAddress") {
					if (validationUtils.isValidAddress(text.trim())) {
						db.query("UPDATE users SET payout_address=? WHERE device_address == ? ", [text.trim(), from_address], function() {
							arrPeers[from_address].step = "home";
							device.sendMessageToDevice(from_address, 'text', i18n.__("Congratulations!") + " " + getSetupCompletedMessage());
						});
					} else {
						device.sendMessageToDevice(from_address, 'text', i18n.__("This is not a valid address.") + "\n" + i18n.__(getMessageInsertAddress()));
					}
					return;
				}


				/*
				 * If no address set for payout
				 */
				if (!user[0].payout_address || text == "changePayoutAddress") {
					arrPeers[from_address].step = "insertAddress";
					device.sendMessageToDevice(from_address, 'text', i18n.__(getMessageInsertAddress()));
					return;
				}


				/*
				 * If user wants to change account name
				 */

				if (text == "changeAccountName") {
					arrPeers[from_address].step = "changeAccountName";
					device.sendMessageToDevice(from_address, 'text', i18n.__("Please enter the new name for your WCG account id {{accountID}}", {
						accountID: user[0].id_wcg
					}) + "\n➡ " + getTxtCommandButton(i18n.__("Cancel", "cancel")));
					return;
				}

				/*
				 * If expecting an account name
				 */

				if (arrPeers[from_address].step == "changeAccountName") {
					if (text.length > 30) {
						device.sendMessageToDevice(from_address, 'text', i18n.__("The name cannot exceed 30 characters."));

					} else {
						arrPeers[from_address].newName = text;
						checkAndRegisterNewName(from_address, text, user[0].id_wcg, i18n, function(returnedTxt) {
							device.sendMessageToDevice(from_address, 'text', returnedTxt);
						});
						return;

					}
				}

				/*
				 * If user requested to check again his new name
				 */

				if (text == "retryChangeName") {
					checkAndRegisterNewName(from_address, arrPeers[from_address].newName, user[0].id_wcg, i18n, function(returnedTxt) {
						device.sendMessageToDevice(from_address, 'text', returnedTxt);
					});
					return;

				}

				/*
				 * Welcome message for a complete set-up
				 */

				device.sendMessageToDevice(from_address, 'text', getSetupCompletedMessage() + "\n➡ " + getTxtCommandButton(i18n.__("Change linked WCG account"), "linkAccount") + "\n➡ " + getTxtCommandButton(i18n.__("Change payout address"), "changePayoutAddress") + "\n➡ " + getTxtCommandButton(i18n.__("Change account name"), "changeAccountName"));

				function getSetupCompletedMessage() {
					return i18n.__("Setup complete! Periodically, rewards proportional to your contribution to World Community Grid project under the account {{accountName}} (ID: {{accountID}}) will be sent to your payout account.", {
							accountName: user[0].account_name,
							accountID: user[0].id_wcg
						}) +
						"\n" + i18n.__("For more information, please visit our wiki: https://wiki.byteball.org/WCG_distribution") + "\n";
				}
			}
		});
}

function getMessageInsertAddress() {
	return "Please insert the address you want to use as payout address (click on '...' Insert my address)";
}


function checkAndRegisterNewName(from_address, newName, id_WCG, i18n, handle) {
	request({
		url: "https://www.worldcommunitygrid.org/stat/viewMemberInfo.do?userName=" + newName + "&xml=true"
	}, function(error, response, body) {
		if (error || response.statusCode !== 200) {
			arrPeers[from_address].step = "home";
			return handle(i18n.__("Error, World Community Grid seems unresponsive. Please retry later.") + "\n➡ " + getTxtCommandButton(i18n.__("retry"), "retryChangeName") + "\n➡ " + getTxtCommandButton(i18n.__("choose another account name"), "changeAccountName") + "\n➡ " + getTxtCommandButton(i18n.__("Cancel"), "cancel"));
		} else {
			xml2js.parseString(body, function(errParsing, rawObject) {
				if (errParsing) {
					arrPeers[from_address].step = "home";
					return handle(i18n.__("Check of your account failed. Please check that you set {{accountName}} as account name and retry.", {
						accountName: newName
					}) + "\n➡ " + getTxtCommandButton(i18n.__("retry"), "retryChangeName") + "\n➡ " + getTxtCommandButton(i18n.__("change for another account name"), "changeAccountName") + "\n➡ " + getTxtCommandButton(i18n.__("Cancel"), "cancel"));

				} else {
					checkAndReformatRawObject(rawObject, function(errReformating, statsObject) {
						if (errReformating) {
							notifications.notifyAdmin(errReformating, body);
							arrPeers[from_address].step = "home";
							return handle(i18n.__("An unexpected error occurred. Admin is notified. Please try again in a few hours.") + "\n" + getTxtCommandButton(i18n.__("Change my account name"), "changeAccountName") + "\n" + getTxtCommandButton(i18n.__("Cancel"), "cancel"));
						} else {

							if (id_WCG === statsObject.memberId) {
								arrPeers[from_address].step = "home";
								db.query("UPDATE users SET account_name=? WHERE id_wcg=?", [newName, id_WCG], function() {
									return handle(i18n.__("New name validated.") + "\n➡ " + getTxtCommandButton(i18n.__("Ok"), "ok"))
								});


							} else {
								arrPeers[from_address].step = "home";
								return handle(i18n.__("This name doesn't correspond to the WCG account ID {{accountID}}", {
									accountID: id_WCG
								}) + "\n➡ " + getTxtCommandButton(i18n.__("Change my account name"), "changeAccountName") + "\n" + getTxtCommandButton(i18n.__("Cancel"), "cancel"));

							}
						}

					});
				}
			});
		}
	});
}

function checkAndLinkAccount(accountName, from_address, i18n, handle) {

	request({
		url: "https://www.worldcommunitygrid.org/stat/viewMemberInfo.do?userName=" + accountName + "&xml=true"
	}, function(error, response, body) {
		if (error || response.statusCode !== 200) {
			return handle(i18n.__("Error, World Community Grid seems unresponsive. Please retry later.") + "\n" + getTxtCommandButton(i18n.__("Check my account"), "checkAndLinkAccount"));
		} else {
			xml2js.parseString(body, function(errParsing, rawObject) {
				if (errParsing) {
					return handle(i18n.__("Account check failed. Please make sure you set {{accountName}} as account name and retry.", {
						accountName: accountName
					}) + "\n➡ " + getTxtCommandButton(i18n.__("Check my account"), "checkAndLinkAccount"));

				} else {
					checkAndReformatRawObject(rawObject, function(errReformating, statsObject) {
						if (errReformating) {
							notifications.notifyAdmin(errReformating, body);
							return handle(i18n.__("There was an unexpected error, admin is notified. Please try again in a few hours.") + "\n" + getTxtCommandButton(i18n.__("Check my account"), "checkAndLinkAccount"));
						} else {

							db.takeConnectionFromPool(function(conn) {
								var arrQueries = [];
								conn.addQuery(arrQueries, "BEGIN");
								conn.addQuery(arrQueries, "UPDATE users SET id_wcg=null WHERE id_wcg=?", [statsObject.memberId]); //we remove linking for any users already using this account ID
								conn.addQuery(arrQueries, "UPDATE users SET id_wcg=?,account_name=? WHERE device_address=?", [statsObject.memberId, accountName, from_address]);
								conn.addQuery(arrQueries, "INSERT OR IGNORE INTO wcg_scores  (id_distribution, device_address, member_id, score, diff_from_previous) VALUES ((SELECT max(id) FROM distributions WHERE is_completed=1),?,?,?,0)", [from_address, statsObject.memberId, statsObject.points]);
								conn.addQuery(arrQueries, "INSERT OR IGNORE INTO wcg_meta_infos  (id_distribution, device_address, member_id, nb_devices, run_time_per_day, run_time_per_result, points_per_hour_runtime, points_per_day, points_per_result) VALUES ((SELECT max(id) FROM distributions WHERE is_completed=1),?,?,?,?,?,?,?,?)", [from_address, statsObject.memberId, statsObject.numDevices, statsObject.runTimePerDay, statsObject.runTimePerResult, statsObject.pointsPerHourRunTime, statsObject.pointsPerDay, statsObject.pointsPerResult]);
								conn.addQuery(arrQueries, "COMMIT");
								async.series(arrQueries, function() {
									conn.release();
									arrPeers[from_address].step = "insertAddress";
									return handle(i18n.__("Your WCG account is successfully linked.") + "\n" + i18n.__(getMessageInsertAddress()));

								});
							});

						}

					});

				}

			});

		}
	})
}


function checkAndReformatRawObject(rawObject, handle) {

	if (rawObject.MemberStats && rawObject.MemberStats.MemberStat && rawObject.MemberStats.MemberStat[0] &&
		rawObject.MemberStats.MemberStat[0].Name && rawObject.MemberStats.MemberStat[0].Name[0] &&
		rawObject.MemberStats.MemberStat[0].MemberId && rawObject.MemberStats.MemberStat[0].MemberId[0]) {

		var formatedObject = {
			name: rawObject.MemberStats.MemberStat[0].Name[0],
			memberId: Number(rawObject.MemberStats.MemberStat[0].MemberId[0]),
			numDevices: 0,
			points: 0,
			runTimePerDay: 0,
			runTimePerResult: 0,
			pointsPerHourRunTime: 0,
			pointsPerDay: 0,
			pointsPerResult: 0
		}

		if (rawObject.MemberStats.MemberStat[0].NumDevices && rawObject.MemberStats.MemberStat[0].NumDevices[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsTotals && rawObject.MemberStats.MemberStat[0].StatisticsTotals[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsTotals[0].Points && rawObject.MemberStats.MemberStat[0].StatisticsTotals[0].Points[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerDay && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerDay[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerResult && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerResult[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerHourRunTime && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerHourRunTime[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerDay && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerDay[0] &&
			rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerResult && rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerResult[0]) {

			formatedObject.numDevices = Number(rawObject.MemberStats.MemberStat[0].NumDevices[0]);
			formatedObject.points = Number(rawObject.MemberStats.MemberStat[0].StatisticsTotals[0].Points[0]);
			formatedObject.runTimePerDay = Number(rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerDay[0]);
			formatedObject.runTimePerResult = Number(rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].RunTimePerResult[0]);
			formatedObject.pointsPerHourRunTime = Number(rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerHourRunTime[0]);
			formatedObject.pointsPerDay = Number(rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerDay[0]);
			formatedObject.pointsPerResult = Number(rawObject.MemberStats.MemberStat[0].StatisticsAverages[0].PointsPerResult[0]);
		}


	} else {
		return handle("There was a problem with XML returned by WCG");
	}

	return handle(null, formatedObject);

}

function crawlForAnyPendingDistribution() {


	db.query("SELECT id from distributions WHERE is_crawled = 0", function(distributions) {
		if (distributions.length == 1) {
			db.query("SELECT account_name,device_address,payout_address,id_wcg from users WHERE id_wcg NOT IN (SELECT member_id FROM wcg_scores WHERE id_distribution = ?) AND account_name NOT NULL AND id_wcg NOT NULL AND has_crawl_error = 0", [distributions[0].id], function(users) {

				if (users.length == 0) {

					db.takeConnectionFromPool(function(conn) {
						var arrQueries = [];
						conn.addQuery(arrQueries, "BEGIN");
						conn.addQuery(arrQueries, "UPDATE distributions SET is_crawled=1 WHERE id = ?", [distributions[0].id]);
						conn.addQuery(arrQueries, "UPDATE users SET has_crawl_error=0");
						conn.addQuery(arrQueries, "COMMIT");
						async.series(arrQueries, function() {
							conn.release();
							sendReportToAdmin();
						});
					});

				} else {

					crawlScores(users, function() {
						crawlForAnyPendingDistribution();
					});
				}

			});
		}
	});

}

function crawlScores(users, handle) {
	if (users.length == 0) {
		return handle();
	}

	request({
		url: "https://www.worldcommunitygrid.org/stat/viewMemberInfo.do?userName=" + users[0].account_name + "&xml=true"
	}, function(error, response, body) {
		if (error || response.statusCode !== 200) {
			console.log("Error, World Community Grid seems unresponsive");
			setTimeout(function() {
				crawlScores(users, function() {
					return handle();
				});
			}, 60 * 1000);
		} else {
			xml2js.parseString(body, function(errParsing, rawObject) {
				if (errParsing) {
					var i18n = {};
					i18nModule.init(i18n);
					if (users[0].lang != 'unknown' && isMultiLingual) {
						i18nModule.setLocale(i18n, users[0].lang);
					}
					var device = require('byteballcore/device.js');
					device.sendMessageToDevice(users[0].device_address, 'text', i18n.__("Unable to get your WCG score for the ongoing distribution. Please make sure your account name is: {{accountName}}: {{accountName}}", {
						accountName: users[0].account_name
					}) + "\n➡ " + getTxtCommandButton(i18n.__("Ok"), "ok"));
					db.query("UPDATE users SET has_crawl_error=1 WHERE device_address=?", [users[0].device_address], function() {
						users.shift();
						crawlScores(users, function() {
							return handle();
						});
					});
				} else {
					checkAndReformatRawObject(rawObject, function(errReformating, statsObject) {
						if (errReformating) {
							console.log("WCG returned a badly formatted XML");
							setTimeout(function() {
								crawlScores(users, function() {
									return handle();
								});
							}, 60 * 1000);
						} else {
							if (users[0].id_wcg === statsObject.memberId) {
								db.takeConnectionFromPool(function(conn) {
									var arrQueries = [];
									conn.addQuery(arrQueries, "BEGIN");
									conn.addQuery(arrQueries, "INSERT OR IGNORE INTO wcg_scores (id_distribution, device_address, payout_address, member_id, score, diff_from_previous) VALUES ((SELECT max(id) FROM distributions WHERE is_crawled=0),?,?,?,?, ? - (SELECT score FROM wcg_scores WHERE id_distribution = (SELECT max( id_distribution) FROM wcg_scores WHERE member_id =?) AND member_id =?))", [users[0].device_address, users[0].payout_address, statsObject.memberId, statsObject.points, statsObject.points, statsObject.memberId, statsObject.memberId]);
									conn.addQuery(arrQueries, "INSERT OR IGNORE INTO wcg_meta_infos (id_distribution, device_address, member_id, nb_devices, run_time_per_day, run_time_per_result, points_per_hour_runtime, points_per_day, points_per_result) VALUES ((SELECT max(id) FROM distributions WHERE is_crawled=0),?,?,?,?,?,?,?,?)", [users[0].device_address, statsObject.memberId, statsObject.numDevices, statsObject.runTimePerDay, statsObject.runTimePerResult, statsObject.pointsPerHourRunTime, statsObject.pointsPerDay, statsObject.pointsPerResult]);
									conn.addQuery(arrQueries, "UPDATE wcg_scores SET bytes_reward= diff_from_previous * ? WHERE id_distribution =(SELECT max( id_distribution) FROM wcg_scores WHERE member_id =?) AND member_id =?", [conversion.getPriceInBytes(1) * WCGpointToDollar, statsObject.memberId, statsObject.memberId]);
									conn.addQuery(arrQueries, "COMMIT");
									async.series(arrQueries, function() {
										conn.release();
										users.shift();
										crawlScores(users, function() {
											return handle();
										});

									});

								});


							} else {
								var i18n = {};
								i18nModule.init(i18n);
								if (users[0].lang != 'unknown' && isMultiLingual) {
									i18nModule.setLocale(i18n, users[0].lang);
								}
								var device = require('byteballcore/device.js');
								device.sendMessageToDevice(users[0].device_address, 'text', i18n.__("The account name: {{accountName}} doesn't correspond to ID {{WCG_id}}. You won't receive payouts until you correct this issue or link your new WCG account.", {
								accountName: users[0].account_name,
								WCG_id: users[0].id_wcg
								}) + "\n➡ " + getTxtCommandButton(i18n.__("Ok"), "ok"));
								db.query("UPDATE users SET has_crawl_error=1 WHERE device_address=?", [users[0].device_address], function() {
									users.shift();
									crawlScores(users, function() {
										return handle();
									});
								});

							}
						}
					});
				};
			});
		}
	});
};



function initiateNewDistributionIfNeeded() {

	db.query("SELECT max(id),CASE \n\
	WHEN is_completed = 0 THEN 0	\n\
	WHEN creation_date < datetime('now', '-" + daysBetweenDistributions + " days') THEN 1	\n\
	END isNewDistributionNeeded	\n\
	FROM distributions", function(rows) {
		if (rows[0] && rows[0].isNewDistributionNeeded) {
			db.query("INSERT INTO distributions (is_crawled,is_authorized,is_completed) VALUES (0,0,0)", function() {
				crawlForAnyPendingDistribution();
			});
		}
	});

}

function processAnyAuthorizedDistribution() {
	var device = require('byteballcore/device.js');
	db.query("SELECT id,creation_date FROM distributions WHERE is_authorized=1 AND is_completed=0", function(authorizedDistributions) {
		if (authorizedDistributions.length === 1) {

			function onError(err) {
				throw err;
			}
			var network = require('byteballcore/network.js');
			var walletGeneral = require('byteballcore/wallet_general.js');
			var divisibleAsset = require('byteballcore/divisible_asset.js');
			var composer = require('byteballcore/composer.js');
			createDistributionOutputs(authorizedDistributions[0].id, authorizedDistributions[0].creation_date, function(arrOutputsBytes, arrOutputsAsset,arrMemberID) {
				if (!arrOutputsBytes) { // done
					db.query("UPDATE distributions SET is_completed=1 WHERE id=?", [authorizedDistributions[0].id], function() {});
					return verifyDistribution(authorizedDistributions[0].id, authorizedDistributions[0].creation_date);
				}
				var opts = {
					asset: honorificAsset,
					base_outputs: arrOutputsBytes,
					asset_outputs: arrOutputsAsset,
					change_address: my_address
				};
				console.log(opts);
				headlessWallet.sendMultiPayment(opts, function(err, unit) {
					if (err) {
						notifications.notifyAdmin("a payment failed", err);
						setTimeout(processAnyAuthorizedDistribution, 300 * 1000);

					} else {

						db.query("UPDATE wcg_scores SET unit_payment=? WHERE member_id IN (?) AND id_distribution=?", [unit, arrMemberID, authorizedDistributions[0].id], function() {
							db.query("SELECT  wcg_scores.device_address AS device_address,bytes_reward,diff_from_previous,lang FROM wcg_scores LEFT JOIN users ON users.device_address=wcg_scores.device_address WHERE wcg_scores.member_id IN (?) AND id_distribution=?", [arrMemberID, authorizedDistributions[0].id], function(rows) {
								rows.forEach(function(row){
									
									var i18n = {};
									i18nModule.init(i18n);
									if (row.lang != 'unknown' && isMultiLingual) {
										i18nModule.setLocale(i18n, row.lang);
									}
									
									device.sendMessageToDevice(row.device_address, 'text', i18n.__("A payout of {{amountByte}}GB and {{amountAsset}} {{labelAsset}} was made to reward  your contribution.",{amountByte:(row.bytes_reward/Math.pow(10,9)).toFixed(5),amountAsset:row.diff_from_previous,labelAsset:labelAsset}));
								});
							});
							setTimeout(processAnyAuthorizedDistribution, 30 * 1000);

						});

					}

				});

			});

		}

	});
}




function createDistributionOutputs(distributionID, distributionDate, handleOutputs) {
	db.query(
		"SELECT bytes_reward,payout_address, device_address,diff_from_previous,member_id \n\
		FROM wcg_scores \n\
		LEFT JOIN outputs \n\
			ON wcg_scores.payout_address=outputs.address \n\
			AND asset IS NULL \n\
			AND (SELECT address FROM unit_authors WHERE unit_authors.unit=outputs.unit)=? \n\
			AND (SELECT creation_date FROM units WHERE units.unit=outputs.unit)>? \n\
		WHERE outputs.address IS NULL \n\
			AND id_distribution=?  \n\
			AND bytes_reward>0 \n\
			AND diff_from_previous>0  \n\
		ORDER BY bytes_reward \n\
		LIMIT 128", [my_address, distributionDate, distributionID],
		function(rows) {
			if (rows.length === 0)
				return handleOutputs();
			var arrOutputsBytes = [];
			var arrOutputsAsset = [];
			var arrMemberID = [];
			rows.forEach(function(row) {
				arrOutputsBytes.push({
					amount: Math.round(row.bytes_reward),
					address: row.payout_address
				});
				arrOutputsAsset.push({
					amount: Math.round(row.diff_from_previous),
					address: row.payout_address
				});
				arrMemberID.push(row.member_id);
				
			});
			handleOutputs(arrOutputsBytes, arrOutputsAsset,arrMemberID);
		}
	);
}

function verifyDistribution(distributionID, distributionDate) {
	db.query(
		"SELECT SUM(outputs.amount) AS total FROM outputs JOIN unit_authors USING(unit) JOIN units USING(unit) \n\
		WHERE unit_authors.address=? AND outputs.address!=? AND asset IS NULL AND creation_date>?", [my_address, my_address, distributionDate],
		function(rows) {
			var total = rows[0].total;
			db.query("SELECT SUM(bytes_reward) AS total_bytes FROM wcg_scores WHERE id_distribution=?", [distributionID], function(rows) {
				var expected_total = Math.round(rows[0].total_bytes);
				var overpaid = total - expected_total;
				console.log("---- total paid: " + total + ", overpaid: " + overpaid);
				console.error("----- total paid: " + total + ", overpaid: " + overpaid);
				notifications.notifyAdmin("Distribution id " + distributionID + "done", distributionDate + "\n ---- total paid: " + total + ", overpaid: " + overpaid);
				writeDistributionReport(distributionID,distributionDate);
			});
		}
	);
}

function sendReportToAdmin() {

	db.query("SELECT wcg_scores.id_distribution AS id_distribution,wcg_scores.member_id AS member_id,bytes_reward, diff_from_previous,account_name FROM wcg_scores \n\
			INNER JOIN wcg_meta_infos ON wcg_scores.member_id = wcg_meta_infos.member_id AND wcg_scores.id_distribution = wcg_meta_infos.id_distribution\n\
			LEFT JOIN users ON users.device_address = wcg_scores.device_address\n\
			WHERE wcg_scores.id_distribution = (SELECT max(id) FROM distributions WHERE is_crawled=1 AND is_completed=0) ORDER BY bytes_reward DESC", function(rows) {

		var totalAsset = 0;
		var totalBytes = 0;
		var totalUsers = 0;
		rows.forEach(function(row) {
			totalAsset+= row.diff_from_previous;
			totalBytes+= row.bytes_reward;
			if(row.diff_from_previous<0){
				return notifications.notifyAdmin("Error for distribution id " + rows[0].id_distribution, "Member ID " + row.member_id + "  has negative reward");
			}
			if(row.diff_from_previous>0){
				totalUsers++;
			}
		});
		var bodyEmail = "Distribution id " + rows[0].id_distribution + "ready, paste distribute_" + rows[0].id_distribution + " to start it\n";
		bodyEmail += "Total bytes to be distributed " + Math.round(totalBytes) + " to " + totalUsers + " users\n";
		bodyEmail += "Total assets to be distributed " + Math.round(totalAsset) + " to " + totalUsers + " users\n";
		bodyEmail += "User ID	Bytes reward	Asset reward	Account name\n";

		rows.forEach(function(row) {
			if(row.diff_from_previous>0){
				bodyEmail += row.member_id + "	 " + Math.round(row.bytes_reward) + "	 " + Math.round(row.diff_from_previous)+ "	" + row.account_name + "\n";
			}
		});
		return notifications.notifyAdmin("Distribution id " + rows[0].id_distribution + "ready", bodyEmail)
	});

}


function writeDistributionReport(distributionID, distributionDate) {

	db.query("SELECT wcg_scores.id_distribution AS id_distribution,wcg_scores.member_id AS member_id,bytes_reward, diff_from_previous,account_name,unit_payment,score,wcg_scores.payout_address AS payout_address FROM wcg_scores \n\
			INNER JOIN wcg_meta_infos ON wcg_scores.member_id = wcg_meta_infos.member_id AND wcg_scores.id_distribution = wcg_meta_infos.id_distribution\n\
			LEFT JOIN users ON users.device_address = wcg_scores.device_address\n\
			WHERE wcg_scores.id_distribution = ? AND bytes_reward>0 ORDER BY bytes_reward DESC", [distributionID], function(rows) {

		var totalAsset = 0;
		var totalBytes = 0;
		rows.forEach(function(row) {
			totalAsset += row.diff_from_previous;
			totalBytes += row.bytes_reward;

		});
		var body = "<html><head><link rel='stylesheet' href='report.css'></head><body><div id='main'><div id='title'><h3>Distribution id " + rows[0].id_distribution + " on " + distributionDate + "</h3></div>";
		body += "<div id='totalBytes'>" + Math.round(totalBytes) + " bytes distributed  to " + rows.length + " users</div>";
		body += "<div id='totalAsset'>" + Math.round(totalAsset) +" " + labelAsset + " distributed " + + " to " + rows.length + " users</div>";
		body += "<div id='tableDistrib'><table class='distribution'><tr><td>User ID</td><td>Account name</td><td>score read</td><td>bytes reward</td><td>" + labelAsset + " reward</td><td>Address</td><td>Unit</td>";

		rows.forEach(function(row) {
				body += "<tr><td>" + row.member_id + "</td><td>" + row.account_name + "</td><td>" + row.score + "</td><td>" +
					Math.round(row.bytes_reward) + "</td><td>" + Math.round(row.diff_from_previous) + "</td><td><a href='https://explorer.byteball.org/#" + row.payout_address + "'>"+row.payout_address+"</a></td><td><a href='https://explorer.byteball.org/#" + row.unit_payment + "'>unit</a></td></tr>";
		});

		body += "</table></div></div></body></html>";
		fs.writeFile("reports/" + distributionID + "--" + distributionDate + ".html", body, function(err) {
			if (err) {
				notifications.notifyAdmin("I couldn't write report", err);
				return console.log("Couldn't write log file " + err);
			}

		});
	});
}

function getLanguagesSelection() {

	var returnedTxt = "Please select your language: ";
	for (var index in languagesAvailable) {
		returnedTxt += "\n➡ " + getTxtCommandButton(languagesAvailable[index].name, "selectLanguage_" + index);
	}
	
	return returnedTxt;
}


function createOutputsIfNeeded(asset, minQty, minAmountBytes, minAmountAsset) {

	db.query("SELECT COUNT(*) AS count_big_outputs FROM outputs JOIN units USING(unit) \n\
		WHERE address=? AND is_stable=1 AND amount>=? AND asset IS NULL AND is_spent=0", [my_address, minAmountBytes],
		function(rows) {
			if (rows[0].count_big_outputs < minAmountBytes) {
				var arrOutputsBytes = [];
				var arrOutputsAsset = [];
				for (var i = rows[0].count_big_outputs; i < minQty || i == 128; i++) {
					
					arrOutputsAsset.push({
						amount: minAmountAsset,
						address: my_address
					});
					arrOutputsBytes.push({
						amount: minAmountBytes,
						address: my_address
					});

				}

				var opts = {
					asset: asset,
					base_outputs: arrOutputsBytes,
					asset_outputs: arrOutputsAsset,
					change_address: my_address
				};
				headlessWallet.sendMultiPayment(opts, function(err, unit) {
					if (err) {
						notifications.notifyAdmin("OutpoutCreation failed", err);
					}

				});

			}

		});
}


function getTxtCommandButton(label, command) {
	var text = "";
	var _command = command ? command : label;
	text += "[" + label + "]" + "(command:" + _command + ")";
	return text;
}


eventBus.on('text', function(from_address, text) {
	processTxt(from_address, text);
});


eventBus.on('paired', function(from_address) {
	db.query("INSERT OR IGNORE INTO users (device_address,salt) VALUES (?,?)", [from_address, randomCryptoString.generateByLengthSync(4)], function() {
		processTxt(from_address, '');
	});
});



eventBus.on('headless_wallet_ready', function() {
	if (!conf.admin_email || !conf.from_email) {
		console.log("please specify admin_email and from_email in your " + desktopApp.getAppDataDir() + "/conf.json");
		process.exit(1);
	}

	if (!conf.bSingleAddress) {
		console.log("config must be single address wallet");
		process.exit(1);
	}

	headlessWallet.readSingleAddress(function(address) {
		my_address = address;

		db.query("SELECT unit FROM honorific_asset ", function(honorific_asset) {
			if (honorific_asset.length > 1) {
				console.log("honorific_asset should contain only one row");
				process.exit(1);
			}

			if (honorific_asset.length === 0) {
				console.log("No honorific asset set yet, please fund " + my_address + " then execute create_honorific_asset.js");
				setTimeout(function() { //let enough time for the node to initialize a first time
						process.exit(1)
					},
					5000);
			}

			honorificAsset = honorific_asset[0].unit;
			console.log("honorific asset: " + honorificAsset);
			setTimeout(function() {
				crawlForAnyPendingDistribution()
				processAnyAuthorizedDistribution();
				initiateNewDistributionIfNeeded();
				createOutputsIfNeeded(honorificAsset, minBytesOutputsAvailable, amountBytesOutputs, amountAssetOutputs);
				setInterval(initiateNewDistributionIfNeeded, 60 * 60 * 1000);
			}, 5000);
		});


	});

});