var storage = wrap(require('./drivers/fs'));
var UError = require('./error').UserError;
var info_file = '.package.json';

function wrap(driver) {
	if (typeof(driver.create_json) !== 'function') {
		driver.create_json = function(name, value, cb) {
			driver.create(name, JSON.stringify(value), cb);
		};
	}
	if (typeof(driver.update_json) !== 'function') {
		driver.update_json = function(name, value, cb) {
			driver.update(name, JSON.stringify(value), cb);
		};
	}
	if (typeof(driver.read_json) !== 'function') {
		driver.read_json = function(name, cb) {
			driver.read(name, function(err, res) {
				if (err) return cb(err);
				cb(null, JSON.parse(res));
			});
		};
	}
	return driver;
}

module.exports.add_package = function(name, metadata, callback) {
	storage.create_json(name + '/' + info_file, metadata, function(err) {
		if (err && err.code === 'EEXISTS') {
			return callback(new UError({
				status: 409,
				msg: 'this package is already present'
			}));
		}
		callback();
	});
}

module.exports.add_version = function(name, version, metadata, tag, callback) {
	storage.read_json(name + '/' + info_file, function(err, data) {
		// TODO: race condition
		if (err) return callback(err);

		if (data.versions[version] != null) {
			return callback(new UError({
				status: 409,
				msg: 'this version already present'
			}));
		}
		data.versions[version] = metadata;
		data['dist-tags'][tag] = version;
		storage.update_json(name + '/' + info_file, data, callback);
	});
}

module.exports.add_tarball = function(name, filename, stream, callback) {
	var data = new Buffer(0);
	stream.on('data', function(d) {
		var tmp = data;
		data = new Buffer(tmp.length+d.length);
		tmp.copy(data, 0);
		d.copy(data, tmp.length);
	});
	stream.on('end', function(d) {
		storage.create(name + '/' + filename, data, function(err) {
			if (err && err.code === 'EEXISTS') {
				return callback(new UError({
					status: 409,
					msg: 'this tarball is already present'
				}));
			}
			callback.apply(null, arguments);
		});
	});
}

module.exports.get_tarball = function(name, filename, callback) {
	storage.read(name + '/' + filename, function(err) {
		if (err && err.code === 'ENOENT') {
			return callback(new UError({
				status: 404,
				msg: 'no such package available'
			}));
		}
		callback.apply(null, arguments);
	});
}

module.exports.get_package = function(name, callback) {
	storage.read_json(name + '/' + info_file, function(err) {
		if (err && err.code === 'ENOENT') {
			return callback(new UError({
				status: 404,
				msg: 'no such package available'
			}));
		}
		callback.apply(null, arguments);
	});
}
