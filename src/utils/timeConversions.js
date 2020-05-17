
const createTimeRange = length => [...Array(length).keys()].map(t => t.toString());

// make an array of the numbers 0 - 59 for the minutes and seconds
export const secondsAndMinutesRange = createTimeRange(60);
// make an array of the numbers 0 - 9 for the hours
export const hoursRange = createTimeRange(10);
// make an array of the numbers 0 - 99 for the milliseconds
export const millisecondsRange = createTimeRange(100);

const convertToInteger = value => parseInt(value, 10);

export const convertMillisecondsToRegular = millis => {
    const milliseconds = convertToInteger((millis%1000)/100);
    let seconds = parseInt((millis/1000)%60);
    let minutes = parseInt((millis/(1000*60))%60);
    let hours = parseInt((millis/(1000*60*60))%24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}

export const timeToMilliseconds = times => {
  const milliseconds = convertToInteger(times.millisecondsOptions) || 0;
  const seconds =  convertToInteger(1000 * times.secondsOptions) || 0;
  const minutes = convertToInteger(1000 * 60 * times.minutesOptions) || 0;
  const hours = convertToInteger(1000 * 60 * 60 * times.hoursOptions) || 0;
  return milliseconds + seconds + minutes + hours;
}