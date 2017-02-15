'use strict';
var Promise = require('bluebird'),
    hash = require('object-hash');

var ttl = 60000;
var purgeTimeout = null;

function createLink(client, address, options, type, method) {
  if (address === null) {
    // for the case of dynamically created links, we always want to bypass
    // the link cache
    return method(address, options);
  }

  options = options || {};
  if (!options.hasOwnProperty('bypassCache')) {
    options.bypassCache =
      (type === 'receiver' || type === 'receiverStream') ? true : false;
  }

  if (!!options.bypassCache) {
    return method(address, options);
  }

  var linkHash = hash({ type: type, address: address, options: options });
  if (client.links.hasOwnProperty(linkHash)) {
    var entry = client.links[linkHash];
    if (!entry.hasOwnProperty('link')) {
      // NOTE: this returns an existing Promise for the link
      return entry;
    }

    client.links[linkHash].stamp = Date.now();
    return Promise.resolve(client.links[linkHash].link);
  }

  var linkPromise = method(address, options)
    .then(function(link) {
      client.links[linkHash] = { link: link, stamp: Date.now() };

      if (!canReattach(link)) {
        link.once('detached', function hashDetached() { delete client.links[linkHash]; });
      }

      if (!purgeTimeout) {
        purgeTimeout = setTimeout(function() { purgeLinks(client); }, ttl);
      }

      return link;
    });

  client.links[linkHash] = linkPromise;
  return linkPromise;
}

function purgeLinks(client) {
  if (!client || !client.hasOwnProperty('links')) {
    return;
  }

  var now = Date.now();
  var _keys = Object.keys(client.links),
      expired = [], live = 0;

  purgeTimeout = null;
  for (var i = 0, ii = _keys.length; i < ii; ++i) {
    if (now - client.links[_keys[i]].stamp >= ttl) {
      expired.push(_keys[i]);
    } else {
      live++;
    }
  }

  for (var j = 0, jj = expired.length; j < jj; ++j) {
    var cacheEntry = client.links[expired[j]];
    delete client.links[expired[j]];
    cacheEntry.link.detach();
  }

  if (live) {
    purgeTimeout = setTimeout(function() { purgeLinks(client); }, ttl);
  }
}

function canReattach(link) {
  if (typeof link.policy === 'undefined') return true;
  return link.policy.reattach !== false;
}

function moduleInit(client) {
  if (!client.hasOwnProperty('links')) client.links = {};
}

module.exports = function(options) {
  // NOTE: we need to re-initialize these every time the plugin is called
  options = options || {};
  ttl = options.ttl || 60000;
  if (!!purgeTimeout) clearTimeout(purgeTimeout);
  purgeTimeout = null;

  return function(Client) {
    var _createSender = Client.prototype.createSender,
        _createReceiver = Client.prototype.createReceiver,
        _createSenderStream = Client.prototype.createSenderStream,
        _createReceiverStream = Client.prototype.createReceiverStream;

    Client.prototype.createSender = function(address, options) {
      moduleInit(this);
      return createLink(this, address, options, 'sender', _createSender.bind(this));
    };

    Client.prototype.createReceiver = function(address, options) {
      moduleInit(this);
      return createLink(this, address, options, 'receiver', _createReceiver.bind(this));
    };

    Client.prototype.createSenderStream = function(address, options) {
      moduleInit(this);
      return createLink(this, address, options, 'senderStream', _createSenderStream.bind(this));
    };

    Client.prototype.createReceiverStream = function(address, options) {
      moduleInit(this);
      return createLink(this, address, options, 'receiverStream', _createReceiverStream.bind(this));
    };
  };
};
