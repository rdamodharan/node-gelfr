/*
Copyright(c) 2012 Yahoo! Inc. All rights reserved. 

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

Author(s): Damodharan Rajalingam (damu at yahoo-inc dot com)
*/
var dgram = require("dgram"),
    zlib = require("zlib"),
    util = require("util"),
    EventEmitter = require("events").EventEmitter,
    ttlStore = require("ttlStore").ttlStore;

var DEFAULT_PORT = 0;
var DEFAULT_ADDR = "0.0.0.0";
var DEFAULT_CHUNK_TTL = 5;
var DEFAULT_JSON_PARSE = false;

function concatBuffers(bufs, totalBytes) {
    var data = new Buffer(totalBytes);
    var totalChunks = bufs.length;
    var offset=0;
//    console.log("Total chunks: " + totalChunks);
    for(i=0; i<totalChunks; i++) {
        chunk=bufs[i];
//        console.log("Copying chunk of size " + chunk.length + " at offset " + offset); 
        chunk.copy(data, offset);
        offset += chunk.length;
    }
    return data;
}

function gelfServer(options) {
    if(!(this instanceof gelfServer)) return new gelfServer(options);
    if(!options) options={};
    var self = this;
    self._port = options.port || DEFAULT_PORT;
    self._addr = options.addr || DEFAULT_ADDR;
    self._shouldNotifyBadMsg = options.notifyBadMsg || false;
    self._chunkTTL = (options.chunkTTL && options.chunkTTL > 0) ?  options.chunkTTL :  DEFAULT_CHUNK_TTL;
    self._chunkedMessages = new ttlStore({ttl: self._chunkTTL});
    self._parseJSON = (options.parseJSON === true ? true : false);

    var proto = (options.hasOwnProperty('proto') && /udp[46]/.test(options.proto) ? options.proto : 'udp4');
    if(options.listener) 
        self.addListener('message', listener);
    var sock = dgram.createSocket(proto);
    sock.on('message', function(msg, r) {
            self._handleMessage(msg, r);
            });
    sock.on('listening', function() { self.emit('ready') });
    sock.on('close', function() { self.emit('end') });
    sock.on('error', function(err) { throw err });
    self.sock = sock;
}

util.inherits(gelfServer, EventEmitter);

gelfServer.prototype.start = function() {
    this.sock.bind(this._port, this._addr);
}

gelfServer.prototype.stop = function() {
    this.sock.close();
    this._chunkedMessages.close();
    this._chunkedMessages = undefined;
}

gelfServer.prototype.address = function() {
    return this.sock.address();
}

gelfServer.prototype._notifyBadMsg = function(err, data, sender) {
    if(this._shouldNotifyBadMsg === true) {
        this.emit('badmessage', { 'error': err, 'data': data.toString('base64'), 'sender': sender });
    }
}

gelfServer.prototype._handleChunkedData = function (msg, r, chunked, chunks) {
    var self = this;
    var msgId = msg.slice(2,10).toString('base64') + ":" + r.address; //msgId in packet + remote address form the key
    var seq = msg[10];
    var total = msg[11];
    var Chunk = msg.slice(12);
    var chunkedMessages = self._chunkedMessages;
    if(chunked) {
        // This is a message recontructed from chunked messages
        // i.e. a chunked message inside another chunked message
        self._chunkedMessages.remove(msgId);
        this._notifyBadMsg('Chunked message inside a chunked message', msg, r);
        return null;
    }
//    console.log("Received Chunk: " + (seq+1) + "/ " + total + " of msg " + msgId);
    if(chunkedMessages.has(msgId)) {
        var cmsg = chunkedMessages.get(msgId);
        // Part of an already read chunked message
        if(!cmsg.chunks[seq]) {
            cmsg.chunksReceived += 1;
            cmsg.chunks[seq] = Chunk;
            cmsg.totalLen += Chunk.length;
        }

        //console.log(JSON.stringify(cmsg));
        if(cmsg.totalChunks == cmsg.chunksReceived) {
 //           console.log("Complete message for msg:" + msgId + " received");
            fullMsg=concatBuffers(cmsg.chunks, cmsg.totalLen);
//            console.log(fullMsg);
            process.nextTick(function() {
                    self._handleMessage(fullMsg, r, true, cmsg.totalChunks);
                    self._chunkedMessages.remove(msgId);
                    });
        }
    } else {
        // New chunked message
//        console.log("Received new chunked message: " + msgId);
        var newChunk = {
            "totalChunks" : total,
            "chunksReceived" : 1,
            "chunks" : new Array(),
            "totalLen" : 0
        };
        newChunk.chunks[seq] = Chunk;
        newChunk.totalLen += Chunk.length;
        chunkedMessages.put(msgId, newChunk);
    }
}

gelfServer.prototype._handleZlibData = function(msg, r, chunked, chunks) {
    var self = this;
    zlib.unzip(msg, function(err,data) {
            if(!err) {
                     self.emit('message', 
                        {
                        'data': self._decodeMsg(data.toString('utf-8')),
                        'compression': 'ZLIB',
                        'chunked': (chunked ? true : false), 
                        'chunks': (chunked && chunks ? chunks : 1),
                        'sender': r.address 
                     });
                } else {
                    self._notifyBadMsg("Unzip Failed: " + err, msg, r);
                }
            });
}

gelfServer.prototype._handleGzipData = function(msg, r, chunked, chunks) {
    var self = this;
    zlib.gunzip(msg, function(err,data) {
                if(!err) {
                     self.emit('message', 
                        {
                        'data': self._decodeMsg(data.toString('utf-8')),
                        'compression': 'GZIP',
                        'chunked': (chunked ? true : false), 
                        'chunks': (chunked && chunks ? chunks : 1),
                        'sender': r.address 
                     });
                } else {
                    self._notifyBadMsg("GUnzip Failed: " + err, msg, r);
                }
            });
}

gelfServer.prototype._handleUncompressedData = function(msg, r, chunked, chunks) {
    var self = this;
    self.emit('message', 
            {
            'data': self._decodeMsg(msg.slice(2).toString('utf-8')),
            'compression': 'NONE',
            'chunked': (chunked ? true : false), 
            'chunks': (chunked && chunks ? chunks : 1),
            'sender': r.address 
            });
}

gelfServer.prototype._handleMessage = function(msg, r, chunked, chunks) {
    if(msg[0] == 0x78 && msg[1] == 0x9c) { // ZLib-ed message
        this._handleZlibData(msg, r, chunked, chunks);
    } else if(msg[0] == 0x1f && msg[1] == 0x8b) { // Gzipped message
        this._handleGzipData(msg, r, chunked, chunks);
    } else if(msg[0] == 0x1e && msg[1] == 0x0f) { // Chunked message
        this._handleChunkedData(msg,r, chunked, chunks);
    } else if(msg[0] == 0x1f && msg[1] == 0x3c) { //Uncompressed
        this._handleUncompressedData(msg, r, chunked, chunks);
    } else {
        this._notifyBadMsg("Invalid magic number", msg, r);
    }
}

gelfServer.prototype.parseJSON = function (flag) {
    if(flag == undefined) {
        return self._parseJSON;
    }
    if(flag === true || flag === false) {
        self._parseJSON = flag;
    }
}

gelfServer.prototype._decodeMsg = function (msg) {
    if(this._parseJSON == true) {
        return JSON.parse(msg);
    } else {
        return msg;
    }
}

function createGELFServer(options) {
    return new gelfServer(options);
}

exports.createGELFServer = createGELFServer;
