/*jslint node: true */
"use strict";

const cheerio = require('cheerio');
const notifications = require('./notifications.js');
const db = require('../node_modules/byteballcore/db.js');
const fs = require('fs');
const conf = require('../node_modules/byteballcore/conf.js');


function add(distributionID, distributionDate) {

	db.query("SELECT wcg_scores.distribution_id AS distribution_id,wcg_scores.member_id AS member_id,bytes_reward, diff_from_previous,account_name,payment_unit,score,wcg_scores.payout_address AS payout_address FROM wcg_scores \n\
			INNER JOIN wcg_meta_infos \n\
				ON wcg_scores.member_id = wcg_meta_infos.member_id \n\
			 	AND wcg_scores.distribution_id = wcg_meta_infos.distribution_id\n\
			LEFT JOIN users ON users.device_address = wcg_scores.device_address\n\
			WHERE wcg_scores.distribution_id = ? AND bytes_reward>0 ORDER BY bytes_reward DESC", [distributionID], function(rows) {

		var totalAssets = 0;
		var totalBytes = 0;
		rows.forEach(function(row) {
			totalAssets += row.diff_from_previous;
			totalBytes += row.bytes_reward;

		});


		fs.readFile('reports/index.html', (err, content) => {
			if (err) {
				notifications.notifyAdmin("Couldn't open index.html", err);
			}
			console.log(content+"\n");
			const $ = cheerio.load(content);

			$('#table_first_child').after("<tr><td>" + distributionID + "</td><td>" + distributionDate + "</td><td>" + (totalBytes/1e9).toLocaleString([], {maximumFractionDigits:3})+ "</td><td>" +
				Math.round(totalAssets) + "</td><td><a href='" + distributionID + "--" + distributionDate + ".html'>details</a></td>");
			
			console.log($.html()+"\n");
			fs.writeFile("reports/index.html", $.html(), function(err) {
			if (err) {
				notifications.notifyAdmin("I couldn't write index.html", err);
				return console.log("Couldn't write index.htm" + err);
			}

			});

		});

		var body = "<html><head><link rel='stylesheet' href='report.css'></head><body><div id='main'><div id='title'><h3>Distribution id " + distributionID + " on " + distributionDate + "</h3></div><div id='go_back_index'><a href='index.html'>Go back to list</a></div>";
		body += "<div id='totalBytes'>" +(totalBytes/1e9).toLocaleString([], {maximumFractionDigits:3}) + "GB distributed  to " + rows.length + " users</div>";
		body += "<div id='totalAssets'>" + Math.round(totalAssets) + " " + conf.labelAsset + " distributed " + " to " + rows.length + " users</div>";
		body += "<div id='tableDistrib'><table class='distribution'><tr><td>User ID</td><td>Account name</td><td>Score read</td><td>Bytes reward</td><td>" + conf.labelAsset + " reward</td><td>Address</td><td>Unit</td>";

		rows.forEach(function(row) {
			body += "<tr><td>" + row.member_id + "</td><td>" + row.account_name + "</td><td>" + row.score + "</td><td>" +
				Math.round(row.bytes_reward) + "</td><td>" + Math.round(row.diff_from_previous) + "</td><td><a href='https://explorer.byteball.org/#" + row.payout_address + "'>" + row.payout_address + "</a></td><td><a href='https://explorer.byteball.org/#" + row.payment_unit + "'>unit</a></td></tr>";
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


exports.add = add;