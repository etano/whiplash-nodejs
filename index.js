var request_lib = require('request');

var state = {
    api: null,
};

exports.connect = function(options, done) {
    if (state.api) {
        console.log("Already connected to whiplash!");
        return done();
    }

    var host = options.host;
    var port = options.port;
    var admin_client = options.admin_client;
    var admin_access_token = options.admin_access_token;
    var admin_password = options.admin_password;

    var wdb = new whiplash(host, port, admin_access_token);
    if (!admin_access_token) {
        if (!admin_password)
            admin_password = "password";
        console.log("Creating new whiplash admin token!");
        wdb.create_token('admin', admin_password, admin_client, admin_password).then(function(access_token) { // FIXME: client_secret same as password
            wdb.admin_access_token = access_token;
            state.api = wdb;
            console.log("Connected to whiplash!");
            done();
        }).catch(function(err) {
            console.log("Trouble connecting to whiplash!");
            console.log(err);
            done(err);
        })
    } else {
        state.api = wdb;
        console.log("Connected to whiplash!");
        done();
    }
};

exports.get = function() {
    return state.api;
};

class whiplash {
    constructor(host, port, admin_access_token) {
        this.host = host;
        this.port = port;
        this.admin_access_token = admin_access_token;
    }

    create_token(username, password, client_id, client_secret) {
        var self = this;

        var payload = {
            grant_type: 'password',
            username: username,
            password: password,
            client_id: client_id,
            client_secret: client_secret
        };

        var options = {
            uri: 'http://'+this.host+':'+this.port+'/api/users/token',
            method: 'POST',
            json: payload
        };

        return new Promise(function(resolve, reject) {
            request_lib(options, function(err, res, body) {
                if (err) {
                    reject(Error(err));
                } else {
                    if (body.access_token) {
                        console.log("New token:", body.access_token);
                        resolve(body.access_token);
                    } else {
                        reject(Error(JSON.stringify(body)));
                    }
                }
            });
        });
    }

    create_client(client_id, user_id, client_secret) {
        var client = {
            client_name: client_id,
            client_id: client_id,
            client_secret: client_secret,
            owner: user_id
        };
        return this.commit_one("clients", this.admin_access_token, client);
    }

    request(protocol, path, access_token, payload) {
        var options = {
            uri: 'http://'+this.host+':'+this.port+'/api/'+path, // TODO: make https
            method: protocol,
            headers: {
                'Authorization': 'Bearer '+access_token
            },
            json: payload
        };

        return new Promise(function(resolve, reject) {
            request_lib(options, function(err, res, body) {
                if (err) {
                    reject(Error(err));
                } else {
                    if (body.error) reject(body.error);
                    else {
                        if (!body.result) resolve(0);
                        else resolve(body.result);
                    }
                }
            });
        });
    }

    query(collection, access_token, filter, fields) {
        return this.request('GET', collection, access_token, {
            filter: filter,
            fields: fields
        });
    }

    query_one(collection, access_token, filter, fields) {
        return this.request('GET', collection+'/one', access_token, {
            filter: filter,
            fields: fields
        });
    }

    update_one(collection, access_token, filter, update) {
        return this.request('PUT', collection+'/one', access_token, {
            filter: filter,
            update: update
        });
    }

    update(collection, access_token, filter, update) {
        return this.request('PUT', collection, access_token, {
            filter: filter,
            update: update
        });
    }

    commit_one(collection, access_token, obj) {
        return this.request('POST', collection+'/one', access_token, obj);
    }

    submit(access_token, obj) {
        return this.request('GET', 'queries', access_token, obj);
    }

    distinct(collection, access_token, filter, field) {
        return this.request('GET', collection+'/distinct', access_token, {
            filter: filter,
            field: field
        });
    }

    count(collection, access_token, filter) {
        return this.request('GET', collection+'/count', access_token, {
            filter: filter
        });
    }

    totals(collection, access_token, filter, target_field, sum_field) {
        return this.request('GET', collection+'/totals', access_token, {
            filter: filter,
            target_field: target_field,
            sum_field: sum_field
        });
    }

}
