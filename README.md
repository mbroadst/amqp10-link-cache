# amqp10-link-cache
[![Build Status](https://travis-ci.org/mbroadst/amqp10-link-cache.svg)](https://travis-ci.org/mbroadst/amqp10-link-cache)
[![Dependency Status](https://david-dm.org/mbroadst/amqp10-link-cache.svg)](https://david-dm.org/mbroadst/amqp10-link-cache.svg)

This module allows you to reuse already created links with the same link
options throughout your codebase. This is particularly useful as you no longer
need to make all of the links up front before using them, you can simply
_always_ create the links where you need them and know that it will either be
created or a cached copy will be returned.

## usage
```javascript
'use strict';
var amqp = require('amqp'),
    linkCache = require('amqp10-link-cache');

// defaults
var options = {
  ttl: 60000,             // ttl in ms
  cacheReceiver: true,    // set to 'false' to disable caching receiver
  cacheSender: true       // or sender
}

// plug-in the link cache, with optional parameters
amqp.use(linkCache(options));

var client = new amqp.Client();
client.connect('amqp://localhost')
  .then(function() {
    return Promise.all([ client.createSender('amq.topic'), client.createSender('amq.topic') ]);
  })
  .spread(function(sender1, sender2) {
    // sender1 === sender2
  });
```
