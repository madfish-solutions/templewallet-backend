import logger from './logger';

let counter =  0;

export const getABData = () => {  
  const result = counter % 2 === 0 ? 'A' : 'B';
  logger.info(`Getting A/B test ${counter}:${result}`);
  counter++;
  if(counter === Number.MAX_SAFE_INTEGER) counter = 0;
  
return {
    ab: result
  };  
};