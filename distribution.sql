CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	device_address CHAR(33) NOT NULL UNIQUE,
	payout_address CHAR(33),
	id_wcg INTEGER UNIQUE,
	account_name CHAR (30),
	salt CHAR(5),
	lang CHAR (20) DEFAULT 'unknown',
	has_crawl_error TINYINT DEFAULT 0,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);


CREATE TABLE honorific_asset (
	unit CHAR(44),
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE distributions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	is_crawled TINYINT DEFAULT 0,
	is_authorized TINYINT DEFAULT 0,
	is_completed TINYINT DEFAULT 0,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO distributions (is_crawled,is_completed,is_authorized) VALUES (1,1,1); -- insert a first dummy distribution

CREATE TABLE wcg_scores (
	id_distribution INTEGER,
	device_address CHAR(33) NOT NULL,
	payout_address  CHAR(33),
	member_id INTEGER,
	score FLOAT,
	diff_from_previous FLOAT,
	unit_payment CHAR(44),
	bytes_reward INTEGER DEFAULT 0,
	PRIMARY KEY (id_distribution, member_id),
	UNIQUE(id_distribution, device_address),
	FOREIGN KEY (id_distribution) REFERENCES distributions(id),
	FOREIGN KEY (device_address) REFERENCES users(device_address)
);
	
CREATE TABLE wcg_meta_infos (
	id_distribution INTEGER,
	device_address CHAR(33) NOT NULL,
	member_id INTEGER,
	nb_devices INTEGER,
	run_time_per_day FLOAT,
	run_time_per_result FLOAT,
	points_per_hour_runtime FLOAT,
	points_per_day FLOAT,
	points_per_result FLOAT,
	PRIMARY KEY (id_distribution, member_id),
	UNIQUE(id_distribution, device_address),
	FOREIGN KEY (id_distribution) REFERENCES distributions(id),
	FOREIGN KEY (device_address) REFERENCES users(device_address)
);



