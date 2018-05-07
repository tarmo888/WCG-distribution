/*jslint node: true */
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const findFiles = function(folder, pattern = /.*/, callback) {
	let flist = [];
	fs.readdirSync(folder).map(function(e) {
		let fname = path.join(folder, e);
		let fstat = fs.lstatSync(fname);
		if (fstat.isDirectory()) {
			// don't want to produce a new array with concat
			Array.prototype.push.apply(flist, findFiles(fname, pattern, callback));
		}
		else {
			if (pattern.test(fname)) {
				flist.push(fname);
				if (callback) {
					callback(fname);
				}
			}
		}
	});
	return flist;
};

const compareLineCounts = function(filepath, locale, base) {
	try {
		assert.strictEqual(locale, base);
		console.log('\x1b[32;49mPASS\x1b[39;49m:', filepath, '-', locale, 'lines, just like base file');
	}
	catch (error) {
		console.error('\x1b[31;49mFAIL\x1b[39;49m:', filepath, '-', locale, 'lines while base has', base);
	}
};
const compareMatchingKeys = function(filepath, found, should_have, source, target) {
	try {
		assert.strictEqual(found, should_have);
		console.log('\x1b[32;49mPASS\x1b[39;49m:', filepath, '- all', found, source, 'keys also found in', target);
	}
	catch (error) {
		console.error('\x1b[31;49mFAIL\x1b[39;49m:', filepath, '-', source, 'has', should_have, 'keys, but', found, 'found in', target);
	}
};
const compareBrackets = function(filepath, opening, closing, where, type) {
	try {
		assert.strictEqual(opening, closing);
		console.log('\x1b[32;49mPASS\x1b[39;49m:', filepath, '-', opening, type, 'bracket pairs in', where);
	}
	catch (error) {
		console.error('\x1b[31;49mFAIL\x1b[39;49m:', filepath, '-', opening, 'opening', type, 'brackets and', closing, 'closing', type, 'brackets in', where);
	}
};

let base_contents = fs.readFileSync('locales/en.json', 'utf8');
let base_locale = {'data':JSON.parse(base_contents), 'linecount': base_contents.toString().split('\n').length};
let translations = [];
let localeFiles = findFiles('locales', /wcg[_-]bot_[a-z-]{5}\.json$/i, function(filepath) {
	let contents = fs.readFileSync(filepath, 'utf8');
	translations[filepath] = {'data': JSON.parse(contents), 'linecount': contents.toString().split('\n').length};
});

// compare line counts with base file
Object.keys(translations).forEach(function(filepath) {
	compareLineCounts(filepath, translations[filepath]['linecount'], base_locale['linecount']);
});

// compare how many base keys in translation file
Object.keys(translations).forEach(function(filepath) {
	let key_matches = 0;
	Object.keys(base_locale['data']).forEach(function(key) {
		key_matches += translations[filepath]['data'].hasOwnProperty(key) ? 1 : 0;
	});
	compareMatchingKeys(filepath, key_matches, Object.keys(base_locale['data']).length, 'base', 'translation');
});

// compare how many translation keys in base file
Object.keys(translations).forEach(function(filepath) {
	let key_matches = 0;
	Object.keys(translations[filepath]['data']).forEach(function(key) {
		key_matches += base_locale['data'].hasOwnProperty(key) ? 1 : 0;
	});
	compareMatchingKeys(filepath, key_matches, Object.keys(translations[filepath]['data']).length, 'translation', 'base');
});

// compare bracket pairs in keys
Object.keys(translations).forEach(function(filepath) {
	let openingBrackets = 0;
	let closingBrackets = 0;
	let openingDoubleBrackets = 0;
	let closingDoubleBrackets = 0;
	Object.keys(translations[filepath]['data']).forEach(function(key) {
		openingBrackets = openingBrackets + key.split('{').length-1;
		closingBrackets = closingBrackets + key.split('}').length-1;
		openingDoubleBrackets = openingDoubleBrackets + key.split('{{').length-1;
		closingDoubleBrackets = closingDoubleBrackets + key.split('}}').length-1;
	});
	compareBrackets(filepath, openingBrackets, closingBrackets, 'keys', 'single');
	compareBrackets(filepath, openingDoubleBrackets, closingDoubleBrackets, 'keys', 'double');
});

// compare brackets pairs in values
Object.keys(translations).forEach(function(filepath) {
	let openingBrackets = 0;
	let closingBrackets = 0;
	let openingDoubleBrackets = 0;
	let closingDoubleBrackets = 0;
	Object.keys(translations[filepath]['data']).forEach(function(key) {
		openingBrackets = openingBrackets + translations[filepath]['data'][key].split('{').length-1;
		closingBrackets = closingBrackets + translations[filepath]['data'][key].split('}').length-1;
		openingDoubleBrackets = openingDoubleBrackets + translations[filepath]['data'][key].split('{{').length-1;
		closingDoubleBrackets = closingDoubleBrackets + translations[filepath]['data'][key].split('}}').length-1;
	});
	compareBrackets(filepath, openingBrackets, closingBrackets, 'values', 'single');
	compareBrackets(filepath, openingDoubleBrackets, closingDoubleBrackets, 'values', 'double');
});
//console.log(translations);

