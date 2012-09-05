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

var g = require('../index');

s = g.createGELFServer({
        port: 11211, /* Port to listen for GELF events. Optional. Default: 0 i.e any random port*/
        addr: "0.0.0.0", /* Address to bing to. Optional. Default: 0.0.0.0 (all addresses) */
        proto: "udp4" /* udp4 or udp6. Optional. Default: udp4 */
        });

s.on('message', function(msg) {
        console.log("Received : " + JSON.stringify(msg));
        });

s.on('ready', function() {
        console.log("Server started to listen for packets");
        });

s.on('error', function(err) {
        console.log("Error: " + JSON.stringify(err));
        });

s.on('end', function() {
        console.log("Server has stopped");
        });

process.on('SIGINT', function() {
        s.stop();
        });
        
s.start();
