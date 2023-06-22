import { NotificationLink } from '../notification.interface';

export const getParsedContent = (content: string) =>
  content
    .split('\r\n')
    .map((item: string, index: number, array: string[]) => {
      if (item.length === 0 && array[index - 1].startsWith(' • ')) {
        item += '\n';
      } else if (item.length === 0) {
        item += '\n\n';
      }

      if (item.endsWith(':') || item.startsWith(' • ')) {
        item += '\n';
      }

      if (item.includes('{')) {
        const regex = /{[^}]+}/g;
        const objects = item.match(regex) || [];

        const result: (string | NotificationLink)[] = [];

        let lastIndex = 0;
        for (const obj of objects) {
          const startIndex = item.indexOf(obj, lastIndex);
          if (startIndex > lastIndex) {
            result.push(item.substring(lastIndex, startIndex));
          }
          result.push(JSON.parse(obj));
          lastIndex = startIndex + obj.length;
        }

        if (lastIndex < item.length) {
          result.push(item.substring(lastIndex));
        }

        return result;
      }

      return item;
    })
    .flat();
