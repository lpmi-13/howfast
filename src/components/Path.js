import React from 'react';
import { geoMercator, geoPath } from 'd3-geo';

const Path = ({ data, index, pathSelected }) => {
  const projection = geoMercator()
  const pathGenerator = geoPath().projection(projection)

  return (
      <path
          key={'path' + index}
          d={pathGenerator(data)}
          data-name={data.properties.name}
          className={pathSelected ? 'selected' : 'unselected'}
      />
  )
}

export default Path;