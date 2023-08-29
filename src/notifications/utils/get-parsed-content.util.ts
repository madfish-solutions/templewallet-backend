import { NotificationLink } from '../notification.interface';

// Parses text input string (that could contain links, list and indents) to a proper data structure
export const getParsedContent = (content: string): Array<string | NotificationLink> =>
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

// Example:

// in:
// "It boasts all the features you would expect from a modern crypto wallet:
//  • Top up balance with crypto or credit card.
//  • Sync your wallet between mobile and desktop devices.
//
// To quickly learn the ropes, check our { text: 'knowledge base', url: 'https://madfish.crunch.help' } and { text: 'YouTube video tutorials', url: 'https://www.youtube.com' } out."

// out:
//  [ 'It boasts all the features you would expect from a modern crypto wallet:\n',
//     ' • Top up balance with crypto or credit card.\n',
//     ' • Sync your wallet between mobile and desktop devices.\n',
//     '\n',
//     'To quickly learn the ropes, check our ',
//     { text: 'knowledge base', url: 'https://madfish.crunch.help' },
//     ' and ',
//     {
//       text: 'YouTube video tutorials',
//       url: 'https://www.youtube.com'
//     },
//     ' out.\n' ]
