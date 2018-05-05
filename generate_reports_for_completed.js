/*jslint node: true */
"use strict";

const db = require('byteballcore/db.js');
const fs = require('fs');
const reports = require('./modules/reports.js');

/*
*	Erase the current index.html with the template then regenerate all reports
*/

fs.readFile('reports/templates/index.html', (errReading, content) => {
	if (errReading) {
		notifications.notifyAdmin("Couldn't open reports/templates/index.html", errReading);
		return console.log("Couldn't open reports/templates/index.html\n" + errReading);
	}

	fs.writeFile("reports/index.html", content, function(errWriting) {
		if (errWriting) {
			notifications.notifyAdmin("I couldn't write index.html", errWriting);
			return console.log("Couldn't write reports/index.html\n" + errWriting);
		}

		db.query("SELECT id,creation_date FROM distributions WHERE is_completed=1 ORDER BY id ASC", function(rows) {
			generateReports(rows);
		});

	});

});



function generateReports(rows) {

	if (!rows[0])
		return console.log("\nHTML files generated");
	reports.add(rows[0].id, rows[0].creation_date);
	rows.shift();
	setTimeout(function() {
		generateReports(rows)
	}, 50)
}