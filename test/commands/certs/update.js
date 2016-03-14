'use strict';

let expect = require('chai').expect;
let nock   = require('nock');
var fs     = require('fs');
var sinon  = require('sinon');

let certs = require('../../../commands/certs/update.js');
let error = require('../../../lib/error.js');
let shared      = require('./shared.js');
let shared_ssl  = require('./shared_ssl.js');
let shared_sni  = require('./shared_sni.js');

let endpoint            = require('../../stubs/sni-endpoints.js').endpoint;
let endpoint_warning    = require('../../stubs/sni-endpoints.js').endpoint_warning;
let certificate_details = require('../../stubs/sni-endpoints.js').certificate_details;

describe('heroku certs:update', function() {
  beforeEach(function() {
    cli.mockConsole();
    sinon.stub(fs, 'readFile');
    nock.cleanAll();
    error.exit.mock();

    nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(200, []);

    nock('https://api.heroku.com')
    .get('/apps/example/sni-endpoints')
    .reply(200, [endpoint]);
  });

  afterEach(function() {
    fs.readFile.restore();
  });

  it('# requires confirmation', function() {
    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    var thrown = false;
    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {confirm: 'notexample', bypass: true}}).catch(function(err) {
      thrown = true;
      expect(err).to.equal('Confirmation notexample did not match example. Aborted.');
    }).then(function() {
      expect(thrown).to.equal(true);
    });
  });

  it('# updates an endpoint when ssl doctor passes', function() {
    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let ssl_doctor = nock('https://ssl-doctor.herokuapp.com', {
      reqheaders: {
        'content-type': 'application/octet-stream',
        'content-length': '23'
      }
    })
    .post('/resolve-chain-and-key', "pem content\nkey content")
    .reply(200, {pem: 'pem content', key: 'key content'});

    let mock = nock('https://api.heroku.com')
    .patch('/apps/example/sni-endpoints/tokyo-1050', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {name: 'tokyo-1050', confirm: 'example'}}).then(function() {
      ssl_doctor.done();
      mock.done();
      expect(cli.stderr).to.equal('Resolving trust chain... done\nUpdating SSL Endpoint tokyo-1050 (tokyo-1050.herokussl.com) for example... done\n');
      expect(cli.stdout).to.equal(
`Updated certificate details:
${certificate_details}
`);
    });
  });

  it('# propegates ssl doctor errors', function() {
    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let ssl_doctor = nock('https://ssl-doctor.herokuapp.com', {
      reqheaders: {
        'content-type': 'application/octet-stream',
        'content-length': '23'
      }
    })
    .post('/resolve-chain-and-key', "pem content\nkey content")
    .reply(422, "No certificate given is a domain name certificate.");

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {confirm: 'example'}})
    .then(function() {
      expect.fail("Expected exception");
    })
    .catch(function(err) {
      ssl_doctor.done();
      expect(cli.stdout).to.equal('');
      expect(cli.stderr).to.equal('Resolving trust chain... !!!\n');
      expect(err.message).to.equal("No certificate given is a domain name certificate.");
    });
  });

  it('# bypasses ssl doctor', function() {
    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let mock = nock('https://api.heroku.com')
    .patch('/apps/example/sni-endpoints/tokyo-1050', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {name: 'tokyo-1050', CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, confirm: 'example'}}).then(function() {
      mock.done();
      expect(cli.stderr).to.equal('Updating SSL Endpoint tokyo-1050 (tokyo-1050.herokussl.com) for example... done\n');
      expect(cli.stdout).to.equal(
`Updated certificate details:
${certificate_details}
`);
    });
  });

  it('# displays warnings', function() {
    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let mock = nock('https://api.heroku.com')
    .patch('/apps/example/sni-endpoints/tokyo-1050', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint_warning);

    return certs.run({app: 'example', args: {name: 'tokyo-1050', CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, confirm: 'example'}}).then(function() {
      mock.done();
      expect(cli.stderr).to.equal('Updating SSL Endpoint tokyo-1050 (tokyo-1050.herokussl.com) for example... done\n ▸    WARNING: ssl_cert provides no domain(s) that are configured for this Heroku app\n');
    });
  });

  describe('shared', function() {
    beforeEach(function() {
      fs.readFile
        .withArgs('pem_file', sinon.match.func)
        .callsArgWithAsync(1, null, 'pem content');
      fs.readFile
        .withArgs('key_file', sinon.match.func)
        .callsArgWithAsync(1, null, 'key content');
    });

    let callback = function(path, endpoint, variant) {
      return nock('https://api.heroku.com', {
        reqheaders: {'Accept': `application/vnd.heroku+json; version=3.${variant}`}
      })
      .patch(path, {
        certificate_chain: 'pem content', private_key: 'key content'
      })
      .reply(200, endpoint);
    };

    let stderr = function(endpoint) {
      return `Updating SSL Endpoint ${endpoint.name} (${endpoint.cname}) for example... done\n`;
    };

    let stdout = function(certificate_details) {
      return `Updated certificate details:\n${certificate_details}\n`;
    };

    shared.shouldHandleArgs('certs:update', 'updates an endpoint', certs, callback, {
      stderr, stdout, args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, confirm: 'example'}
    });

    shared_ssl.shouldHandleArgs('certs:update', 'updates an endpoint', certs, callback, {
      stderr, stdout, args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, confirm: 'example'}
    });

    shared_sni.shouldHandleArgs('certs:update', 'updates an endpoint', certs, callback, {
      stderr, stdout, args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, confirm: 'example'}
    });
  });

});