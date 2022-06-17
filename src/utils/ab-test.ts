import logger from "./logger";

let counter =  0;

export const getABData = () => {  
  const result = counter % 2 === 0 ? "A" : "B";
  logger.info(`Getting A/B test ${counter}:${result}`);
  counter++;
  if(counter > 5000) counter = 0;
  return {
    ab: result
  };  
};