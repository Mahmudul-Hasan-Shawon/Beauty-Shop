import React from 'react';

export default function Stars({ value = 0, size = 13 }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className="stars" style={{ fontSize: size }}>
      {stars.map((s) => (
        <i key={s} className={`${value >= s ? 'fa-solid' : 'fa-regular'} fa-star ${value >= s ? '' : 'dim'}`} />
      ))}
    </span>
  );
}