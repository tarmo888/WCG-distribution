/*jslint node: true */
"use strict";
const eventBus = require('byteballcore/event_bus.js');
const headlessWallet = require('headless-byteball');
const db = require('byteballcore/db.js');


function onError(err){
	throw Error(err);
}

function createAsset(){
	var composer = require('byteballcore/composer.js');
	var network = require('byteballcore/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: onError,
		ifError: onError,
		ifOk: function(objJoint){
			network.broadcastJoint(objJoint);
			db.query("INSERT INTO honorific_asset  (unit) VALUES (?)", [objJoint.unit.unit],function(){
				console.log("honorific asset " + objJoint.unit.unit + " created and added in DB");
			});

			
		}
	});
	var asset = {
		is_private: false,
		is_transferrable: false,
		auto_destroy: false,
		fixed_denominations: false,
		issued_by_definer_only: true,
		cosigned_by_definer: false,
		spender_attested: false
	};
	headlessWallet.readSingleAddress(function(address){
		setTimeout(function(){
			composer.composeAssetDefinitionJoint( address, asset, headlessWallet.signer, callbacks)},
		5000);
	});
}

eventBus.on('headless_wallet_ready', createAsset);