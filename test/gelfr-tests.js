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

var zlib = require('zlib'),
    dgram = require('dgram'),
    os = require('os'),
    assert=require('assert'),
    gs = require('../index');

/* 
   Test information
*/
var recv_test_results = {
    'GZIP': '',
    'ZLIB': '',
    'NONE': '',
    'chunked-GZIP': '',
    'chunked-ZLIB': '',
    'chunked-NONE': ''
};

/* Set the event to true when the event fires */
var event_test_results = {
    'ready': false,
    'end': false,
    'badmessage': false
     // 'message' event is covered by data receive tests
}

/* Number of messages received */
var messages_count = 0;

var data = {
    "host": os.hostname(),
    "version":"1.0",
    "timestamp": Math.floor(+new Date() / 1000), 
    "facility":"gelf-tester",
    "short_message":"This is a test message to test the gelfr module."
};

var json_data = JSON.stringify(data);

/*
   Utility functions
*/

/* Function to send multiple UDP packets */
function sendUDPPackets(dataArray, port, addr) {
    if(dataArray.length != 0) {
        data = dataArray.shift();
        client.send(data, 0, data.length, port, addr, function (err,bytes) {
            if(!err) { sendUDPPackets(dataArray, port, addr); }
        });
    }
}

/* Function to chunk messages */
function getChunks(arr,msg, id_str, csize, max_chunks) {
    var chunk_size = csize || 100;
    var total_chunks=Math.ceil(msg.length/chunk_size);
    var chunks_to_send = Math.min(total_chunks, max_chunks||Infinity);
    var msg_id=new Buffer(id_str+(+new Date()));
    var data=new Buffer(msg);
    var i=0;
    var rem=data.length;
    var dArr = [];
    while(i<chunks_to_send) {
        var cbuf;
        if(rem > chunk_size) {
            cbuf = new Buffer(12+chunk_size);
            data.copy(cbuf,12,i*chunk_size, (i+1)*chunk_size);
        } else {
            cbuf = new Buffer(12+rem);
            data.copy(cbuf,12,i*chunk_size, i*chunk_size+rem);
        }
        cbuf[0]=0x1e;
        cbuf[1]=0x0f;
        cbuf[11]=total_chunks;
        cbuf[10]=i; // sequence number
        msg_id.copy(cbuf,2,0,8);
        arr.push(cbuf);
        i++;
        rem -= chunk_size;
    }
}

function assertResults() {
    /* Test if all message types have been received successfully */
    for(var test in recv_test_results) {
        console.log("Testing message type: " + test);
        assert.equal(recv_test_results[test], json_data, "Data received for " + test + " is incorrect");
    }

    console.log("Check if all messages were received and no invalid messages delivered");
    assert.equal(messages_count, 6, "Invalid message count");

    /* Test if events fired correctly */
    for(var e in event_test_results) {
        console.log("Testing event: " + e);
        assert.equal(event_test_results[e], true, "Event " + e + " was not triggered");
    }
    console.log("All tests OK");
}

/*
   Initialize the server
*/
var server = gs.createGELFServer({
    'notifyBadMsg' : true,
    'addr': '127.0.0.1',
    'port': 11212,
    'chunkTTL': 2
});

server.on('ready', function() {
        var addr = server.address();
        console.log("Server started successfully. (Listening on " + addr.address + ":" + addr.port + ")");
        event_test_results.ready = true;
        });

server.on('end', function() {
        console.log("Server shutdown successfully");
        event_test_results.end = true;
        });

server.on('badmessage', function(err) {
        console.log("Bad message received");
        event_test_results.badmessage = true;
        });

server.on('message', function (msg) {
        var test_type = (msg.chunked ? 'chunked-' : '') + msg.compression;
        console.log("Received message of type " + test_type);
        recv_test_results[test_type] = msg.data;
        console.log("Received message: " + msg.data);
        messages_count++;
        });

server.start();

/*
   Client setup and send test data
*/
var client = dgram.createSocket('udp4');
var server_addr = '127.0.0.1';
var server_port = server.address().port;
var arr=[];
var completed=0;
var total_types = 3; // ZLIB, GZIP and UNCOMPRESSED
/* ZLIB data */
zlib.deflate(json_data, function(err,data) {
            if(!err) {
                client.send(data, 0,data.length, server_port, server_addr);
                getChunks(arr,data,'zlib-chunked');
                completed++;
                if(completed == total_types) { sendUDPPackets(arr,server_port,server_addr); }
            } else {
                console.log("Error ZLIB-ing data: "  + err);
            }
        });

/* GZIP data */
zlib.gzip(json_data, function(err,data) {
            if(!err) {
                client.send(data, 0, data.length, server_port, server_addr);
                getChunks(arr,data,'gzip-chunked');
                completed++;
                if(completed == total_types) { sendUDPPackets(arr,server_port,server_addr); }
            } else {
                console.log("Error GZIP-ing data: "  + err);
            }
        });

/* Uncompressed data */
var udata = new Buffer('00' + json_data);
udata[0]=0x1f;
udata[1]=0x3c;
client.send(udata, 0, udata.length, server_port, server_addr);
getChunks(arr,udata,'none-chunked');
// Send an incomplete chunk message by restricting max_chunks to 1
getChunks(arr,udata,'incomplete-chunked',100,1);
completed++;
if(completed == total_types) { sendUDPPackets(arr,server_port,server_addr); }

/* Bad data */
var bdata = new Buffer(udata.length);
udata.copy(bdata);
bdata[0]=0;
client.send(bdata, 0, bdata.length, server_port, server_addr);

/* Stop the server after waiting for 1 sec */
setTimeout( function() {
        server.stop();
        client.close();
        assertResults();
        }, 2000);

