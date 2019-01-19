/*jslint node: true */
"use strict";
var async = require('async');
var db = require('ocore/db.js');
var eventBus = require('ocore/event_bus.js');
var headlessWallet = require('headless-obyte');


//const announcement = "At Byteball, we're greatful for your contribution to science and healthcare. But did you know you could earn additional 10% of Bytes by joining the Byteball.org team? Join here https://www.worldcommunitygrid.org/team/viewTeamInfo.do?teamId=R1RD1XTFK92 and help us win the THOR Challenge by contributing more run time to the team, currently we are 2nd https://www.worldcommunitygrid.org/about_us/viewNewsArticle.do?articleId=574";
const announcement = `Dear WCG cruncher,

First of all we want to wish you Happy Holidays with your friends and family! 

Last time we wrote you about diminishing returns for more than 40 connected devices. This measure alone has proven to be ineffective. Unfortunately we are going to have to change the rules a second time.

Again, WCG rewards are meant for new users to be able to discover Byteball by donating some spare CPU power to a good cause, not to make money. 

For now we are going to reduce the reward to $1 per 1,000,000 WCG points earned, effective from Monday December 24 on. This way the method will still work like a faucet but it will be much harder to make a profit, which was never intended. We’ll monitor what this change does and make further changes when necessary.

Happy crunching :)

The Byteball Team
`;

//const optout_text = "\n\nIf you don't want to receive news here, [click here to opt out](command:optout).";
const message = announcement;// + optout_text;

headlessWallet.setupChatEventHandlers();

function sendAnnouncement(){
	var device = require('ocore/device.js');
	db.query(
		"SELECT device_address FROM users",
		rows => {
			console.error(rows.length+" messages will be sent");
			async.eachSeries(
				rows,
				(row, cb) => {
					device.sendMessageToDevice(row.device_address, 'text', message, {
						ifOk: function(){}, 
						ifError: function(){}, 
						onSaved: function(){
							console.log("sent to "+row.device_address);
							cb();
						}
					});
				},
				() => {
					console.error("=== done");
				}
			);
		}
	);
}

eventBus.on('text', function(from_address, text){
	var device = require('ocore/device.js');
	console.log('text from '+from_address+': '+text);
	text = text.trim().toLowerCase();
	/*if (text === 'optout'){
		db.query("INSERT "+db.getIgnore()+" INTO optouts (device_address) VALUES(?)", [from_address]);
		return device.sendMessageToDevice(from_address, 'text', 'You are unsubscribed from future announcements.');
	}
	else */if (text.match(/thank/))
		device.sendMessageToDevice(from_address, 'text', "You're welcome!");
	else
		device.sendMessageToDevice(from_address, 'text', "Usual operations are paused while sending announcements.  Check again in a few minutes.");
});

eventBus.on('headless_wallet_ready', () => {
	setTimeout(sendAnnouncement, 1000);
});

