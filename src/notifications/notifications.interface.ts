type lesserThan = {lt?: string} | {lte?: string} ;
type greaterThan = {gt?: string} | {gte?: string};

export type DateFilter = lesserThan & greaterThan;

export enum SortedBy {
  DateAsc = '0',
  DateDesc = '1'
}