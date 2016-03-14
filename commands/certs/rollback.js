'use strict';

let co      = require('co');
let cli     = require('heroku-cli-util');
let flags = require('../../lib/flags.js');
let error = require('../../lib/error.js');
let certificate_details = require('../../lib/certificate_details.js');
let display_warnings = require('../../lib/display_warnings.js');

function* run(context, heroku) {
  var endpoint = (yield flags(context, heroku)).endpoint;
  if (endpoint._meta.type === 'SNI') {
    error.exit(1, 'SNI Endpoints cannot be rolled back, please update with a new cert.');
  }

  yield cli.confirmApp(context.app, context.flags.confirm, `Potentially Destructive Action\nThis command will change the certificate of endpoint ${endpoint.name} (${endpoint.cname}) from ${context.app}.`);

  let cert = yield cli.action(`Rolling back SSL Endpoint ${endpoint.name} (${endpoint.cname}) for ${context.app}`, {}, heroku.request({
    path: `/apps/${context.app}/ssl-endpoints/${encodeURIComponent(endpoint.cname)}/rollback`,
    method: 'POST',
    headers: {'X-Heroku-API-Version': '2', 'Accept': 'application/json'}
  }));

  display_warnings(cert);
  certificate_details(cert, 'New active certificate details:');
}

module.exports = {
  topic: '_certs',
  command: 'rollback',
  flags: [
    {name: 'confirm', hasValue: true, optional: true, hidden: true},
    {name: 'name', hasValue: true, description: 'name to check info on'}, 
    {name: 'endpoint', hasValue: true, description: 'endpoint to check info on'}
  ],
  description: 'Rollback an SSL Endpoint from an app.',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(run)),
};