'use strict';
var util = require('util');
var errors = module.exports = {};

errors.BaseError = function () {
    var tmp = Error.apply(this, arguments);
    tmp.name = this.name = '';

    this.message = tmp.message;
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, this.constructor);
};
util.inherits(errors.BaseError, Error);

errors.InReconnectingStateError = function () {
    this.name = 'InReconnectingState';
    this.message = 'Cannot create link because connection in in reconnect mode please try again in a couple 500 ms';
};
util.inherits(errors.InReconnectingStateError, errors.BaseError);

