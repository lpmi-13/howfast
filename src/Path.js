import React, { useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';

const Path = ({ index, data }) => {

    const projection = geoMercator()
    const pathGenerator = geoPath().projection(projection)

    const [filled, setFilled] = useState(false);

    const turnItBlack = () => {
        setFilled(!filled)
    }

    return (
       <path
         key={'path' + index}
         d={pathGenerator(data)}
         data-id={data.properties.name}
         onClick={turnItBlack}
         className={filled ? 'selected' : 'unselected'}
       />
    )
}

export default Path