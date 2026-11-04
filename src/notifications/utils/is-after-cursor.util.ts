export const isAfterCursor = (createdAtTimestamp: number, id: number, startFromTime: number, startID: number) =>
  createdAtTimestamp > startFromTime || (createdAtTimestamp === startFromTime && id > startID);
