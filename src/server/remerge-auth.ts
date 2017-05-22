import * as passport from 'passport';
import * as Auth0Strategy from 'passport-auth0';
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';
const RedisStore = connectRedis(session);

import { Application, Request, Response } from 'express';
import { SwivRequest } from './utils/index';
import { User } from '../common/models/index';

import { layout, ViewOptions } from './views';

const AUTH0_CONFIG = {
  domain:        'remerge.auth0.com',
  clientID:      'TFlgPdEirAhjXN8m65txT9qigon3fgWI',
  clientSecret:  '7VPo6hBgJch7tC7xA9OXT-YNerNSoSf5MrjtxmNsJdyCcLFLf1yAAO3pLHcEb7QH',
  callbackURL:   'https://pivot.remerge.io/callback'
  //callbackURL:   'http://localhost:3099/callback'
  //callbackURL:   'http://bene.dev.zenops.net:3099/callback'
  //callbackURL:   'http://cris.dev.remerge.io:3099/callback'
};

const SESSION_CONFIG = {
  secret: '94r82E2V0rTW06f2rFGeQC082L0q2fGj94r82E2V0rTW06f2rFGeQC082L0q2fGj',
  redis: {
    host: 'db1.api.remerge.io',
    db: 5
  }
};

export interface Profile extends User {
  name: { familyName: string, givenName: string };
  emails: { value: string }[];
  picture: string;
  locale: string;
  nickname: string;
  identities: { provider: string, user_id: string, connection: string, isSocial: boolean };
  _json: any;
}

export interface AuthedSwivRequest extends SwivRequest {
  logout(): void;
}

function _setupMiddleware(app: Application) {
  app.use(session({
    store: new RedisStore(SESSION_CONFIG.redis),
    secret: SESSION_CONFIG.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: false,
      maxAge: 2592000000 // 30 days in ms
    }
  }));
  app.use(passport.initialize());
  app.use(passport.session());
}

function _setupPassport(app: Application) {
  passport.use(new Auth0Strategy(AUTH0_CONFIG, (accessToken: string, refreshToken: string, extraParams: any, profile: Profile, done: any) => {
    // simple e-mail check for now
    profile.emails.forEach(({ value }) => {
      if (/@remerge\.io$/.test(value)) {
        // inject email and allow hash, used by swiv
        profile.email = value;
        profile.allow = {
          access: true,
          settings: false
        };
        return;
      }
    });

    return done(null, profile);
  }));

  passport.serializeUser((user: any, done: any) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done: any) => {
    done(null, user);
  });
}

function _setupRoutes(app: Application) {
  app.get('/callback',
    passport.authenticate('auth0', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get('/login',
    (req: AuthedSwivRequest, res: Response) => {
      req.getSettings()
        .then((appSettings) => {
          res.send(_buildLayout({
            version: req.version,
            title: appSettings.customization.getTitle(req.version)
           }));
        })
        .done();
    }
  );

  app.get('/logout',
    (req: AuthedSwivRequest, res: Response) => {
      req.logout();
      res.redirect('/');
    }
  );
}

function _buildLayout(options: ViewOptions) {
  return layout(options, `
<script src="https://cdn.auth0.com/js/lock/10.3/lock.min.js"></script>
<div id="root" style="width: 280px; margin: 40px auto; padding: 10px;">
<script>
  var lock = new Auth0Lock('${AUTH0_CONFIG.clientID}', '${AUTH0_CONFIG.domain}', {
    auth: {
      redirectUrl: '${AUTH0_CONFIG.callbackURL}',
      responseType: 'code',
      params: {
        scope: 'openid name email groups'
      },
    },
    theme: {
      logo: '//assets.remerge.io/logo_picto_320x320.png',
      primaryColor: '#00b192'
    },
    languageDictionary: {
      title: '${options.title}'
    }
  });

  lock.show();
</script>
  `);
}

export default {
  inject(app: Application) {
    _setupMiddleware(app);
    _setupPassport(app);
    _setupRoutes(app);
  }
};
