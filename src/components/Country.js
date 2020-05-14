import React from 'react';

import { convertMillisecondsToRegular } from '../utils/timeConversions';

const Country = props => {
    return (
        <div key={props.country[0]} className="country">
            <div className="name">{props.country[0]}</div>
            <div className="time">{convertMillisecondsToRegular(props.country[1])}</div>
        </div>
    )
}

export default Country;