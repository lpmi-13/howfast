import React, { useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';

const Path = ({ data, index }) => {
  const projection = geoMercator()
  const pathGenerator = geoPath().projection(projection)

  const [selected, setSelected] = useState(false);

  const handleClick = () => {
      setSelected(!selected)
  }

  return (
      <path
          key={'path' + index}
          d={pathGenerator(data)}
          data-name={data.properties.name}
          onClick={handleClick}
          className={selected ? 'selected' : 'unselected'}
      />
  )
}

export default Path;