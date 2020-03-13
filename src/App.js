import React from 'react';
import './App.css';
import worlddata from './world';
import { geoMercator, geoPath } from 'd3-geo';

function App() {
  const projection = geoMercator()
  const pathGenerator = geoPath().projection(projection)
  const countries = worlddata.features
                      .map((d, i) => <path
                         key={'path' + i}
                         d={pathGenerator(d)}
                         className='countries'
                       />)

  return (
    <div className="App">
      <header className="App-header">
       <svg width={1000} height={500}>
         {countries}
       </svg>
      </header>
    </div>
  );
}

export default App;
