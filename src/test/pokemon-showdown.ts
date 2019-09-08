import assert = require('assert');
import fs = require('fs');
import path = require('path');

describe("Pokemon-Showdown compatibility - ", () => {
	it('data files', () => {
		assert(fs.existsSync(Dex.dataDir));
		assert(fs.lstatSync(Dex.dataDir).isDirectory());
		assert(fs.existsSync(Dex.modsDir));
		assert(fs.lstatSync(Dex.modsDir).isDirectory());
		assert(fs.existsSync(Dex.formatsPath));

		for (const type in Dex.dataFiles) {
			assert(fs.existsSync(path.join(Dex.dataDir, Dex.dataFiles[type] + '.js')));
		}
	});
});
