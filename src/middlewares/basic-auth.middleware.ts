import { Request, Response, NextFunction } from 'express';

import { EnvVars } from '../config';
import { isDefined } from '../utils/helpers';

export const basicAuth = (req: Request, res: Response, next: NextFunction) => {
  const base64EncodedCredentials = req.get('Authorization');

  if (isDefined(base64EncodedCredentials)) {
    const [username, password] = Buffer.from(base64EncodedCredentials.split(' ')[1], 'base64').toString().split(':');

    if (!(username === EnvVars.ADD_NOTIFICATION_USERNAME && password === EnvVars.ADD_NOTIFICATION_PASSWORD)) {
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
