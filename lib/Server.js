const EventEmitter = require('events').EventEmitter;
const expressWs = require('express-ws');
const Ws = require('ws');
const DeepExtend = require('deep-extend');

const ClientConnection = require('./ClientConnection.js');

class Server extends EventEmitter {

    constructor(wsOptions, guacdOptions, clientOptions, callbacks) {
        super();

        this.LOGLEVEL = {
            QUIET: 0,
            ERRORS: 10,
            NORMAL: 20,
            VERBOSE: 30,
            DEBUG: 40,
        };

        if (wsOptions.hasOwnProperty('app')) {
            console.log(`Found app in parent definition, using`);
            this.wsOptions = wsOptions;
        }
        else if (wsOptions.hasOwnProperty('server')) {
            this.wsOptions = wsOptions;
        } else {
            this.wsOptions = Object.assign({
                port: 8080
            }, wsOptions);
        }

        this.guacdOptions = Object.assign({
            host: '127.0.0.1',
            port: 4822
        }, guacdOptions);

        this.clientOptions = {};
        DeepExtend(this.clientOptions, {
            maxInactivityTime: 10000,

            log: {
                level: this.LOGLEVEL.VERBOSE,
                stdLog: console.log,
                errorLog: console.error
            },

            crypt: {
                cypher: 'AES-256-CBC',
            },

            connectionDefaultSettings: {
                rdp: {
                    'args': 'connect',
                    'port': '3389',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                },
                vnc: {
                    'args': 'connect',
                    'port': '5900',
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                },
                ssh: {
                    'args': 'connect',
                    'port': 22,
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                },
                telnet: {
                    'args': 'connect',
                    'port': 23,
                    'width': 1024,
                    'height': 768,
                    'dpi': 96,
                }
            },

            allowedUnencryptedConnectionSettings: {
                rdp: [
                    'width',
                    'height',
                    'dpi'
                ],
                vnc: [
                    'width',
                    'height',
                    'dpi'
                ],
                ssh: [
                    'color-scheme',
                    'font-name',
                    'font-size',
                    'width',
                    'height',
                    'dpi'
                ],
                telnet: [
                    'color-scheme',
                    'font-name',
                    'font-size',
                    'width',
                    'height',
                    'dpi'
                ]
            }

        }, clientOptions);

        // Backwards compatibility
        if (this.clientOptions.log.verbose !== 'undefined' && this.clientOptions.log.verbose === true) {
            this.clientOptions.log.level = this.LOGLEVEL.DEBUG;
        }

        if (typeof this.clientOptions.log.level === 'string' && this.LOGLEVEL[this.clientOptions.log.level]) {
            this.clientOptions.log.level = this.LOGLEVEL[this.clientOptions.log.level];
        }

        this.callbacks = Object.assign({
            processConnectionSettings: (settings, callback) => callback(undefined, settings)
        }, callbacks);

        this.connectionsCount = 0;
        this.activeConnections = new Map();

        if (this.clientOptions.log.level >= this.LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Starting guacamole-lite websocket server');
        }

        if (wsOptions.hasOwnProperty('app')) {

            this.clientOptions.log.stdLog(`App found in guaclite call, setting up ws 'route'`);
            wsOptions.app.ws('/guacamole', function(ws, req) {
                
                this.webSocketServer = ws;
                this.webSocketServer.on('connection', this.newConnection.bind(ws));
                // ws.on('connect', this.newConnection.bind(ws));
                this.clientOptions.log.stdLog(`Set up listener for connection...`);
            })
        }

        // this.webSocketServer = new Ws.Server(this.wsOptions.server);
        // this.webSocketServer.on('connection', this.newConnection.bind(this));

        process.on('SIGTERM', this.close.bind(this));
        process.on('SIGINT', this.close.bind(this));

        this.clientOptions.log.stdLog(`Server started up, listening on /guacamole`);
    }

    close() {
        if (this.clientOptions.log.level >= this.LOGLEVEL.NORMAL) {
            this.clientOptions.log.stdLog('Closing all connections and exiting...');
        }

        this.webSocketServer.close(() => {
            this.activeConnections.forEach((activeConnection) => {
                activeConnection.close();
            });
        });
    }

    newConnection(webSocketConnection) {
        this.clientOptions.log.stdLog(`New connection initiated with binding the newConnection function to ws`);
        this.connectionsCount++;
        this.activeConnections.set(this.connectionsCount, new ClientConnection(this, this.connectionsCount, webSocketConnection));
    }
}

module.exports = Server;
