# GELF Receiver

This is a NodeJS module to implement a [GELF][1] receiver. The module can
currently handle following kinds of GELF events.

* Uncompresssed
* GZIPed
* ZLIBed
* Chunked - The chunked message can again be any of the three formats above

# API

To create a GELF receiver one must `require('gelfr')`,then call the
createGELFServer() to create a server instance, subscribe to *'message'*
event and start the server.
 
    var gelfr = require('gelfr');
    var s = gelfr.createGELFServer();
    s.on('message', function (msg) { console.log(JSON.stringify(msg) });
    s.start();
    
## Functions

### createGELFServer(options)

Creates a new GELF receiver. The *options* argument is optional and can
have following fields:

* *proto* - udp4 or udp6. (Default: *udp4*)
* *port* - port to listen for events. Default is *0* i.e. any random port
           available for listening
* *addr* - address to bind to. (Default: *'0.0.0.0'*)
* *listener* - Listener function for *message* events. None by default
* *notifyBadMsg* - true or false. If set emits badmessage event when
  invalid messages arrive. (Default: *false*)
* *chunkTTL* - TTL for reconstruction of chunked messages in seconds. If
  all parts of a chunked message does not arrive within this time it will be
  dropped. (Default: *2 seconds*)
* *parseJSON* - ture or false - Set whether the message should be parsed as
  into a JSON object. (Default: *false*)

## GELF Server Functions

`createGELFServer(options)` returns a receiver object. The receiver object
has the following functions asssociated with it.
    
### start()

Start the server

### stop()

Stop the server

### address()

Return the address of the server. Returns the IP address and port to which
the receiver is listening to.

### parseJSON(flag)

If no flag is passed returns whether the received message will be parsed
into an object or not. If the flag is passed (true or false) then it
enables/disables parsing of received message to an object.

## Events

GELF Receiver emits following events

### ready

`function () { }`

Emitted when server is ready to receive packets. 

### end

`function () { }`

Emitted when server has stopped and will no more receive any packets and
will not emit any more events.

### message

`function (msg) { }`

Emitted when a new message is received. For chunked messages this event
will be emitted once all the chunks have been received and the message is
reassembled. The *msg* argument passed is an object with following
properties.

    {
        compression: 'GZIP' or 'ZLIB' or 'NONE', /* compression method */
        chunked: true or false, /* whether the message was chunked */
        chunks: <int>, /* number of chunks. for non-chunked messages 1 */
        data: 'utf8-string' or Parsed-json-object, /* payload */
        sender: 'ip-address', /* ip adress string of the sender */
    }

### error

`function (err) { }`

Emitted when there is some error.

### badmessage

`function (err) { }`

Emitted when a bad/invalid message is received and notifyBadMsg option was
set to *true* when creating the listener. The *err* object looks like below:

    {
        error: "error_string",
        data: Binary_data, /* the data packet that caused error */
        sender: 'ip-address', /* ip address of the sender */
    }

[1]: https://github.com/Graylog2/graylog2-docs/wiki/GELF "GELF Format"

# License
(The MIT License)

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

# Authors

* Damodharan Rajalingam (damu at yahoo-inc dot com)
