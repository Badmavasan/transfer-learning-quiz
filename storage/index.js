'use strict';

// Pick the storage backend: PostgreSQL when DATABASE_URL is set, otherwise local files.
// (pg.js is only require()d in the DB path, so the file-mode dev run needs no `pg` install.)
module.exports = process.env.DATABASE_URL ? require('./pg') : require('./file');
