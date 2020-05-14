export const convertMillisecondsToRegular = millis => {
    const milliseconds = parseInt((millis%1000)/100);
    let seconds = parseInt((millis/1000)%60);
    let minutes = parseInt((millis/(1000*60))%60);
    let hours = parseInt((millis/(1000*60*60))%24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}