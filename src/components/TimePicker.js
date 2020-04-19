import React, {Component} from 'react';
import Picker from 'react-mobile-picker-scroll';

// keeping this as a passthrough component for now since we might want to add to it later
class TimePicker extends Component {

  render() {
    const { eventCategory, onChange, optionGroups, valueGroups } = this.props;

    return Object.entries(optionGroups).length !== 0 && (
      <div className="picker-box">
        <Picker
          onChange={onChange}
          optionGroups={optionGroups}
          valueGroups={valueGroups}
        />
        <div className="picker-labels">
          { eventCategory === 'long' && (
          <div>
              Hours
          </div>
          )}
          { eventCategory !== 'sprint' && (
          <div>
              Minutes
          </div>
          )}
          <div>
              Seconds
          </div>
          { (eventCategory === 'sprint' || eventCategory === 'short') && (
          <div>
              Milliseconds
          </div>
          )}
        </div>
      </div>
    );
  }
}

export default TimePicker;