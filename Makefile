ifdef GREP
	GREPARG = -g $(GREP)
endif

REPORTER ?= spec
TESTS = ./test
NPM_BIN = ./node_modules/.bin

jshint:
	$(NPM_BIN)/jshint index.js test

test: jshint
	$(NPM_BIN)/mocha --globals setImmediate,clearImmediate --recursive --check-leaks --colors -t 10000 --reporter $(REPORTER) $(TESTS) $(GREPARG)

changelog:
	${NPM_BIN}/conventional-changelog -p angular -i CHANGELOG.md -s

.PHONY: jshint test changelog
