/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as express from 'express';
import { Request, Response, Router, Handler } from 'express';
import * as hsts from 'hsts';
import * as Rollbar from 'rollbar';

import * as path from 'path';
import * as bodyParser from 'body-parser';
import * as compress from 'compression';
import { logAndTrack, LOGGER } from 'logger-tracker';

import { Timezone, WallTime } from 'chronoshift';
// Init chronoshift
if (!WallTime.rules) {
  var tzData = require("chronoshift/lib/walltime/walltime-data.js");
  WallTime.init(tzData.rules, tzData.zones);
}

import { GetSettingsOptions } from './utils/settings-manager/settings-manager';
import { SwivRequest } from './utils/index';
import { VERSION, SERVER_SETTINGS, SETTINGS_MANAGER, ROLLBAR } from './config';
import * as plywoodRoutes from './routes/plywood/plywood';
import * as plyqlRoutes from './routes/plyql/plyql';
import * as swivRoutes from './routes/swiv/swiv';
import * as collectionsRoutes from './routes/collections/collections';
import * as settingsRoutes from './routes/settings/settings';
import * as mkurlRoutes from './routes/mkurl/mkurl';
import * as healthRoutes from './routes/health/health';
import * as errorRoutes from './routes/error/error';
import RemergeAuth from './remerge-auth';

import { errorLayout } from './views';

function makeGuard(guard: string): Handler {
  return (req: SwivRequest, res: Response, next: Function) => {
    const user = req.user;
    if (!user) {
      res.redirect('/login');
      return;
    }

    const { allow } = user;
    if (!allow || !allow[guard]) {
      res.status(401);
      res.send('Unauthorized');
      return;
    }

    next();
  };
}

var app = express();
app.disable('x-powered-by');

if (SERVER_SETTINGS.getTrustProxy() === 'always') {
  app.set('trust proxy', 1); // trust first proxy
}

function addRoutes(attach: string, router: Router | Handler): void {
  app.use(attach, router);
  app.use(SERVER_SETTINGS.getServerRoot() + attach, router);
}

function addGuardedRoutes(attach: string, guard: string, router: Router | Handler): void {
  var guardHandler = makeGuard(guard);
  app.use(attach, guardHandler, router);
  app.use(SERVER_SETTINGS.getServerRoot() + attach, guardHandler, router);
}

// Add compression
app.use(compress());

// Add request logging and tracking
app.use(logAndTrack(SERVER_SETTINGS.getRequestLogFormat()));

// Add Strict Transport Security
if (SERVER_SETTINGS.getStrictTransportSecurity() === "always") {
  app.use(hsts({
    maxAge: 10886400000,     // Must be at least 18 weeks to be approved by Google
    includeSubDomains: true, // Must be enabled to be approved by Google
    preload: true
  }));
}

addRoutes('/health', healthRoutes);

addRoutes('/', express.static(path.join(__dirname, '../../build/public')));
addRoutes('/', express.static(path.join(__dirname, '../../assets')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Assign basics
var stateful = SETTINGS_MANAGER.isStateful();
app.use((req: SwivRequest, res: Response, next: Function) => {
  req.user = null;
  req.version = VERSION;
  req.stateful = stateful;
  req.getSettings = (opts: GetSettingsOptions = {}) => {
    return SETTINGS_MANAGER.getSettings(opts);
  };
  next();
});

// Global, optional version check
app.use((req: SwivRequest, res: Response, next: Function) => {
  var { version } = req.body;
  if (version && version !== req.version) {
    res.status(412).send({
      error: 'incorrect version',
      action: 'reload'
    });
    return;
  }
  next();
});

// Remerge authentication
RemergeAuth.inject(app);

// Data routes
addGuardedRoutes('/plywood', 'access', plywoodRoutes);
addGuardedRoutes('/plyql', 'access', plyqlRoutes);
addRoutes('/mkurl', mkurlRoutes);
addGuardedRoutes('/error', 'access', errorRoutes);
if (stateful) {
  addGuardedRoutes('/collections', 'access', collectionsRoutes);
  addGuardedRoutes('/settings', 'settings', settingsRoutes);
}


// View routes
if (SERVER_SETTINGS.getIframe() === 'deny') {
  app.use((req: Request, res: Response, next: Function) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });
}

addGuardedRoutes('/', 'access', swivRoutes);

// Catch 404 and redirect to /
app.use((req: Request, res: Response, next: Function) => {
  res.redirect('/');
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') { // NODE_ENV
  app.use((err: any, req: Request, res: Response, next: Function) => {
    LOGGER.error(`Server Error: ${err.message}`);
    LOGGER.error(err.stack);
    res.status(err.status || 500);
    res.send(errorLayout({ version: VERSION, title: 'Error' }, err.message, err));
  });
}

// production error handler
// no stacktraces leaked to user
if (ROLLBAR) {
  const rollbarConfig = {
    accessToken: ROLLBAR.server_token,
    captureUncaught: true,
    captureUnhandledRejections: true,
    environment: ROLLBAR.environment,
    logLevel: 'info',
    reportLevel: ROLLBAR.report_level
  };
  const rollbar = new Rollbar(rollbarConfig);
  app.use(rollbar.errorHandler());
}

app.use((err: any, req: Request, res: Response, next: Function) => {
  LOGGER.error(`Server Error: ${err.message}`);
  LOGGER.error(err.stack);
  res.status(err.status || 500);
  res.send(errorLayout({ version: VERSION, title: 'Error' }, err.message));
});

export = app;
