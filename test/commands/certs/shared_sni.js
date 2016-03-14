'use strict';

let expect = require('chai').expect;
let nock   = require('nock');
let error  = require('../../../lib/error.js');

let endpoint            = require('../../stubs/sni-endpoints.js').endpoint;
let endpoint2           = require('../../stubs/sni-endpoints.js').endpoint2;
let endpoint_cname      = require('../../stubs/sni-endpoints.js').endpoint_cname;
let assert_exit         = require('../../assert_exit.js');
let certificate_details = require('../../stubs/sni-endpoints.js').certificate_details;

exports.shouldHandleArgs = function(command, txt, certs, callback, options)  {

  let args = options.args || {};
  let flags = options.flags || {};
  let stdout = options.stdout || function() {return '';};
  let stderr = options.stderr || function() {return '';};

  describe(`${command}`, function() {
    beforeEach(function() {
      cli.mockConsole();
      error.exit.mock();
      nock.cleanAll();
    });
  
    it('allows an SNI --endpoint to be specified using --name', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint]);
  
      let mock = callback('/apps/example/sni-endpoints/tokyo-1050', endpoint, 'sni_ssl_cert');

      return certs.run({app: 'example', args: args, flags: Object.assign({}, flags, {name: 'tokyo-1050'})}).then(function() {
        mock_ssl.done();
        mock_sni.done();
        mock.done();
        expect(cli.stderr).to.equal(stderr(endpoint));
        expect(cli.stdout).to.equal(stdout(certificate_details, endpoint));
      });
    });

    it(txt + '(SNI)', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint]);
  
      let mock = callback('/apps/example/sni-endpoints/tokyo-1050', endpoint, 'sni_ssl_cert');

      return certs.run({app: 'example', args: args, flags: Object.assign({}, flags, {name: 'tokyo-1050'})}).then(function() {
        mock_ssl.done();
        mock_sni.done();
        mock.done();
        expect(cli.stderr).to.equal(stderr(endpoint));
        expect(cli.stdout).to.equal(stdout(certificate_details, endpoint));
      });
    });

    it('# errors out for --endpoint when there are multiple ', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint, endpoint_cname]);
  
      return assert_exit(1, certs.run({app: 'example', args: args, flags: {bypass: true, endpoint: 'tokyo-1050.herokussl.com', confirm: 'example'}})).then(function() {
        mock_ssl.done();
        mock_sni.done();
        expect(cli.stderr).to.equal(' ▸    Must pass --name when more than one endpoint matches --endpoint\n');
        expect(cli.stdout).to.equal('');
      });
    });
  
    it('# allows an SNI endpoint to be specified using --endpoint', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint]);
 
      let mock = callback('/apps/example/sni-endpoints/tokyo-1050', endpoint, 'sni_ssl_cert');
  
      return certs.run({app: 'example', args: args, flags: Object.assign({}, flags, {endpoint: 'tokyo-1050.herokussl.com'})}).then(function() {
        mock_ssl.done();
        mock_sni.done();
        mock.done();
        expect(cli.stderr).to.equal(stderr(endpoint));
        expect(cli.stdout).to.equal(stdout(certificate_details, endpoint));
      });
    });

    it('# --endpoint errors out if there is no match', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, []);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint2]);
  
      return assert_exit(1, certs.run({app: 'example', args: args, flags: Object.assign({}, flags, {endpoint: 'tokyo-1050.herokussl.com'})})).then(function() {
        mock_ssl.done();
        mock_sni.done();
        expect(cli.stderr).to.equal(' ▸    Record not found.\n');
        expect(cli.stdout).to.equal('');
      });
    });
  
    it('# --name errors out in the case where more than one matches', function() {
      let mock_ssl = nock('https://api.heroku.com')
      .get('/apps/example/ssl-endpoints')
      .reply(200, [endpoint]);
  
      let mock_sni = nock('https://api.heroku.com')
      .get('/apps/example/sni-endpoints')
      .reply(200, [endpoint]);
  
      return assert_exit(1, certs.run({app: 'example', args: args, flags: {bypass: true, name: 'tokyo-1050', confirm: 'example'}})).then(function() {
        mock_ssl.done();
        mock_sni.done();
        expect(cli.stderr).to.equal(' ▸    More than one endpoint matches tokyo-1050, please file a support ticket\n');
        expect(cli.stdout).to.equal('');
      });
    });

  });
};