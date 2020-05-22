import React from 'react';
import classnames from 'classnames';

const Info = ({ isShown }) => {
    return (
      <div className={classnames("info-box", isShown ? 'show' : 'hidden')}>
          <p>Select an event and a time and see how many countries in the world you are faster than!</p>
          <p>All comparison times are taken from wikipedia's entries for national records in athletics, so if
             you are faster than this time you are faster than everyone from this country.
          </p>
      </div>
    )
}

export default Info;