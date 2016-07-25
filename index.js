var request_lib = require('request');

var state = {
    api: null,
};

function try_connect(wdb, admin_password, admin_client_id, admin_client_secret) {
    return wdb.create_token('admin', admin_password, admin_client_id, admin_client_secret).then(function(access_token) {
        wdb.admin_access_token = access_token;
        return true;
    }).catch(function(err) {
        console.log(err);
        return false;
    });
}

exports.connect = function(options, done) {
    if (state.api) {
        console.log("Already connected to whiplash!");
        return done();
    }

    var host = options.host;
    var port = options.port;
    var admin_client_id = options.admin_client_id;
    var admin_client_secret = options.admin_client_secret;
    var admin_access_token = options.admin_access_token;
    var admin_password = options.admin_password;

    var wdb = new whiplash(host, port, admin_access_token);
    if (!admin_access_token) {
        if (!admin_password)
            admin_password = "password";
        if (!admin_client_secret)
            admin_client_secret = admin_password;
        console.log("Creating new whiplash admin token!");
        var interval = setInterval(function() {
            if (try_connect(wdb, admin_password, admin_client_id, admin_client_secret)) {
                clearInterval(interval);
                state.api = wdb;
                console.log("Connected to whiplash!");
                done();
            } else {
                console.log("Trouble connecting to whiplash!");
                console.log("Trying again.");
            }
        }, 1000);
    } else {
        state.api = wdb;
        console.log("Connected to whiplash!");
        done();
    }
};

exports.get = function() {
    return state.api;
};

class Collection {
    constructor(name, wdb) {
        this.name = name;
        this.wdb = wdb
    }

    query(filter, fields, access_token) {
        return this.wdb.request('GET', this.name, {
            filter: filter,
            fields: fields
        }, access_token);
    }

    query_one(filter, fields, access_token) {
        return this.wdb.request('GET', this.name+'/one', {
            filter: filter,
            fields: fields
        }, access_token);
    }

    update_one(filter, update, access_token) {
        return this.wdb.request('PUT', this.name+'/one', {
            filter: filter,
            update: update
        }, access_token);
    }

    update(filter, update, access_token) {
        return this.wdb.request('PUT', this.name, {
            filter: filter,
            update: update
        }, access_token);
    }

    commit_one(obj, access_token) {
        return this.wdb.request('POST', this.name+'/one', obj, access_token);
    }

    delete(filter, access_token) {
        return this.wdb.request('DELETE', this.name, filter, access_token);
    }

    distinct(filter, field, access_token) {
        return this.wdb.request('GET', this.name+'/distinct', {
            filter: filter,
            field: field
        }, access_token);
    }

    count(filter, access_token) {
        return this.wdb.request('GET', this.name+'/count', {
            filter: filter
        }, access_token);
    }

    totals(filter, target_field, sum_field, access_token) {
        return this.wdb.request('GET', this.name+'/totals', {
            filter: filter,
            target_field: target_field,
            sum_field: sum_field
        }, access_token);
    }
}

class whiplash {
    constructor(host, port, admin_access_token) {
        this.host = host;
        this.port = port;
        this.admin_access_token = admin_access_token;
        this.models = new Collection("models", this);
        this.properties = new Collection("properties", this);
        this.executables = new Collection("executables", this);
        this.sets = new Collection("sets", this);
        this.users = new Collection("users", this);
        this.clients = new Collection("clients", this);
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
        return this.clients.commit_one(client);
    }

    request(protocol, path, payload, access_token) {
        if (!access_token)
            access_token = this.admin_access_token;
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

    query(obj, access_token) {
        return this.request('GET', 'queries', obj, access_token);
    }

    submit(obj, access_token) {
        return this.request('POST', 'queries', obj, access_token);
    }

    status(obj, access_token) {
        return this.request('GET', 'queries/status', obj, access_token);
    }
}

