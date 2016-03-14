'use strict';

let expect = require('chai').expect;
let nock   = require('nock');
var fs     = require('fs');
var sinon  = require('sinon');

let certs = require('../../../commands/certs/add.js');

let endpoint            = require('../../stubs/sni-endpoints.js').endpoint;
let endpoint_warning    = require('../../stubs/sni-endpoints.js').endpoint_warning;
let certificate_details = require('../../stubs/sni-endpoints.js').certificate_details;

let error = require('../../../lib/error.js');
let assert_exit = require('../../assert_exit.js');

describe('heroku certs:add', function() {
  beforeEach(function() {
    cli.mockConsole();
    sinon.stub(fs, 'readFile');
    nock.cleanAll();
    error.exit.mock();
  });

  describe('(ported)', function() {
    it('# adds an SSL endpoint if passed --endpoint', function() {
      nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      fs.readFile
        .withArgs('pem_file', sinon.match.func)
        .callsArgWithAsync(1, null, 'pem content');
      fs.readFile
        .withArgs('key_file', sinon.match.func)
        .callsArgWithAsync(1, null, 'key content');
  
      let mock_ssl = nock('https://api.heroku.com', {
        reqheaders: {'Accept': 'application/vnd.heroku+json; version=3.ssl_cert'}
      })
      .post('/apps/example/ssl-endpoints', {
        certificate_chain: 'pem content', private_key: 'key content'
      })
      .reply(200, endpoint);
  
      return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, endpoint: true}}).then(function() {
        mock_ssl.done();
        expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n');
        expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
${certificate_details}
`);
      });
    });
  });

  afterEach(function() {
    fs.readFile.restore();
  });

  it('# posts to ssl doctor', function() {
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

    let mock_ssl = nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(403, {
        "id":"ssl_endpoint_addon_required",
        "error":"The SSL Endpoint add-on needs to be installed on this app to manage endpoints."
    });

    let mock_sni = nock('https://api.heroku.com')
    .post('/apps/example/sni-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {}}).then(function() {
      ssl_doctor.done();
      mock_ssl.done();
      mock_sni.done();
      expect(cli.stderr).to.equal('Resolving trust chain... done\nAdding SSL Endpoint to example... done\n');
      expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
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

    let mock_ssl = nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(403, {
        "id":"ssl_endpoint_addon_required",
        "error":"The SSL Endpoint add-on needs to be installed on this app to manage endpoints."
    });

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {}})
    .then(function() {
      expect.fail("Expected exception");
    })
    .catch(function(err) {
      mock_ssl.done();
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

    let mock_ssl = nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(403, {
        "id":"ssl_endpoint_addon_required",
        "error":"The SSL Endpoint add-on needs to be installed on this app to manage endpoints."
    });

    let mock_sni = nock('https://api.heroku.com')
    .post('/apps/example/sni-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true}}).then(function() {
      mock_sni.done();
      mock_ssl.done();
      expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n');
      expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
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

    let mock_ssl = nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(403, {
        "id":"ssl_endpoint_addon_required",
        "error":"The SSL Endpoint add-on needs to be installed on this app to manage endpoints."
    });

    let mock_sni = nock('https://api.heroku.com')
    .post('/apps/example/sni-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint_warning);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true}}).then(function() {
      mock_sni.done();
      mock_ssl.done();
      expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n ▸    WARNING: ssl_cert provides no domain(s) that are configured for this Heroku app\n');
    });
  });

  it('# automatically creates an SNI endpoint if no SSL addon', function() {
    nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(403, {
        "id":"ssl_endpoint_addon_required",
        "error":"The SSL Endpoint add-on needs to be installed on this app to manage endpoints."
    });

    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let mock = nock('https://api.heroku.com')
    .post('/apps/example/sni-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true}}).then(function() {
      mock.done();
      expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n');
      expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
${certificate_details}
`);
    });
  });

  it('# errors out if there is an SSL addon and no flags set', function() {
    let mock_ssl = nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(200, []);

    return assert_exit(1, certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true}})).then(function() {
      mock_ssl.done();
      expect(cli.stderr).to.equal(' ▸    Must pass either --sni or --endpoint\n');
      expect(cli.stdout).to.equal('');
    });
  });

  it('# errors out if both flags set', function() {
    return assert_exit(1, certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, sni: true, endpoint: true}})).then(function() {
      expect(cli.stderr).to.equal(' ▸    Must pass just one of --sni or --endpoint\n');
      expect(cli.stdout).to.equal('');
    });
  });

  it('# creates an SNI endpoint if SSL addon and passed --sni', function() {
    nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(200, []);

    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let mock_sni = nock('https://api.heroku.com', {
      reqheaders: {'Accept': 'application/vnd.heroku+json; version=3.sni_ssl_cert'}
    })
    .post('/apps/example/sni-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, sni: true}}).then(function() {
      mock_sni.done();
      expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n');
      expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
${certificate_details}
`);
    });
  });

  it('# creates an SSL endpoint if SSL addon and passed --endpoint', function() {
    nock('https://api.heroku.com')
    .get('/apps/example/ssl-endpoints')
    .reply(200, []);

    fs.readFile
      .withArgs('pem_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'pem content');
    fs.readFile
      .withArgs('key_file', sinon.match.func)
      .callsArgWithAsync(1, null, 'key content');

    let mock_sni = nock('https://api.heroku.com', {
      reqheaders: {'Accept': 'application/vnd.heroku+json; version=3.ssl_cert'}
    })
    .post('/apps/example/ssl-endpoints', {
      certificate_chain: 'pem content', private_key: 'key content'
    })
    .reply(200, endpoint);

    return certs.run({app: 'example', args: {CRT: 'pem_file', KEY: 'key_file'}, flags: {bypass: true, endpoint: true}}).then(function() {
      mock_sni.done();
      expect(cli.stderr).to.equal('Adding SSL Endpoint to example... done\n');
      expect(cli.stdout).to.equal(
`example now served by tokyo-1050.herokussl.com
Certificate details:
${certificate_details}
`);
    });
  });

});