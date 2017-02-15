'use strict';
var Promise = require('bluebird'),
    amqp = require('amqp10'),
    linkCache = require('..'),
    AMQPClient = amqp.Client,
    config = require('./config'),
    expect = require('chai').expect;

function listenerNames(emitter, eventName) {
  return emitter.listeners(eventName)
    .map(function(f) { return f.hasOwnProperty('listener') ? f.listener.name : f.name; });
}

var test = {};
describe('basic behavior', function() {
  before(function() { amqp.use(linkCache()); });
  beforeEach(function() {
    if (!!test.client) delete test.client;
    test.client = new AMQPClient();
  });

  afterEach(function() {
    return test.client.disconnect()
      .then(function() { delete test.client; });
  });

  [
    { description: 'sender links', method: 'createSender' },
    { description: 'receiver links', method: 'createReceiver', options: { bypassCache: false } },
    { description: 'sender streams', method: 'createSenderStream' },
    { description: 'receiver streams', method: 'createReceiverStream', options: { bypassCache: false } }
  ].forEach(function(testCase) {
    it('should return cached ' + testCase.description, function() {
      var options = testCase.options || {};
      return test.client.connect(config.address)
        .then(function() {
          return Promise.all([
            test.client[testCase.method]('amq.topic', options),
            test.client[testCase.method]('amq.topic', options),
            test.client[testCase.method]('amq.topic', options)
          ]);
        })
        .spread(function(link1, link2, link3) {
          expect(link1).to.eql(link2);
          expect(link1).to.eql(link3);
          expect(link2).to.eql(link3);
        });
    });

    it('should return different ' + testCase.description + ' based on address/options', function() {
      var options = testCase.options || {};
      var attachOptions = options;
      attachOptions.attach = { receiverSettleMode: false };

      return test.client.connect(config.address)
        .then(function() {
          return Promise.all([
            test.client[testCase.method]('amq.topic'),
            test.client[testCase.method]('amq.topic', attachOptions),
            test.client[testCase.method]('amq.topic/testing', options)
          ]);
        })
        .spread(function(link1, link2, link3) {
          expect(link1).to.not.eql(link2);
          expect(link1).to.not.eql(link3);
          expect(link2).to.not.eql(link3);
        });
    });
  });

  it('should allow a user to bypass the link cache explicitly', function() {
    return test.client.connect(config.address)
      .then(function() {
        return Promise.all([
          test.client.createSender('amq.topic'),
          test.client.createSender('amq.topic', { bypassCache: true })
        ]);
      })
      .spread(function(link1, link2) {
        expect(link1).to.not.eql(link2);
      });
  });

  it('should bypass the cache for dynamic links', function() {
    return test.client.connect(config.address)
      .then(function() {
        return Promise.all([
          test.client.createReceiver(null, { attach: { source: { dynamic: true } } }),
          test.client.createReceiver(null, { attach: { source: { dynamic: true } } })
        ]);
      })
      .spread(function(link1, link2) {
        expect(link1).to.not.eql(link2);
      });
  });

  it('should maintain link caches per-client', function() {
    test.client2 = new AMQPClient();
    return Promise.all([ test.client.connect(config.address), test.client2.connect(config.address) ])
      .then(function() {
        return Promise.all([
          test.client.createSender('amq.topic'),
          test.client2.createSender('amq.topic')
        ]);
      })
      .spread(function(link1, link2) { expect(link1).to.not.eql(link2); })
      .then(function() { delete test.client2; });
  });

  it('should not listen for `deatched` events if link is configured for reattach', function() {
    test.client2 = new AMQPClient();
    return test.client.connect(config.address)
      .then(function() {
        return Promise.all([
          test.client.createSender('amq.topic'),
          test.client.createReceiver('amq.topic', { bypassCache: false })
        ]);
      })
      .spread(function(sender, receiver) {
        expect(listenerNames(sender, 'detached')).to.not.include('hashDetached');
        expect(listenerNames(receiver, 'detached')).to.not.include('hashDetached');
      });
  });

  it('should listen for `deatched` events if link is not configured for reattach', function() {
    test.client2 = new AMQPClient();
    return test.client.connect(config.address)
      .then(function() {
        return Promise.all([
          test.client.createSender('amq.topic', { reattach: false }),
          test.client.createReceiver('amq.topic', { bypassCache: false, reattach: false })
        ]);
      })
      .spread(function(sender, receiver) {
        expect(listenerNames(sender, 'detached')).to.include('hashDetached');
        expect(listenerNames(receiver, 'detached')).to.include('hashDetached');
      });
  });
});
