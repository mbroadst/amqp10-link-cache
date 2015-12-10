# amqp10-link-cache
[![Build Status](https://travis-ci.org/mbroadst/amqp10-link-cache.svg)](https://travis-ci.org/mbroadst/amqp10-link-cache)
[![Dependency Status](https://david-dm.org/mbroadst/amqp10-link-cache.svg)](https://david-dm.org/mbroadst/amqp10-link-cache.svg)

This module allows you to reuse already created links with the same link
options throughout your codebase. This is particularly useful as you no longer
need to make all of the links up front before using them, you can simply
_always_ create the links where you need them and know that it will either be
created or a cached copy will be returned.

## usage
```
'use strict';
var LinkCache = require('../'),
    AMQPClient = require('amqp10').Client;

var client = new AMQPClient();
client.connect('amqp://localhost')
  .then(function() { return new LinkCache(client); });
  .then(function(cache) {
    // e.g. pass cache to all of your API endpoints _as_ the 'client'

    return Promise.all([ cache.crateSender('amq.topic'), cache.crateSender('amq.topic') ]);
  })
  .spread(function(sender1, sender2) {
    // sender1 === sender2
  });
```
