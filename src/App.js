import React from 'react';
import './App.css';
import worlddata from './world';

import Path from './components/Path';
import Options from './components/Options';

function App() {
  const countries = worlddata.features
           .map((data, index) => {
              return  <Path
                  data={data}
                  index={index}
                />
           });

  return (
    <div className="App">
      <header className="App-header">
        <Options />
      </header>
      <main>
       <svg width={1000} height={500}>
         {countries}
       </svg>
      </main>
    </div>
  );
}

export default App;
