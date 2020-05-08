import React from 'react';
import Select from 'react-select';

const SelectElement = ({ ariaLabel, handleChange, optionsValue, placeholder, value }) => {
    return (

             <Select
                aria-label={ariaLabel}
                className="select-box"
                onChange={handleChange}
                options={optionsValue}
                placeholder={placeholder}
                theme={theme => ({
                    ...theme,
                    colors: {
                        ...theme.colors,
                        primary25: '#2684FF',
                        neutral50: 'black',
                    },
                })}
                value={value}
            />
    )
}

export default SelectElement;