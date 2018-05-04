/*jslint node: true */
"use strict";

const db = require('byteballcore/db.js');
const reports = require('./modules/reports.js');

db.query("SELECT id,creation_date FROM distributions WHERE is_completed=1 ORDER BY id ASC", function(rows) {
	
	generateReports(rows);
	
});

function generateReports(rows) {

	if (!rows[0])
		return;
	reports.add(rows[0].id, rows[0].creation_date);
	rows.shift();
	setTimeout(function() {
		generateReports(rows)
	}, 50)
}