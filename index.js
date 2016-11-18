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

  if (options && options.hasOwnProperty('bypassCache') &&
      !!options.bypassCache) {
    return method(address, options);
  }

  var linkHash = hash({ type: type, address: address, options: options });
  if ({}.hasOwnProperty.call(client.links, linkHash)) {
    var entry = client.links[linkHash];
    if (!{}.hasOwnProperty.call(entry, 'link'))
      return entry;

    client.links[linkHash].stamp = Date.now();
    return Promise.resolve(client.links[linkHash].link);
  }

  var linkPromise = method(address, options)
    .then(function(link) {
      link.once('detached', function() {
        if ({}.hasOwnProperty.call(client.links, linkHash))
          delete client.links[linkHash];
      });

      client.links[linkHash] = { link: link, stamp: Date.now() };
      if (!purgeTimeout)
        purgeTimeout = setTimeout(function() {
          purgeLinks(client);
        }, ttl);
      return link;
    });

  client.links[linkHash] = linkPromise;
  return linkPromise;
}

function purgeLinks(client) {
  if (!client || !{}.hasOwnProperty.call(client, 'links')) {
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
    purgeTimeout = setTimeout(function() {
      purgeLinks(client);
    }, ttl);
  }
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

    var init = function(client) {
      if (!{}.hasOwnProperty.call(client, 'links')) {
        client.links = {};
      }
    };

    Client.prototype.createSender = function(address, options) {
      init(this);
      return createLink(this, address, options, 'sender',
                        _createSender.bind(this));
    };

    Client.prototype.createReceiver = function(address, options) {
      init(this);
      return createLink(this, address, options, 'receiver',
                        _createReceiver.bind(this));
    };

    Client.prototype.createSenderStream = function(address, options) {
      init(this);
      return createLink(this, address, options, 'senderStream',
                        _createSenderStream.bind(this));
    };

    Client.prototype.createReceiverStream = function(address, options) {
      init(this);
      return createLink(this, address, options, 'receiverStream',
                        _createReceiverStream.bind(this));
    };
  };
};
