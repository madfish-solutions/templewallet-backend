import { Request, Response, NextFunction } from 'express';

import { EnvVars } from '../config';
import { isDefined } from '../utils/helpers';

export enum BasicAuthRights {
  AddNotification = 'add-notification',
  ManageAds = 'manage-ads'
}

const credentials = {
  [BasicAuthRights.AddNotification]: {
    username: EnvVars.ADD_NOTIFICATION_USERNAME,
    password: EnvVars.ADD_NOTIFICATION_PASSWORD
  },
  [BasicAuthRights.ManageAds]: {
    username: EnvVars.MANAGE_ADS_USERNAME,
    password: EnvVars.MANAGE_ADS_PASSWORD
  }
};

export const basicAuth = (rights: BasicAuthRights) => (req: Request, res: Response, next: NextFunction) => {
  const base64EncodedCredentials = req.get('Authorization');

  if (isDefined(base64EncodedCredentials)) {
    const [username, password] = Buffer.from(base64EncodedCredentials.split(' ')[1], 'base64').toString().split(':');
    const { username: correctUsername, password: correctPassword } = credentials[rights];

    if (!(username === correctUsername && password === correctPassword)) {
      handleNotAuthenticated(res, next);
    }
    next();
  } else {
    handleNotAuthenticated(res, next);
  }
};

const handleNotAuthenticated = (res: Response, next: NextFunction) => {
  const err = new Error('Not Authenticated!');
  res.status(401).set('WWW-Authenticate', 'Basic');
  next(err);
};
