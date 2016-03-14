'use strict';
var hash = require('object-hash');

function LinkCache(client, options) {
  options = options || {};
  this._client = client;
  this._links = {};
  this._ttl = options.ttl || 60000;
  this._purgeTimeout = null;

  client.on('disconnected', function() {});
}

LinkCache.prototype.createSender = function(address, options) {
  return this._createLink(address, options, 'sender', 'createSender');
};

LinkCache.prototype.createReceiver = function(address, options) {
  return this._createLink(address, options, 'receiver', 'createReceiver');
};

LinkCache.prototype._createLink = function(address, options, type, method) {
  var linkHash = hash({ type: type, address: address, options: options });
  if (this._links.hasOwnProperty(linkHash)) {
    var entry = this._links[linkHash];
    if (!entry.hasOwnProperty('link'))
      return entry;

    this._links[linkHash].stamp = Date.now();
    return Promise.resolve(this._links[linkHash].link);
  }

  var self = this;
  var linkPromise = this._client[method](address, options)
    .then(function(link) {
      link.once('detached', function() {
        if (self._links.hasOwnProperty(linkHash))
          delete self._links[linkHash];
      });

      self._links[linkHash] = { link: link, stamp: Date.now() };
      if (!self._purgeTimeout)
        self._purgeTimeout = setTimeout(self._purgeLinks.bind(self), self._ttl);
      return link;
    });


  this._links[linkHash] = linkPromise;
  return linkPromise;
};

LinkCache.prototype._purgeLinks = function() {
  var now = Date.now();
  var _keys = Object.keys(this._links),
      expired = [], live = 0;

  for (var i = 0, ii = _keys.length; i < ii; ++i) {
    if (now - this._links[_keys[i]].stamp >= this._ttl) {
      expired.push(_keys[i]);
    } else {
      live++;
    }
  }

  for (var j = 0, jj = expired.length; j < jj; ++j) {
    var cacheEntry = this._links[expired[j]];
    delete this._links[_keys[j]];
    cacheEntry.link.detach();
  }

  if (live && !this._purgeTimeout) {
    this._purgeTimeout = setTimeout(this._purgeLinks.bind(this), this._ttl);
  }
};

module.exports = LinkCache;
