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

function reaper(bins, reap_interval) {
    var oldBin = bins.pop();
    delete oldBin; //delete the really-old bin
    bins.unshift({}); //push a new 'new' bin
}

function ttlStore(options) {
    this._ttl = options['ttl'] || 0;
    this._bins = [
        {}, // new
        {}, // old
        {}  // really old
        ];
    if(this._ttl && this._ttl > 0) {
        this._reap_interval = Math.ceil((this._ttl * 1000)/2);
        var self=this;
        this._reaper = setInterval(function() { reaper(self._bins, self._reap_interval); }, self._reap_interval);
    }
}

ttlStore.prototype.put = function(key, val) {
    this._bins[0][key] = val;
    delete this._bins[1][key];
    delete this._bins[2][key];
}

ttlStore.prototype.get = function(key) {
    if(this._bins[0].hasOwnProperty(key)) return this._bins[0][key];
    if(this._bins[1].hasOwnProperty(key))return this._bins[1][key];
    return undefined;
}

ttlStore.prototype.remove = function(key) {
    if(this._bins[0].hasOwnProperty(key)) {
        var res = this._bins[0][key];
        delete this._bins[0][key];
        delete this._bins[1][key];
        return res;
    }
    if(this._bins[1].hasOwnProperty(key)) {
        var res = this._bins[1][key];
        delete this._bins[1][key];
        return res;
    }
    return undefined;
}

ttlStore.prototype.close = function() {
    clearInterval(this._reaper);
    delete this._bins;
}

ttlStore.prototype.has = function(key) {
    if(!key) return false;
    return (this._bins[0].hasOwnProperty(key) || this._bins[1].hasOwnProperty(key));
}

exports.ttlStore = ttlStore;
