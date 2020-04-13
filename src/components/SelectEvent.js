import React from 'react';
import Select from 'react-select';

const SelectEvent = ({ handleChange, eventValue, options }) => {
    return (
        <div className="event-selection">
            Pick your event
            <Select
              value={eventValue}
              onChange={handleChange}
              options={options}
              placeholder="please select an event"
            />
        </div>
    )
}

export default SelectEvent;