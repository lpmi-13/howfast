import React, { Component } from 'react';
import Select from 'react-select';
import './App.scss';
import worlddata from './world';
import resultData from './data/results';

import Path from './components/Path';
import TimePicker from './components/TimePicker';

const eventOptions = Object.keys(resultData).map(event => {
  return {value: event, label: event}
});

const genderOptions = [
  { value: 'men', label: 'men'},
  { value: 'women', label: 'women'},
]

const timeToMilliseconds = times => {
  const seconds =  1000 * times.seconds;
  const minutes = 1000 * 60 * times.minutes;
  const hours = 1000 * 60 * 60 * times.hours;
  return seconds + minutes + hours;
}

// find all the times that are slower than the user's time
const findSlowerTimes = ( timesToBeat, userTime ) => {
  return Object.keys(timesToBeat).filter(country => timesToBeat[country] > userTime)
}

const createTimeRange = length => [...Array(length).keys()].map(t => t.toString());

// make an array of the numbers 0 - 59 for the minutes and seconds
const secondsAndMinutesRange = createTimeRange(60);
// make an array of the numbers 0 - 9 for the hours
const hoursRange = createTimeRange(10);
// make an array of the numbers 0 - 99 for the milliseconds
const millisecondsRange = createTimeRange(100);


class App extends Component {

  state = {
    event: null,
    gender: null,
    userTime: null,
    timesToBeat: null,
    slowerCountries: [],
    valueGroups: {
      hours: '0',
      minutes: '0',
      seconds: '0'
    }, 
    optionGroups: {
      hours: hoursRange,
      minutes: secondsAndMinutesRange,
      seconds: secondsAndMinutesRange
    }
  }

  compareTimes = () => {
    const {
      event,
      gender,
      userTime,
    } = this.state;
    const timesToBeat= resultData[event.value][gender.value];
    const slowerCountries = findSlowerTimes(timesToBeat, userTime);
    this.setState({
      slowerCountries,
    });
  }

  handleChangeEvent = value => {
    this.setState({
      event: value,
      userTime: null,
      timesToBeat: null,
    });
  }

  handleChangeGender = value => {
    this.setState({ gender: value })
  }

    // Update the value in response to user picking time
  handleChangeTime = (name, value) => {
    this.setState(({valueGroups}) => ({
      valueGroups: {
        ...valueGroups,
        [name]: value
      }
    }));

    this.setState({ userTime: timeToMilliseconds(this.state.valueGroups)});
  };


  render () {

    // map over the geo data and create svg paths for each country
    const countries = worlddata.features
             .map((data, index) => {
                return  <Path
                    key={index}
                    data={data}
                    index={index}
                    pathSelected={this.state.slowerCountries.includes(data.properties.name)}
                  />
             });

    const {
      compareTimes,
      handleChangeEvent,
      handleChangeGender,
      handleChangeTime,
      state: {
        event,
        gender,
        optionGroups,
        valueGroups,
      }
    } = this;

    return (
      <div className="App">
        <header className="App-header">
          <div className="select-area">
            <Select
                className="select-box"
                value={event}
                onChange={handleChangeEvent}
                options={eventOptions}
                placeholder="please select an event"
            />
            <Select
              className="select-box"
              value={gender}
              onChange={handleChangeGender}
              options={genderOptions}
              placeholder="please select a gender"
            />
          </div>
          <button className="compare-button" onClick={compareTimes}>compare</button>
          <div>
            <TimePicker
              onChange={handleChangeTime}
              optionGroups={optionGroups}
              valueGroups={valueGroups}
            />
          </div>
        </header>
        <main>
         <svg className="world-map" viewBox="0 0 1000 400">
           {countries}
         </svg>
        </main>
      </div>
    )
  }
}

export default App;
