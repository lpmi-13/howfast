import React from 'react';
import classnames from 'classnames';

const Info = ({ isShown }) => {
    return (
      <div className={classnames("info-box", isShown ? 'show' : 'hidden')}>
          <p>Select an event and a gender and see how many countries in the world you are faster than!</p>
      </div>
    )
}

export default Info;