/*jslint node: true */
"use strict";
var async = require('async');
var db = require('byteballcore/db.js');
var eventBus = require('byteballcore/event_bus.js');
var headlessWallet = require('headless-byteball');


//const announcement = "At Byteball, we're greatful for your contribution to science and healthcare. But did you know you could earn additional 10% of Bytes by joining the Byteball.org team? Join here https://www.worldcommunitygrid.org/team/viewTeamInfo.do?teamId=R1RD1XTFK92 and help us win the THOR Challenge by contributing more run time to the team, currently we are 2nd https://www.worldcommunitygrid.org/about_us/viewNewsArticle.do?articleId=574";
const announcement = `Dear WCG cruncher,

First of all, thank you for donating your computing power for good! We recently won the THOR challenge because of all of your hard work, you deserve a big compliment for that.

Perhaps partly because of this challenge, we have recently observed some users who have connected a very large number of devices. While awesome for WCG this does defeat part of the purpose of why we’re giving away Bytes through this initiative. We want to introduce as many people as possible to Byteball, not distribute a large part of the undistributed funds to professional computing power aggregators.

To balance it out a little bit we are going to introduce diminishing returns to the reward schedule. Starting Nov 20, anyone who has more than 40 devices connected will see a drop off in Bytes rewarded for the devices above 40. You’ll still get rewarded full WCG points for all devices.

Thanks for your understanding and continuous support of this initiative. Together we have donated more than 2000 years of computing time!

Happy crunching :)

The Byteball Team
`;

//const optout_text = "\n\nIf you don't want to receive news here, [click here to opt out](command:optout).";
const message = announcement;// + optout_text;

headlessWallet.setupChatEventHandlers();

function sendAnnouncement(){
	var device = require('byteballcore/device.js');
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
	var device = require('byteballcore/device.js');
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

