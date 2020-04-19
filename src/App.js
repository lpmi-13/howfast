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
    length: null,
    userTime: null,
    timesToBeat: null,
    slowerCountries: [],
    valueGroups: {
      hours: '0',
      minutes: '0',
      seconds: '0',
      milliseconds: '0',
    }, 
    filteredValues: {},
    optionGroups: {
      hoursOptions: hoursRange,
      minutesOptions: secondsAndMinutesRange,
      secondsOptions: secondsAndMinutesRange,
      millisecondsOptions: millisecondsRange,
    },
    filteredOptions: {},
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

  checkLength = ({ value }) => {
    if (value != null) {
      switch(value) {
        case '100 metres':
        case '200 metres':
          return 'sprint';
        case '400 metres':
        case '800 metres':
          return 'short';
        case '1500 metres':
        case '5000 metres':
        case '10,000 metres':
          return 'mid';
        case 'Half marathon':
        case 'Marathon':
          return 'long';
        default:
          return 'short';
      }
    }
    return 'mid';
  }

  handleChangeEvent = value => {

    console.log(this.checkLength(value));
    // for distances like 200 m, we don't care about hours or minutes
    if (this.checkLength(value) === 'sprint') {
      const { hoursOptions, minutesOptions, ...restOptions } = this.state.optionGroups;
      const { hours, minutes, ...restValues } = this.state.valueGroups;
        this.setState({
          filteredOptions: restOptions,
          filteredValues: restValues,
        });
        // for distances like 800 m, we don't care about hours
    } else if (this.checkLength(value) === 'short') {
      const { hoursOptions, ...restOptions } = this.state.optionGroups;
      const { hours, ...restValues } = this.state.valueGroups;
        this.setState({
          filteredOptions: restOptions,
          filteredValues: restValues,
        });

        // for distances like 5000 m, we don't care about hours or milliseconds
      } else if (this.checkLength(value) === 'mid') {
        const { hoursOptions, millisecondsOptions, ...restOptions } = this.state.optionGroups;
        const { hours, milliseconds, ...restValues } = this.state.valueGroups;
        this.setState({
          filteredOptions: restOptions,
          filteredValues: restValues,
        });
        // in all other cases, give us everything except milliseconds
    } else {
      const { millisecondsOptions, ...restOptions } = this.state.optionGroups;
      const { milliseconds, ...restValues } = this.state.valueGroups;
        this.setState({
          filteredOptions: restOptions,
          filteredValues: restValues,
         });
    }

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
      checkLength,
      compareTimes,
      handleChangeEvent,
      handleChangeGender,
      handleChangeTime,
      state: {
        event,
        gender,
        filteredOptions,
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
                placeholder="select event"
            />
            <Select
              className="select-box"
              value={gender}
              onChange={handleChangeGender}
              options={genderOptions}
              placeholder="select gender"
            />
          </div>
          <button className="compare-button" disabled={!gender || !event} onClick={compareTimes}>compare</button>
          <div>
            <TimePicker
              onChange={handleChangeTime}
              eventCategory={event ? checkLength(event) : 'short'}
              optionGroups={filteredOptions}
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
