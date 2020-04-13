import React, {Component} from 'react';
import Picker from 'react-mobile-picker-scroll';

// keeping this as a passthrough component for now since we might want to add to it later
class TimePicker extends Component {

  render() {
    const { onChange, optionGroups, valueGroups } = this.props;

    return (
      <Picker
        onChange={onChange}
        optionGroups={optionGroups}
        valueGroups={valueGroups}
      />
    );
  }
}

export default TimePicker;