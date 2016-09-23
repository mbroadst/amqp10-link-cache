'use strict';
var Promise = require('bluebird'),
    amqp = require('amqp10'),
    linkCache = require('..'),
    AMQPClient = amqp.Client,
    config = require('./config'),
    expect = require('chai').expect;

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
    { description: 'receiver links', method: 'createReceiver' },
    { description: 'sender streams', method: 'createSenderStream' },
    { description: 'receiver streams', method: 'createReceiverStream' }
  ].forEach(function(testCase) {
    it('should return cached ' + testCase.description, function() {
      return test.client.connect(config.address)
        .then(function() {
          return Promise.all([
            test.client[testCase.method]('amq.topic'),
            test.client[testCase.method]('amq.topic'),
            test.client[testCase.method]('amq.topic')
          ]);
        })
        .spread(function(link1, link2, link3) {
          expect(link1).to.eql(link2);
          expect(link1).to.eql(link3);
          expect(link2).to.eql(link3);
        });
    });

    it('should return different ' + testCase.description + ' based on address/options', function() {
      return test.client.connect(config.address)
        .then(function() {
          return Promise.all([
            test.client[testCase.method]('amq.topic'),
            test.client[testCase.method]('amq.topic', { attach: { receiverSettleMode: false } }),
            test.client[testCase.method]('amq.topic/testing')
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
          test.client.createReceiver('amq.topic'),
          test.client.createReceiver('amq.topic', { bypassCache: true })
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
          test.client.createReceiver('amq.topic'),
          test.client2.createReceiver('amq.topic')
        ]);
      })
      .spread(function(link1, link2) { expect(link1).to.not.eql(link2); })
      .then(function() { delete test.client2; });
  });
});
