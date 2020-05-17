import React, { Component } from 'react';
import classnames from 'classnames';
import './App.scss';
import worlddata from './world';
import resultData from './data/results';

import Country from './components/Country';
import Info from './components/Info';
import Path from './components/Path';
import SelectElement from './components/SelectElement';
import TimePicker from './components/TimePicker';
import { hoursRange, millisecondsRange, secondsAndMinutesRange, timeToMilliseconds } from './utils/timeConversions';

const eventOptions = Object.keys(resultData['events']).map(event => {
  return {value: event, label: event}
});

const genderOptions = [
  { value: 'men', label: 'men'},
  { value: 'women', label: 'women'},
]

// find all the times that are slower than the user's time
const findSlowerTimesArray = (timesToBeat, userTime ) => {
  return (timesToBeat).filter(country => country[1] > userTime)
}

const pullOutNames = countryArray => countryArray.map(country => country[0])

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

  backToChooseTimes = () => {
    this.setState({ slowerCountries : [] });
  }

  compareTimes = () => {
    const {
      event,
      gender,
      userTime,
    } = this.state;
    const timesToBeat= resultData['events'][event.value][gender.value];
    const slowerCountries = findSlowerTimesArray(timesToBeat, userTime);
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
      slowerCountries: [],
      timesToBeat: null,
      userTime: 0,
      valueGroups: {
        hours: '0',
        minutes: '0',
        seconds: '0',
        milliseconds: '0',
      }
    });
  }

  handleChangeGender = value => {
    this.setState({
      gender: value,
      slowerCountries: [],
      valueGroups: {
        hours: '0',
        minutes: '0',
        seconds: '0',
        milliseconds: '0',
      }
    });
  }

    // Update the value in response to user picking time
  handleChangeTime = (name, value) => {
    this.setState(({valueGroups}) => ({
      valueGroups: {
        ...valueGroups,
        [name]: value
      },
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
                    pathSelected={pullOutNames(this.state.slowerCountries).includes(data.properties.name)}
                  />
             });

    const {
      backToChooseTimes,
      checkLength,
      compareTimes,
      handleChangeEvent,
      handleChangeGender,
      handleChangeTime,
      state: {
        event,
        gender,
        filteredOptions,
        slowerCountries,
        valueGroups,
      }
    } = this;

    return (
      <div className="App">
        <main>
          <div className={classnames("App-header", slowerCountries.length > 0 ? `hide` : `display`)}>
            <div className="select-area">
              <SelectElement
                  ariaLabel="select event"
                  handleChange={handleChangeEvent}
                  optionsValue={eventOptions}
                  placeholder="select event"
                  value={event}
              />
              <SelectElement
                ariaLabel="select gender"
                handleChange={handleChangeGender}
                optionsValue={genderOptions}
                placeholder="select gender"
                value={gender}
              />
              <button className="compare-button" disabled={!gender || !event} onClick={compareTimes}>compare</button>
            </div>
            <Info isShown={Object.entries(filteredOptions).length <= 0}/>
            <TimePicker
              eventCategory={event ? checkLength(event) : 'short'}
              isShown={Object.entries(filteredOptions).length > 0}
              onChange={handleChangeTime}
              optionGroups={filteredOptions}
              valueGroups={valueGroups}
            />
          </div>
          <div className={classnames("results", slowerCountries.length > 0 ? `display` : `hide`)}>
            <div className="world-map">
              <svg viewBox={window.innerWidth > 500 ? "0 0 1000 435" : "-500 0 1500 435"} overflow="auto">
                {countries}
              </svg>
            </div>
            { slowerCountries.length <= 0 && <div className="date-stamp">{resultData['generated_at']}</div> }
            { slowerCountries.length > 0 && 
             <div className="info">
               <button className="back-button" onClick={backToChooseTimes}>back</button>
               <div className="faster-than">{
                 `you're faster than ${slowerCountries.length > 1 ? 'these' : 'this'}
                 ${slowerCountries.length}
                 ${slowerCountries.length > 1 ? 'countries' : 'country'}`
               }</div>
               <div className="scroll-note">
                (scroll to the side if you can't see the whole map)
               </div>
               <div className="countries-list">
                 {slowerCountries
                     // sorted in the python code, so can just map here to show descending times
                     .map(country => <Country key={country[0]} country={country} />)}
               </div>
             </div>
            }
          </div>
        </main>
      </div>
    )
  }
}

export default App;
