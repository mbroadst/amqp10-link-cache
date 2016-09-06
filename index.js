'use strict';
var Promise = require('bluebird'),
    hash = require('object-hash');

var links = {};
var ttl = 60000;
var purgeTimeout = null;

function createLink(address, options, type, method) {
  if (options && options.hasOwnProperty('bypassCache') && !!options.bypassCache) {
    return method(address, options);
  }

  var linkHash = hash({ type: type, address: address, options: options });
  if (links.hasOwnProperty(linkHash)) {
    var entry = links[linkHash];
    if (!entry.hasOwnProperty('link'))
      return entry;

    links[linkHash].stamp = Date.now();
    return Promise.resolve(links[linkHash].link);
  }

  var linkPromise = method(address, options)
    .then(function(link) {
      link.once('detached', function() {
        if (links.hasOwnProperty(linkHash))
          delete links[linkHash];
      });

      links[linkHash] = { link: link, stamp: Date.now() };
      if (!purgeTimeout)
        purgeTimeout = setTimeout(purgeLinks, ttl);
      return link;
    });

  links[linkHash] = linkPromise;
  return linkPromise;
}

function purgeLinks() {
  var now = Date.now();
  var _keys = Object.keys(links),
      expired = [], live = 0;

  purgeTimeout = null;
  for (var i = 0, ii = _keys.length; i < ii; ++i) {
    if (now - links[_keys[i]].stamp >= ttl) {
      expired.push(_keys[i]);
    } else {
      live++;
    }
  }

  for (var j = 0, jj = expired.length; j < jj; ++j) {
    var cacheEntry = links[expired[j]];
    delete links[expired[j]];
    cacheEntry.link.detach();
  }

  if (live) {
    purgeTimeout = setTimeout(purgeLinks, ttl);
  }
}

module.exports = function(options) {
  // NOTE: we need to re-initialize these every time the plugin is called
  options = options || {};
  links = {};
  ttl = options.ttl || 60000;
  if (!!purgeTimeout) clearTimeout(purgeTimeout);
  purgeTimeout = null;

  return function(Client) {
    var _createSender = Client.prototype.createSender,
        _createReceiver = Client.prototype.createReceiver,
        _createSenderStream = Client.prototype.createSenderStream,
        _createReceiverStream = Client.prototype.createReceiverStream;

    Client.prototype.createSender = function(address, options) {
      return createLink(address, options, 'sender', _createSender.bind(this));
    };

    Client.prototype.createReceiver = function(address, options) {
      return createLink(address, options, 'receiver', _createReceiver.bind(this));
    };

    Client.prototype.createSenderStream = function(address, options) {
      return createLink(address, options, 'senderStream', _createSenderStream.bind(this));
    };

    Client.prototype.createReceiverStream = function(address, options) {
      return createLink(address, options, 'receiverStream', _createReceiverStream.bind(this));
    };
  };
};
