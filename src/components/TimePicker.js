import React, {Component} from 'react';
import Picker from 'react-mobile-picker-scroll';

// keeping this as a passthrough component for now since we might want to add to it later
class TimePicker extends Component {

  render() {
    const { onChange, optionGroups, valueGroups } = this.props;

    return (
      <div className="picker-box">
        <Picker
          onChange={onChange}
          optionGroups={optionGroups}
          valueGroups={valueGroups}
        />
        <div className="picker-labels">
          <div>
              Hours
          </div>
          <div>
              Minutes
          </div>
          <div>
              Seconds
          </div>
        </div>
      </div>
    );
  }
}

export default TimePicker;