import React, {Component} from 'react';
import Picker from 'react-mobile-picker-scroll';

// make an array of the numbers 0 - 59 for the minutes and seconds
const zeroToFiftyNineRange = [...Array(60).keys()].map(t => t.toString());

class TimePicker extends Component {
  state = {
      valueGroups: {
        hours: '0',
        minutes: '0',
        seconds: '0'
      }, 
      optionGroups: {
        hours: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        minutes: zeroToFiftyNineRange,
        seconds: zeroToFiftyNineRange
      }
    };

  // Update the value in response to user picking event
  handleChange = (name, value) => {
    this.setState(({valueGroups}) => ({
      valueGroups: {
        ...valueGroups,
        [name]: value
      }
    }));
  };

  render() {
    const {optionGroups, valueGroups} = this.state;

    return (
      <Picker
        optionGroups={optionGroups}
        valueGroups={valueGroups}
        onChange={this.handleChange} />
    );
  }
}

export default TimePicker;