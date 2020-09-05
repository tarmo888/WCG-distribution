/*jslint node: true */
"use strict";

const cheerio = require('cheerio');
const notifications = require('../modules/notifications.js');
const db = require('ocore/db.js');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const conf = require('ocore/conf.js');


async function add(distributionID, distributionDate, cb) {
	const distributionUTCDate = new Date(distributionDate).toUTCString();
	// fix path on Windows
	distributionDate = process.platform === 'win32' ? distributionDate.replace(/:/g, '.') : distributionDate;
	if (typeof cb !== 'function') {
		cb = function(err){
			if (err) console.error(err);
		};
	}

	let rows = await db.query("SELECT wcg_scores.distribution_id AS distribution_id,wcg_scores.member_id AS member_id,bytes_reward, diff_from_previous,account_name,payment_unit,score,wcg_scores.payout_address AS payout_address FROM wcg_scores \n\
			INNER JOIN wcg_meta_infos \n\
				ON wcg_scores.member_id = wcg_meta_infos.member_id \n\
			 	AND wcg_scores.distribution_id = wcg_meta_infos.distribution_id\n\
			LEFT JOIN users ON users.device_address = wcg_scores.device_address\n\
			WHERE wcg_scores.distribution_id = ? AND bytes_reward>0 ORDER BY bytes_reward ASC", [distributionID]);

	let $;
	let content;
	let totalAssets = 0;
	let totalBytes = 0;
	rows.forEach(function(row) {
		totalAssets += row.diff_from_previous;
		totalBytes += row.bytes_reward;
	});
	const normalTotalBytes = (totalBytes / 1e9).toLocaleString([], {maximumFractionDigits: 9});
	const normalTotalAssets = Math.round(totalAssets);

	/*
	*	Add distribution to index.html
	*/
	try {
		content = await readFile('reports/index.html');
	}
	catch (err) {
		notifications.notifyAdmin("Couldn't open index.html", err);
		return cb(err);
	}

	$ = cheerio.load(content);
	$('#table_first_child').after(`
		<tr>
			<td>${distributionID}</td>
			<td>${distributionDate}</td>
			<td>${rows.length}</td>
			<td>${normalTotalBytes}</td>
			<td>${normalTotalAssets}</td>
			<td><a href="${distributionID}--${distributionDate}.html">details</a></td>
		</tr>`);

	try {
		await writeFile("reports/index.html", $.html());
	}
	catch (err) {
		notifications.notifyAdmin("I couldn't write index.html", err);
		return cb(err);
	}

	/*
	*	Add distribution to rss.xml
	*/
	try {
		content = await readFile('reports/rss.xml');
	}
	catch (err) {
		notifications.notifyAdmin("Couldn't open rss.xml", err);
		return cb(err);
	}

	$ = cheerio.load(content, {
		xml: {
		  normalizeWhitespace: true,
		}
	});
	const newItem = `
		<item>
			<title>Distribution ${distributionID}</title>
			<link>https://wcg.report/${distributionID}--${encodeURIComponent(distributionDate)}.html</link>
			<description>Addresses: ${rows.length}, Total GB: ${normalTotalBytes}, Total WCG points: ${normalTotalAssets}</description>
			<pubDate>${distributionUTCDate}</pubDate>
			<guid isPermaLink="false">guid:wcg.report:ID=${distributionID}</guid>
		</item>`;

	if ($('item').length >= 20) {
		$('item').last().remove();
	}
	if (!$('item').length) {
		$('channel').append(newItem);
	}
	else {
		$('item').first().before(newItem);
	}
	const newDate = new Date().toUTCString();
	$('pubDate').text(newDate);
	$('lastBuildDate').text(newDate);

	try {
		await writeFile("reports/rss.xml", $.xml());
	}
	catch (err) {
		notifications.notifyAdmin("I couldn't write rss.xml", err);
		return cb(err);
	}

	/*
	*	Create html file for this distribution (if needed)
	*/
	const detailedReport = `reports/${distributionID}--${distributionDate}.html`;
	try {
		await readFile(detailedReport);
		console.log('existed', detailedReport);
		return cb(null);
	}
	catch (err) {}
	console.log('regenerated', detailedReport);

	try {
		content = await readFile('reports/templates/distribution.html');
	}
	catch (err) {
		notifications.notifyAdmin("Couldn't open reports/templates/distribution.html", err);
		return cb(err);
	}

	$ = cheerio.load(content);
	$('title').append(`Report for distribution id ${distributionID} on ${distributionDate}`);
	$('h3').append(`Distribution id ${distributionID} on ${distributionDate}`);
	$('#totalBytes').append(`${normalTotalBytes} GB distributed to ${rows.length} addresses`);
	$('#totalAssets').append(`${totalAssets} ${conf.labelAsset} distributed to ${rows.length} addresses`);
	const explorer = `https://${(process.env.testnet ? 'testnet' : '')}explorer.obyte.org`;

	rows.forEach(function(row) {
		$('#table_first_child').after(`
			<tr>
				<td>${row.member_id}</td>
				<td>${row.account_name}</td>
				<td>${row.score}</td>
				<td>${Math.round(row.bytes_reward)}</td>
				<td>${Math.round(row.diff_from_previous)}</td>
				<td><a href="${explorer}/#${row.payout_address}">${row.payout_address}</a></td>
				<td><a href="${explorer}/#${row.payment_unit}">unit</a></td>
			</tr>`);
	});

	try {
		await writeFile(detailedReport, $.html());
	}
	catch (err) {
		notifications.notifyAdmin("I couldn't write report", err);
		return cb(err);
	}
	cb(null);
}


exports.add = add;