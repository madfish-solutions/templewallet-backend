import { isTruthy } from '../../utils/helpers';
import { PlatformType } from '../notification.interface';

export const getPlatforms = (mobile?: string, extension?: string) => {
  let platforms: PlatformType[];

  if (isTruthy(mobile) && isTruthy(extension)) {
    platforms = [PlatformType.Mobile, PlatformType.Extension];
  } else if (isTruthy(mobile)) {
    platforms = [PlatformType.Mobile];
  } else {
    platforms = [PlatformType.Extension];
  }

  return platforms;
};
