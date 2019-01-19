/*jslint node: true */
"use strict";

const cheerio = require('cheerio');
const notifications = require('../modules/notifications.js');
const db = require('ocore/db.js');
const fs = require('fs');
const conf = require('ocore/conf.js');


function add(distributionID, distributionDate) {

	db.query("SELECT wcg_scores.distribution_id AS distribution_id,wcg_scores.member_id AS member_id,bytes_reward, diff_from_previous,account_name,payment_unit,score,wcg_scores.payout_address AS payout_address FROM wcg_scores \n\
			INNER JOIN wcg_meta_infos \n\
				ON wcg_scores.member_id = wcg_meta_infos.member_id \n\
			 	AND wcg_scores.distribution_id = wcg_meta_infos.distribution_id\n\
			LEFT JOIN users ON users.device_address = wcg_scores.device_address\n\
			WHERE wcg_scores.distribution_id = ? AND bytes_reward>0 ORDER BY bytes_reward ASC", [distributionID], function(rows) {

		var totalAssets = 0;
		var totalBytes = 0;
		rows.forEach(function(row) {
			totalAssets += row.diff_from_previous;
			totalBytes += row.bytes_reward;

		});

		/*
		*	Add distribution to index.html
		*/
		
		fs.readFile('reports/index.html', (err, content) => {
			if (err) {
				notifications.notifyAdmin("Couldn't open index.html", err);
				return console.log("Couldn't open index.html" + err);
			}
			const $ = cheerio.load(content);

			$('#table_first_child').after("<tr><td>" + distributionID + "</td><td>" + distributionDate + "</td><td>" + rows.length + "</td><td>" + (totalBytes / 1e9).toLocaleString([], {
					maximumFractionDigits: 9
				}) + "</td><td>" +
				Math.round(totalAssets) + "</td><td><a href='" + distributionID + "--" + distributionDate + ".html'>details</a></td>");

			fs.writeFile("reports/index.html", $.html(), function(err) {
				if (err) {
					notifications.notifyAdmin("I couldn't write index.html", err);
					return console.log("Couldn't write index.htm" + err);
				}

			});

		});

		
		/*
		*	Create html file for this distribution
		*/

		fs.readFile('reports/templates/distribution.html', (err, content) => {
			if (err) {
				notifications.notifyAdmin("Couldn't open reports/templates/distribution.html", err);
				return console.log("Couldn't open reports/templates/distribution.html" + err);
			}
			const $ = cheerio.load(content);
			
			$('title').append("Report for distribution id " + distributionID + " on " + distributionDate);
			$('h3').append("Distribution id " + distributionID + " on " + distributionDate);
			$('#totalBytes').append((totalBytes / 1e9).toLocaleString([], {
				maximumFractionDigits: 9
			}) + "GB distributed  to " + rows.length + " addresses");
			$('#totalAssets').append(totalAssets + conf.labelAsset + " distributed " + " to " + rows.length + " addresses");

			rows.forEach(function(row) {
			$('#table_first_child').after("<tr><td>" + row.member_id + "</td><td>" + row.account_name + "</td><td>" + row.score + "</td><td>" +
				Math.round(row.bytes_reward) + "</td><td>" + Math.round(row.diff_from_previous) + "</td><td><a href='https://explorer.obyte.org/#" + row.payout_address + "'>" + row.payout_address + "</a></td><td><a href='https://explorer.obyte.org/#" + row.payment_unit + "'>unit</a></td></tr>");
			});

			fs.writeFile("reports/" + distributionID + "--" + distributionDate + ".html", $.html(), function(errWriting) {
				if (errWriting) {
					notifications.notifyAdmin("I couldn't write report", errWriting);
					return console.log("Couldn't write log file " + errWriting);
				}
			});
		});

	});
}


exports.add = add;