# WCG-distribution
This O<sub>byte</sub> chatbot authenticates World Community Grid accounts in order to periodically reward the contributors with bytes and asset.
Visit https://wiki.obyte.org/WCG_distribution for more information.

## Reports
To initializes reporting or regenerations of reports, run `node regenerate_completed_reports.js`, which copies files from `reports/templates` folder to `reports` (this folder can be made public for webserver) and appends all the distributions to them. There is no crontab needed, all new reports will be appended automatically to these files after each distribution. 