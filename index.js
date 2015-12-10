'use strict';
var Promise = require('bluebird'),
    hash = require('object-hash');

function LinkCache(client) {
  this._client = client;
  this._receiverLinks = {};
  this._senderLinks = {};
}

LinkCache.prototype.createSender = function(address, options) {
  return this._createLink(address, options, this._senderLinks, 'createSender');
};

LinkCache.prototype.createReceiver = function(address, options) {
  return this._createLink(address, options, this._receiverLinks, 'createReceiver');
};

LinkCache.prototype._createLink = function(address, options, container, method) {
  var linkHash = hash({ address: address, options: options });
  if (container.hasOwnProperty(linkHash)) {
    return Promise.resolve(container[linkHash]);
  }

  var linkPromise = this._client[method](address, options)
    .then(function(link) {
      link.once('detached', function() { delete container[linkHash]; });
      container[linkHash] = link;
      return link;
    });

  container[linkHash] = linkPromise;
  return linkPromise;
};

module.exports = LinkCache;