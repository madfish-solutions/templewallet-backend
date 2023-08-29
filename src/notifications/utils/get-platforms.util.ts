import { isDefined } from '../../utils/helpers';
import { PlatformType } from '../notification.interface';

export const getPlatforms = (mobile?: string, extension?: string) => {
  let platforms: PlatformType[];

  if (isDefined(mobile) && isDefined(extension)) {
    platforms = [PlatformType.Mobile, PlatformType.Extension];
  } else if (isDefined(mobile)) {
    platforms = [PlatformType.Mobile];
  } else {
    platforms = [PlatformType.Extension];
  }

  return platforms;
};
