'use strict';

var LinkCache = require('../'),
    AMQPClient = require('amqp10').Client,
    config = require('./config'),
    expect = require('chai').expect;

var test = {};
describe('LinkCache', function() {
  beforeEach(function() {
    if (!!test.client) delete test.client;
    if (!!test.cache) delete test.cache;

    test.client = new AMQPClient();
    test.cache = new LinkCache(test.client);
  });

  afterEach(function() {
    return test.client.disconnect().then(function() {
      delete test.client;
      delete test.cache;
    });
  });

  [
    { description: 'sender links', method: 'createSender' },
    { description: 'receiver links', method: 'createReceiver' }
  ].forEach(function(testCase) {
    it('should return cached ' + testCase.description, function() {
      return test.client.connect('amqp://' + config.amqpServer)
        .then(function() {
          return Promise.all([
            test.cache[testCase.method]('amq.topic'),
            test.cache[testCase.method]('amq.topic'),
            test.cache[testCase.method]('amq.topic')
          ]);
        })
        .spread(function(link1, link2, link3) {
          expect(link1).to.eql(link2);
          expect(link1).to.eql(link3);
          expect(link2).to.eql(link3);
        });
    });

    it('should return different ' + testCase.description + ' based on address/options', function() {
      return test.client.connect('amqp://' + config.amqpServer)
        .then(function() {
          return Promise.all([
            test.cache[testCase.method]('amq.topic'),
            test.cache[testCase.method]('amq.topic', { attach: { receiverSettleMode: false } }),
            test.cache[testCase.method]('amq.topic/testing')
          ]);
        })
        .spread(function(link1, link2, link3) {
          expect(link1).to.not.eql(link2);
          expect(link1).to.not.eql(link3);
          expect(link2).to.not.eql(link3);
        });
    });
  });

});